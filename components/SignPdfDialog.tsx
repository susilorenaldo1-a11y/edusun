"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter } from "next/navigation";

interface Props {
  id: string;
  code: string;
  label?: string;
}

interface Position {
  /** Percentages of the preview box. */
  x: number;
  y: number;
  w: number;
}

interface RenderTask {
  cancel?: () => void;
  promise: Promise<void>;
}

const DEFAULT_POSITION: Position = { x: 60, y: 74, w: 30 };

/** Zoom is relative to "fit page": 1 means the whole page is visible. */
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 1.25;
/** Breathing room (px) between the page and the edge of the viewport. */
const FIT_INSET = 14;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const roundZoom = (value: number) => Math.round(value * 100) / 100;

/** Resolution used when rasterising the printed name, in pixels per PDF point. */
const LABEL_SCALE = 8;

interface LabelFont {
  size: number;
  spacing: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

/**
 * Rasterises the printed name/role so it can be positioned independently from
 * the signature. Returns the image plus its size in PDF points.
 */
function renderLabel(
  lines: string[],
  font: LabelFont
): { url: string; widthPt: number; heightPt: number } | null {
  const text = lines.map((line) => line.trim()).filter((line) => line.length > 0);
  if (text.length === 0) return null;

  const scale = LABEL_SCALE;
  const fontPx = Math.max(6, font.size) * scale;
  const spacingPx = font.spacing * scale;
  const lineHeight = fontPx * 1.34;
  const padding = fontPx * 0.25;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;

  const weight = font.bold ? "700" : "400";
  const style = font.italic ? "italic " : "";
  const family = `"Segoe UI", "Helvetica Neue", Arial, sans-serif`;
  context.font = `${style}${weight} ${fontPx}px ${family}`;

  const measure = (line: string) => {
    if (Math.abs(spacingPx) < 0.01) return context.measureText(line).width;
    const chars = Array.from(line);
    const base = chars.reduce((sum, char) => sum + context.measureText(char).width, 0);
    return base + spacingPx * Math.max(0, chars.length - 1);
  };

  const widths = text.map(measure);
  const contentWidth = Math.max(...widths);
  const width = Math.ceil(contentWidth + padding * 2);
  const height = Math.ceil(lineHeight * text.length + padding * 2);
  canvas.width = width;
  canvas.height = height;

  // Resizing the canvas resets the context, so configure it again.
  context.font = `${style}${weight} ${fontPx}px ${family}`;
  context.fillStyle = "#10241b";
  context.textAlign = "left";
  context.textBaseline = "alphabetic";

  text.forEach((line, index) => {
    const baseline = padding + lineHeight * index + fontPx * 0.82;
    const startX = (width - widths[index]) / 2;

    if (Math.abs(spacingPx) < 0.01) {
      context.fillText(line, startX, baseline);
    } else {
      let x = startX;
      for (const char of Array.from(line)) {
        context.fillText(char, x, baseline);
        x += context.measureText(char).width + spacingPx;
      }
    }

    if (font.underline) {
      const thickness = Math.max(1, fontPx * 0.055);
      context.fillRect(
        startX,
        baseline + fontPx * 0.16,
        widths[index],
        thickness
      );
    }
  });

  return {
    url: canvas.toDataURL("image/png"),
    widthPt: width / scale,
    heightPt: height / scale,
  };
}

export default function SignPdfDialog({
  id,
  code,
  label = "Tanda tangani PDF",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(true);
  const [numPages, setNumPages] = useState(1);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState({ w: 595, h: 842 });
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [signatureAspect, setSignatureAspect] = useState(2.6);
  const [signName, setSignName] = useState("");
  const [signRole, setSignRole] = useState("");
  const [fontSize, setFontSize] = useState(10);
  const [letterSpacing, setLetterSpacing] = useState(0.2);
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  const [textUnderline, setTextUnderline] = useState(false);
  /** Printed name/role, positioned separately from the signature image. */
  const [labelStamp, setLabelStamp] = useState<{
    url: string;
    w: number;
    h: number;
  } | null>(null);
  const [labelPos, setLabelPos] = useState({ x: 60, y: 82 });
  const [mode, setMode] = useState<"draw" | "upload">("draw");
  const [position, setPosition] = useState<Position>(DEFAULT_POSITION);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<{ numPages: number } | null>(null);
  const pdfTaskRef = useRef<{ destroy?: () => unknown } | null>(null);
  const draggingRef = useRef(false);
  const drawingRef = useRef(false);
  const zoomAnchorRef = useRef<{ cx: number; cy: number } | null>(null);
  const labelPlacedRef = useRef(false);

  const tabRef = useRef<HTMLButtonElement>(null);

  /* ---------- zoom maths ---------- */

  /** CSS pixels per PDF point when the whole page fits the viewport. */
  const fitScale = useMemo(() => {
    if (!pageSize.w || !pageSize.h) return 1;
    const availW = Math.max(80, box.w - FIT_INSET * 2);
    const availH = Math.max(80, box.h - FIT_INSET * 2);
    return Math.min(availW / pageSize.w, availH / pageSize.h);
  }, [box, pageSize]);

  const pageBox = {
    w: pageSize.w * fitScale * zoom,
    h: pageSize.h * fitScale * zoom,
  };
  const pageWidth = pageBox.w;
  const pageHeight = pageBox.h;
  const pageBoxRef = useRef(pageBox);
  useEffect(() => {
    pageBoxRef.current = { w: pageWidth, h: pageHeight };
  }, [pageWidth, pageHeight]);

  const fitWidthZoom = useMemo(() => {
    const availW = Math.max(80, box.w - FIT_INSET * 2);
    const fitted = pageSize.w * fitScale;
    if (!fitted) return 1;
    return clamp(roundZoom(availW / fitted), MIN_ZOOM, MAX_ZOOM);
  }, [box, pageSize, fitScale]);

  /** Keeps the same spot centred when the page grows or shrinks. */
  const rememberZoomAnchor = useCallback(() => {
    const el = previewRef.current;
    if (!el) return;
    const current = pageBoxRef.current;
    zoomAnchorRef.current = {
      cx: (el.scrollLeft + el.clientWidth / 2) / Math.max(1, current.w),
      cy: (el.scrollTop + el.clientHeight / 2) / Math.max(1, current.h),
    };
  }, []);

  const applyZoom = useCallback(
    (factor: number) => {
      rememberZoomAnchor();
      setZoom((value) => clamp(roundZoom(value * factor), MIN_ZOOM, MAX_ZOOM));
    },
    [rememberZoomAnchor]
  );

  const resetZoom = useCallback(() => {
    rememberZoomAnchor();
    setZoom(1);
  }, [rememberZoomAnchor]);

  const showFitWidth = useCallback(() => {
    rememberZoomAnchor();
    setZoom(fitWidthZoom);
  }, [rememberZoomAnchor, fitWidthZoom]);

  /** Page navigation always restarts from the top of the new page. */
  const goToPage = useCallback(
    (next: number) => {
      const target = clamp(Math.round(next), 0, Math.max(0, numPages - 1));
      setPageIndex(target);
      const scroller = previewRef.current;
      if (scroller) scroller.scrollTo({ top: 0, left: 0 });
    },
    [numPages]
  );

  useEffect(() => {
    const el = previewRef.current;
    const anchor = zoomAnchorRef.current;
    if (!el || !anchor) return;
    el.scrollLeft = anchor.cx * pageBox.w - el.clientWidth / 2;
    el.scrollTop = anchor.cy * pageBox.h - el.clientHeight / 2;
    zoomAnchorRef.current = null;
  }, [pageBox.w, pageBox.h]);

  /* ---------- open / load document ---------- */

  const close = useCallback(() => {
    setOpen(false);
    setLoading(false);
    setSignatureUrl(null);
    setError(null);
    setLoadError(null);
    setPosition(DEFAULT_POSITION);
    setPageIndex(0);
    setZoom(1);

    const task = pdfTaskRef.current;
    pdfTaskRef.current = null;
    pdfDocRef.current = null;

    if (task && typeof task.destroy === "function") {
      try {
        void Promise.resolve(task.destroy()).catch(() => undefined);
      } catch {
        /* pdf.js already torn down */
      }
    }

    setImageUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
  }, []);

  const openDialog = useCallback(async () => {
    setOpen(true);
    setLoading(true);
    setLoadError(null);
    setError(null);
    setZoom(1);

    try {
      const response = await fetch(`/api/file/${id}`);
      if (!response.ok) throw new Error("Dokumen tidak dapat dimuat.");
      const blob = await response.blob();
      const buffer = new Uint8Array(await blob.arrayBuffer());
      const looksLikePdf =
        buffer[0] === 0x25 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x44 &&
        buffer[3] === 0x46;

      if (looksLikePdf) {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const task = pdfjs.getDocument({ data: buffer });
        pdfTaskRef.current = task as unknown as { destroy?: () => unknown };
        const doc = await task.promise;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setIsPdf(true);
        setPageIndex(0);
        return;
      }

      setImageUrl(URL.createObjectURL(new Blob([buffer], { type: blob.type })));
      setIsPdf(false);
      setNumPages(1);
      setPageIndex(0);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Dokumen gagal dimuat."
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  /* ---------- measure the viewport ---------- */

  useEffect(() => {
    if (!open) return;
    const el = previewRef.current;
    if (!el) return;
    const measure = () =>
      setBox((prev) =>
        prev.w === el.clientWidth && prev.h === el.clientHeight
          ? prev
          : { w: el.clientWidth, h: el.clientHeight }
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, loading, loadError, isPdf]);

  /* ---------- PDF page rendering ---------- */

  useEffect(() => {
    if (!open || !isPdf || loading || loadError) return;
    let cancelled = false;
    let task: RenderTask | null = null;

    const render = async () => {
      const doc = pdfDocRef.current as unknown as {
        getPage: (n: number) => Promise<{
          getViewport: (opts: { scale: number }) => {
            width: number;
            height: number;
          };
          render: (opts: {
            canvasContext: CanvasRenderingContext2D;
            canvas: HTMLCanvasElement;
            viewport: unknown;
          }) => RenderTask;
        }>;
      } | null;
      const canvas = canvasRef.current;
      if (!doc || !canvas) return;

      const page = await doc.getPage(pageIndex + 1);
      if (cancelled) return;

      const base = page.getViewport({ scale: 1 });
      setPageSize((prev) =>
        Math.abs(prev.w - base.width) < 0.5 &&
        Math.abs(prev.h - base.height) < 0.5
          ? prev
          : { w: base.width, h: base.height }
      );

      const availW = Math.max(80, box.w - FIT_INSET * 2);
      const availH = Math.max(80, box.h - FIT_INSET * 2);
      const fitted = Math.min(availW / base.width, availH / base.height);
      const displayW = Math.max(40, base.width * fitted * zoom);
      const displayH = Math.max(40, base.height * fitted * zoom);

      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      // Keep the backing store sane on very large zoom levels.
      const pixelBudget = 24_000_000;
      const rawScale = (displayW / base.width) * ratio;
      const pixels = base.width * rawScale * base.height * rawScale;
      const scale =
        pixels > pixelBudget
          ? rawScale * Math.sqrt(pixelBudget / pixels)
          : rawScale;
      const viewport = page.getViewport({ scale });
      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      canvas.style.width = `${displayW}px`;
      canvas.style.height = `${displayH}px`;

      task = page.render({ canvasContext: context, canvas, viewport });
      await task.promise;
    };

    render().catch((err: unknown) => {
      const name = (err as { name?: string } | null)?.name;
      if (!cancelled && name !== "RenderingCancelledException") {
        setLoadError("Halaman dokumen gagal dirender.");
      }
    });

    return () => {
      cancelled = true;
      try {
        task?.cancel?.();
      } catch {
        /* already finished */
      }
    };
  }, [open, isPdf, loading, loadError, pageIndex, zoom, box.w, box.h]);

  /* ---------- zoom gestures ---------- */

  useEffect(() => {
    if (!open) return;
    const el = previewRef.current;
    if (!el) return;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      applyZoom(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open, applyZoom]);

  /* ---------- signature pad ---------- */

  const setupPad = useCallback(() => {
    const canvas = padRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineWidth = 2.2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#10241b";
    context.fillStyle = "#10241b";
  }, []);

  useEffect(() => {
    if (!open || mode !== "draw") return;
    setupPad();
  }, [open, mode, setupPad]);

  const padPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = padRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const onPadDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const context = padRef.current?.getContext("2d");
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const point = padPoint(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineTo(point.x + 0.1, point.y + 0.1);
    context.stroke();
  };

  const onPadMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const context = padRef.current?.getContext("2d");
    if (!context) return;
    const point = padPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const onPadUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = padRef.current;
    if (!canvas) return;
    const url = trimCanvas(canvas);
    if (!url) return;
    setSignatureUrl(url);
    setPosition(DEFAULT_POSITION);
    // Honour the real proportions of the drawn strokes instead of guessing.
    const probe = new Image();
    probe.onload = () =>
      setSignatureAspect(
        probe.naturalWidth / Math.max(1, probe.naturalHeight)
      );
    probe.src = url;
  };

  const clearPad = () => {
    const canvas = padRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      setupPad();
    }
    setSignatureUrl(null);
  };

  /* ---------- uploaded signature ---------- */

  const onUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/image\/(png|jpeg)/.test(file.type)) {
      setError("Gunakan gambar PNG atau JPG.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? "");
      const image = new Image();
      image.onload = () => {
        setSignatureAspect(image.width / Math.max(1, image.height));
        setSignatureUrl(url);
        setPosition(DEFAULT_POSITION);
        setError(null);
      };
      image.src = url;
    };
    reader.readAsDataURL(file);
  };

  /* ---------- printed name/role (independent element) ---------- */

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const rendered = renderLabel([signName, signRole], {
        size: fontSize,
        spacing: letterSpacing,
        bold: textBold,
        italic: textItalic,
        underline: textUnderline,
      });

      if (!rendered) {
        setLabelStamp(null);
        return;
      }

      setLabelStamp({
        url: rendered.url,
        w: (rendered.widthPt / Math.max(1, pageSize.w)) * 100,
        h: (rendered.heightPt / Math.max(1, pageSize.h)) * 100,
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [
    signName,
    signRole,
    fontSize,
    letterSpacing,
    textBold,
    textItalic,
    textUnderline,
    pageSize.w,
    pageSize.h,
  ]);

  /** Puts the name right under the signature the first time it is typed. */
  const placeLabelUnderSignature = () => {
    if (labelPlacedRef.current) return;
    const pageRatio = pageSize.w / Math.max(1, pageSize.h);
    const signatureHeightPct =
      (position.w * pageRatio) / Math.max(0.4, signatureAspect);
    setLabelPos({
      x: clamp(position.x, 0, 94),
      y: clamp(position.y + signatureHeightPct + 1.2, 0, 94),
    });
    labelPlacedRef.current = true;
  };

  /* ---------- keep the stamp in view (important on phones) ---------- */

  useEffect(() => {
    if (!open || !signatureUrl) return;
    const scroller = previewRef.current;
    const overlay = overlayRef.current;
    if (!scroller || !overlay) return;

    const frame = requestAnimationFrame(() => {
      const left =
        overlay.offsetLeft + overlay.offsetWidth / 2 - scroller.clientWidth / 2;
      const top =
        overlay.offsetTop + overlay.offsetHeight / 2 - scroller.clientHeight / 2;
      scroller.scrollTo({
        left: Math.max(0, left),
        top: Math.max(0, top),
        behavior: "smooth",
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [open, signatureUrl, pageIndex]);

  /* ---------- drag & resize on the page ---------- */

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!signatureUrl) return;
    const stage = stageRef.current;
    if (!stage) return;
    event.preventDefault();
    draggingRef.current = true;
    const rect = stage.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const start = position;

    const move = (moveEvent: PointerEvent) => {
      if (!draggingRef.current) return;
      const dx = ((moveEvent.clientX - startX) / rect.width) * 100;
      const dy = ((moveEvent.clientY - startY) / rect.height) * 100;
      setPosition((prev) => {
        const heightPct =
          ((prev.w / 100) * (rect.width / rect.height) * 100) / signatureAspect;
        return {
          ...prev,
          x: clamp(start.x + dx, 0, Math.max(0, 100 - prev.w)),
          y: clamp(start.y + dy, 0, Math.max(0, 100 - heightPct)),
        };
      });
    };

    const stop = () => {
      draggingRef.current = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  const beginResize = (event: ReactPointerEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    event.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const startX = event.clientX;
    const startW = position.w;

    const move = (moveEvent: PointerEvent) => {
      const dw = ((moveEvent.clientX - startX) / rect.width) * 100;
      setPosition((prev) => ({
        ...prev,
        w: clamp(startW + dw, 6, 92),
      }));
    };

    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  /* ---------- drag the printed name independently ---------- */

  const beginLabelDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!labelStamp) return;
    const stage = stageRef.current;
    if (!stage) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = stage.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const start = labelPos;
    const maxX = Math.max(0, 100 - labelStamp.w);
    const maxY = Math.max(0, 100 - labelStamp.h);

    const move = (moveEvent: PointerEvent) => {
      const dx = ((moveEvent.clientX - startX) / rect.width) * 100;
      const dy = ((moveEvent.clientY - startY) / rect.height) * 100;
      setLabelPos({
        x: clamp(start.x + dx, 0, maxX),
        y: clamp(start.y + dy, 0, maxY),
      });
    };

    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  /* ---------- save ---------- */

  const save = async () => {
    if (!signatureUrl) {
      setError("Tambahkan tanda tangan terlebih dahulu.");
      return;
    }
    const stage = stageRef.current;
    const overlay = overlayRef.current;
    if (!stage || !overlay) return;

    const stageBox = stage.getBoundingClientRect();
    const overlayBox = overlay.getBoundingClientRect();

    setSaving(true);
    setError(null);

    try {
      const blob = await (await fetch(signatureUrl)).blob();
      const form = new FormData();
      form.set("signature", new File([blob], "tanda-tangan.png", { type: "image/png" }));
      form.set("page", String(pageIndex));
      form.set("x", String((overlayBox.left - stageBox.left) / stageBox.width));
      form.set("y", String((overlayBox.top - stageBox.top) / stageBox.height));
      form.set("width", String(overlayBox.width / stageBox.width));
      form.set("height", String(overlayBox.height / stageBox.height));

      if (labelStamp) {
        const labelBlob = await (await fetch(labelStamp.url)).blob();
        form.set(
          "label",
          new File([labelBlob], "nama-jabatan.png", { type: "image/png" })
        );
        form.set("label_page", String(pageIndex));
        form.set("label_x", String(labelPos.x / 100));
        form.set("label_y", String(labelPos.y / 100));
        form.set("label_width", String(labelStamp.w / 100));
        form.set("label_height", String(labelStamp.h / 100));
      }

      const response = await fetch(`/api/sign/${id}`, {
        method: "POST",
        body: form,
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Gagal menyimpan tanda tangan.");
      }

      close();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menandatangani.");
    } finally {
      setSaving(false);
    }
  };

  /* ---------- effects ---------- */

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        applyZoom(ZOOM_STEP);
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        applyZoom(1 / ZOOM_STEP);
      } else if (event.key === "0") {
        event.preventDefault();
        resetZoom();
      }
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    tabRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, close, applyZoom, resetZoom]);

  return (
    <>
      <button type="button" className="btn btn-primary btn-sm" onClick={openDialog}>
        {label}
      </button>

      {open && (
        <div
          className="sign-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`Tanda tangani dokumen ${code}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="sign-panel">
            <header className="sign-header">
              <div>
                <h2>Tanda tangani dokumen</h2>
                <p className="muted">{code} · Kepala Dusun</p>
              </div>
              <button
                type="button"
                className="sign-close"
                onClick={close}
                aria-label="Tutup"
              >
                ×
              </button>
            </header>

            <div className="sign-body">
              <div className="sign-preview-column">
                <div className="sign-preview" ref={previewRef}>
                  {loading && <div className="sign-loading">Memuat dokumen…</div>}
                  {loadError && <div className="alert alert-error">{loadError}</div>}

                  {!loading && !loadError && (
                    <div
                      className="sign-stage"
                      ref={stageRef}
                      style={{ width: pageBox.w, height: pageBox.h }}
                    >
                      {isPdf ? (
                        <canvas ref={canvasRef} className="sign-page" />
                      ) : (
                        imageUrl && (
                          <img
                            className="sign-page sign-page-image"
                            src={imageUrl}
                            alt="Dokumen pengajuan"
                            onLoad={(event) => {
                              const image = event.currentTarget;
                              setPageSize({
                                w: image.naturalWidth || 595,
                                h: image.naturalHeight || 842,
                              });
                            }}
                          />
                        )
                      )}

                      {signatureUrl && (
                        <div
                          ref={overlayRef}
                          className="sign-overlay"
                          style={{
                            left: `${position.x}%`,
                            top: `${position.y}%`,
                            width: `${position.w}%`,
                            aspectRatio: String(signatureAspect),
                          }}
                          onPointerDown={beginDrag}
                        >
                          <img src={signatureUrl} alt="Posisi tanda tangan" />
                          <span
                            className="sign-handle"
                            onPointerDown={beginResize}
                            aria-hidden="true"
                          />
                        </div>
                      )}

                      {labelStamp && (
                        <div
                          className="sign-label"
                          style={{
                            left: `${labelPos.x}%`,
                            top: `${labelPos.y}%`,
                            width: `${labelStamp.w}%`,
                            height: `${labelStamp.h}%`,
                          }}
                          onPointerDown={beginLabelDrag}
                          role="presentation"
                          title="Geser untuk mengatur posisi dan jarak teks"
                        >
                          <img src={labelStamp.url} alt="Nama dan jabatan" />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="sign-toolbar">
                  <div
                    className="sign-zoom"
                    role="group"
                    aria-label="Perbesaran halaman"
                  >
                    <button
                      type="button"
                      onClick={() => applyZoom(1 / ZOOM_STEP)}
                      disabled={zoom <= MIN_ZOOM}
                      aria-label="Perkecil halaman"
                      title="Perkecil (−)"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="sign-zoom-value"
                      onClick={resetZoom}
                      title="Kembalikan ke tampilan satu halaman penuh (0)"
                      aria-label={`Perbesaran ${Math.round(zoom * 100)} persen, klik untuk satu halaman`}
                    >
                      {Math.round(zoom * 100)}%
                    </button>
                    <button
                      type="button"
                      onClick={() => applyZoom(ZOOM_STEP)}
                      disabled={zoom >= MAX_ZOOM}
                      aria-label="Perbesar halaman"
                      title="Perbesar (+)"
                    >
                      +
                    </button>
                    <span className="sign-zoom-sep" aria-hidden="true" />
                    <button
                      type="button"
                      className={zoom === 1 ? "is-active" : ""}
                      onClick={resetZoom}
                      title="Tampilkan seluruh halaman"
                    >
                      Utuh
                    </button>
                    <button
                      type="button"
                      className={zoom === fitWidthZoom ? "is-active" : ""}
                      onClick={showFitWidth}
                      title="Penuhi lebar panel"
                    >
                      Lebar
                    </button>
                  </div>

                  {isPdf && numPages > 1 && (
                    <div className="sign-pager" role="group" aria-label="Navigasi halaman">
                      <button
                        type="button"
                        className="sign-pager-btn"
                        onClick={() => goToPage(pageIndex - 1)}
                        disabled={pageIndex === 0}
                        aria-label="Halaman sebelumnya"
                        title="Halaman sebelumnya"
                      >
                        ‹
                      </button>
                      <span className="sign-pager-count">
                        {pageIndex + 1}
                        <span className="muted"> / {numPages}</span>
                      </span>
                      <button
                        type="button"
                        className="sign-pager-btn"
                        onClick={() => goToPage(pageIndex + 1)}
                        disabled={pageIndex >= numPages - 1}
                        aria-label="Halaman berikutnya"
                        title="Halaman berikutnya"
                      >
                        ›
                      </button>
                    </div>
                  )}
                </div>

                <p className="sign-hint sign-zoom-hint">
                  {zoom > 1
                    ? "Geser halaman untuk melihat bagian lain, atau tekan Utuh untuk kembali ke satu halaman."
                    : "Gunakan + bila bagian tanda tangan sulit dibaca, lalu geser halaman."}
                </p>
              </div>

              <aside className="sign-aside">
                <div className="sign-aside-scroll">
                  <div className="sign-tabs" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      ref={tabRef}
                      aria-selected={mode === "draw"}
                      className={mode === "draw" ? "is-active" : ""}
                      onClick={() => setMode("draw")}
                    >
                      Gambar
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === "upload"}
                      className={mode === "upload" ? "is-active" : ""}
                      onClick={() => setMode("upload")}
                    >
                      Unggah
                    </button>
                  </div>

                  {mode === "draw" ? (
                    <>
                      <p className="sign-hint">
                        Gambar tanda tangan Anda di kotak putih ini (mouse atau
                        layar sentuh).
                      </p>
                      <canvas
                        ref={padRef}
                        className="sign-pad"
                        onPointerDown={onPadDown}
                        onPointerMove={onPadMove}
                        onPointerUp={onPadUp}
                        onPointerLeave={onPadUp}
                      />
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={clearPad}
                      >
                        Hapus gambar
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="sign-hint">
                        Unggah foto tanda tangan (PNG/JPG, latar putih lebih rapi).
                      </p>
                      <input
                        className="input"
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={onUpload}
                      />
                    </>
                  )}

                  <div className="sign-caption">
                    <div className="sign-caption-head">
                      <span>Nama &amp; jabatan</span>
                      <span className="sign-caption-tag">elemen terpisah</span>
                    </div>
                    <input
                      className="input"
                      value={signName}
                      onChange={(event) => {
                        setSignName(event.target.value);
                        if (event.target.value.trim()) placeLabelUnderSignature();
                      }}
                      placeholder="Nama penanda tangan"
                      maxLength={60}
                      aria-label="Nama penanda tangan"
                    />
                    <input
                      className="input"
                      value={signRole}
                      onChange={(event) => {
                        setSignRole(event.target.value);
                        if (event.target.value.trim()) placeLabelUnderSignature();
                      }}
                      placeholder="Jabatan (mis. Kepala Dusun Permata Anyar)"
                      maxLength={80}
                      aria-label="Jabatan penanda tangan"
                    />

                    <div className="sign-text-tools">
                      <label className="sign-tool-field">
                        <span>Ukuran</span>
                        <input
                          type="number"
                          min={6}
                          max={24}
                          step={0.5}
                          value={fontSize}
                          onChange={(event) =>
                            setFontSize(
                              clamp(Number(event.target.value) || 10, 6, 24)
                            )
                          }
                          aria-label="Ukuran huruf dalam poin"
                        />
                        <span className="sign-tool-unit">pt</span>
                      </label>
                      <label className="sign-tool-field">
                        <span>Jarak</span>
                        <input
                          type="number"
                          min={-1}
                          max={5}
                          step={0.1}
                          value={letterSpacing}
                          onChange={(event) =>
                            setLetterSpacing(
                              clamp(Number(event.target.value) || 0, -1, 5)
                            )
                          }
                          aria-label="Jarak antar huruf dalam poin"
                        />
                        <span className="sign-tool-unit">pt</span>
                      </label>
                      <div className="sign-text-style" role="group" aria-label="Gaya huruf">
                        <button
                          type="button"
                          aria-pressed={textBold}
                          className={textBold ? "is-active" : ""}
                          style={{ fontWeight: 800 }}
                          onClick={() => setTextBold((value) => !value)}
                          title="Tebal"
                        >
                          B
                        </button>
                        <button
                          type="button"
                          aria-pressed={textItalic}
                          className={textItalic ? "is-active" : ""}
                          style={{ fontStyle: "italic" }}
                          onClick={() => setTextItalic((value) => !value)}
                          title="Miring"
                        >
                          I
                        </button>
                        <button
                          type="button"
                          aria-pressed={textUnderline}
                          className={textUnderline ? "is-active" : ""}
                          style={{ textDecoration: "underline" }}
                          onClick={() => setTextUnderline((value) => !value)}
                          title="Garis bawah"
                        >
                          U
                        </button>
                      </div>
                    </div>

                    <p className="sign-hint">
                      Teks ini punya posisi sendiri. Geser di halaman untuk mengatur
                      jarak dari tanda tangan; kosongkan bila tidak diperlukan.
                    </p>
                  </div>

                  {signatureUrl && (
                    <div className="sign-preview-thumb">
                      <span className="muted">Pratinjau tanda tangan</span>
                      <img src={signatureUrl} alt="Pratinjau tanda tangan" />
                    </div>
                  )}

                  <p className="sign-hint">
                    Geser tanda tangan pada halaman untuk mengatur posisi, dan tarik
                    sudut kanan bawah untuk mengubah ukuran.
                  </p>

                  <p className="sign-legal">
                    Tanda tangan ini ditempelkan secara visual ke PDF, bukan
                    sertifikat digital tersertifikasi.
                  </p>
                </div>

                <div className="sign-aside-foot">
                  {error && <div className="alert alert-error">{error}</div>}

                  <div className="sign-actions">
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={close}
                      disabled={saving}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={save}
                      disabled={saving || !signatureUrl || loading}
                    >
                      {saving ? "Menyimpan…" : "Simpan & Tandatangani"}
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Returns a PNG data URL trimmed to the drawn strokes, or "" when empty. */
function trimCanvas(canvas: HTMLCanvasElement): string {
  const context = canvas.getContext("2d");
  if (!context) return "";
  const { width, height } = canvas;
  if (width === 0 || height === 0) return "";

  const { data } = context.getImageData(0, 0, width, height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return "";

  const padding = 8;
  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const right = Math.min(width, maxX + padding);
  const bottom = Math.min(height, maxY + padding);

  const output = document.createElement("canvas");
  output.width = right - left;
  output.height = bottom - top;
  const outputContext = output.getContext("2d");
  if (!outputContext) return "";

  outputContext.drawImage(
    canvas,
    left,
    top,
    output.width,
    output.height,
    0,
    0,
    output.width,
    output.height
  );

  return output.toDataURL("image/png");
}
