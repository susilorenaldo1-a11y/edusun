"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter } from "next/navigation";

interface Props {
  id: string;
  code: string;
}

interface Position {
  /** Percentages of the preview box. */
  x: number;
  y: number;
  w: number;
}

const DEFAULT_POSITION: Position = { x: 60, y: 74, w: 30 };

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export default function SignPdfDialog({ id, code }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(true);
  const [numPages, setNumPages] = useState(1);
  const [pageIndex, setPageIndex] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [signatureAspect, setSignatureAspect] = useState(2.6);
  const [mode, setMode] = useState<"draw" | "upload">("draw");
  const [position, setPosition] = useState<Position>(DEFAULT_POSITION);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<{ destroy: () => Promise<void> } | null>(null);
  const draggingRef = useRef(false);
  const drawingRef = useRef(false);

  const tabRef = useRef<HTMLButtonElement>(null);

  /* ---------- open / load document ---------- */

  const close = useCallback(() => {
    setOpen(false);
    setLoading(false);
    setSignatureUrl(null);
    setError(null);
    setLoadError(null);
    setPosition(DEFAULT_POSITION);
    setPageIndex(0);
    pdfDocRef.current?.destroy().catch(() => undefined);
    pdfDocRef.current = null;
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

    try {
      const response = await fetch(`/api/file/${id}`);
      if (!response.ok) throw new Error("Dokumen tidak dapat dimuat.");
      const blob = await response.blob();
      const type = blob.type.toLowerCase();

      if (type.includes("pdf") || blob.size > 0) {
        if (type.includes("pdf")) {
          const pdfjs = await import("pdfjs-dist");
          pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
          const data = new Uint8Array(await blob.arrayBuffer());
          const doc = await pdfjs.getDocument({ data }).promise;
          pdfDocRef.current = doc as unknown as {
            destroy: () => Promise<void>;
          };
          setNumPages(doc.numPages);
          setIsPdf(true);
          setPageIndex(0);
          setLoading(false);
          return;
        }
      }

      setImageUrl(URL.createObjectURL(blob));
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

  /* ---------- PDF page rendering ---------- */

  useEffect(() => {
    if (!open || !isPdf || loading) return;
    let cancelled = false;

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
          }) => { promise: Promise<void> };
        }>;
      } | null;
      const canvas = canvasRef.current;
      const holder = previewRef.current;
      if (!doc || !canvas || !holder) return;

      const page = await doc.getPage(pageIndex + 1);
      if (cancelled) return;

      const base = page.getViewport({ scale: 1 });
      const width = holder.clientWidth || 640;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: (width / base.width) * ratio });
      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = "100%";
      canvas.style.height = "auto";

      await page.render({ canvasContext: context, canvas, viewport }).promise;
    };

    render().catch(() => setLoadError("Halaman dokumen gagal dirender."));
    return () => {
      cancelled = true;
    };
  }, [open, isPdf, loading, pageIndex, numPages]);

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
    if (url) {
      setSignatureUrl(url);
      setSignatureAspect(2.6);
      setPosition(DEFAULT_POSITION);
    }
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

  /* ---------- drag & resize on the page ---------- */

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!signatureUrl) return;
    const preview = previewRef.current;
    if (!preview) return;
    event.preventDefault();
    draggingRef.current = true;
    const rect = preview.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const start = position;

    const move = (moveEvent: PointerEvent) => {
      if (!draggingRef.current) return;
      const dx = ((moveEvent.clientX - startX) / rect.width) * 100;
      const dy = ((moveEvent.clientY - startY) / rect.height) * 100;
      setPosition((prev) => {
        const heightPct = (prev.w / 100) * (rect.width / rect.height) / signatureAspect * 100;
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
    const preview = previewRef.current;
    if (!preview) return;
    const rect = preview.getBoundingClientRect();
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

  /* ---------- save ---------- */

  const save = async () => {
    if (!signatureUrl) {
      setError("Tambahkan tanda tangan terlebih dahulu.");
      return;
    }
    const preview = previewRef.current;
    const overlay = overlayRef.current;
    if (!preview || !overlay) return;

    const previewBox = preview.getBoundingClientRect();
    const overlayBox = overlay.getBoundingClientRect();

    setSaving(true);
    setError(null);

    try {
      const blob = await (await fetch(signatureUrl)).blob();
      const form = new FormData();
      form.set("signature", new File([blob], "tanda-tangan.png", { type: "image/png" }));
      form.set("page", String(pageIndex));
      form.set("x", String((overlayBox.left - previewBox.left) / previewBox.width));
      form.set("y", String((overlayBox.top - previewBox.top) / previewBox.height));
      form.set("width", String(overlayBox.width / previewBox.width));
      form.set("height", String(overlayBox.height / previewBox.height));

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
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    tabRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, close]);

  return (
    <>
      <button type="button" className="btn btn-primary btn-sm" onClick={openDialog}>
        Tanda tangani PDF
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
                    <>
                      {isPdf ? (
                        <canvas ref={canvasRef} className="sign-page" />
                      ) : (
                        imageUrl && (
                          <img
                            className="sign-page"
                            src={imageUrl}
                            alt="Dokumen pengajuan"
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
                    </>
                  )}
                </div>

                {isPdf && numPages > 1 && (
                  <div className="sign-pager">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setPageIndex((index) => Math.max(0, index - 1))}
                      disabled={pageIndex === 0}
                    >
                      ← Sebelumnya
                    </button>
                    <span className="muted">
                      Halaman {pageIndex + 1} dari {numPages}
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() =>
                        setPageIndex((index) => Math.min(numPages - 1, index + 1))
                      }
                      disabled={pageIndex >= numPages - 1}
                    >
                      Berikutnya →
                    </button>
                  </div>
                )}
              </div>

              <aside className="sign-aside">
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
                      Tanda tangan di kotak putih ini (bisa pakai mouse atau layar
                      sentuh).
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

                <p className="sign-legal">
                  Tanda tangan ini ditempelkan secara visual ke PDF, bukan
                  sertifikat digital tersertifikasi.
                </p>
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
