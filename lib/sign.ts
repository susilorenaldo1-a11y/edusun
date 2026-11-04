import { PDFDocument, type PDFImage } from "pdf-lib";

/**
 * Applies a visual signature image onto a submitted document.
 *
 * This is a stamped signature ("tanda tangan basah digital"), not a
 * certificate-based electronic signature. The original document content is
 * preserved and only the signature image is added.
 */

export interface Placement {
  /** Zero-based page index. */
  page: number;
  /** Normalised 0..1 coordinates measured from the top-left of the page. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SignInput {
  file: { data: Buffer; type: string; name: string };
  signature: Uint8Array;
  placement: Placement;
  /** Optional printed name/role, stamped with its own placement. */
  label?: { data: Uint8Array; placement: Placement };
  signer?: string;
}

const clamp = (value: number, min = 0, max = 1) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;

function signatureKind(bytes: Uint8Array): "png" | "jpg" | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
  return null;
}

function isPdfType(type: string, name: string): boolean {
  return (
    type.toLowerCase().includes("pdf") || name.toLowerCase().endsWith(".pdf")
  );
}

function isPngFile(type: string, name: string): boolean {
  return type.toLowerCase().includes("png") || name.toLowerCase().endsWith(".png");
}

export async function stampSignature(input: SignInput): Promise<Uint8Array> {
  const kind = signatureKind(input.signature);
  if (!kind) {
    throw new Error("Tanda tangan harus berupa gambar PNG atau JPG.");
  }

  const { page: pageIndex, x, y, width, height } = input.placement;
  if (!Number.isInteger(pageIndex) || pageIndex < 0) {
    throw new Error("Halaman tanda tangan tidak valid.");
  }

  const isPdf = isPdfType(input.file.type, input.file.name);
  let pdf: PDFDocument;

  if (isPdf) {
    pdf = await PDFDocument.load(input.file.data, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
  } else {
    // Image submissions become a one-page PDF first, so they can be signed too.
    pdf = await PDFDocument.create();
    const source = isPngFile(input.file.type, input.file.name)
      ? await pdf.embedPng(input.file.data)
      : await pdf.embedJpg(input.file.data);
    const scale = 0.75; // 96 dpi image pixels -> PDF points
    const page = pdf.addPage([source.width * scale, source.height * scale]);
    page.drawImage(source, {
      x: 0,
      y: 0,
      width: page.getWidth(),
      height: page.getHeight(),
    });
  }

  const pages = pdf.getPages();
  const target = pages[pageIndex];
  if (!target) {
    throw new Error("Halaman tanda tangan melewati jumlah halaman dokumen.");
  }

  let signatureImage: PDFImage;
  if (kind === "png") {
    signatureImage = await pdf.embedPng(input.signature);
  } else {
    signatureImage = await pdf.embedJpg(input.signature);
  }

  const pageWidth = target.getWidth();
  const pageHeight = target.getHeight();

  const w = clamp(width) * pageWidth;
  const h = clamp(height) * pageHeight;
  const left = clamp(x) * pageWidth;
  const top = clamp(y) * pageHeight;

  if (w < 8 || h < 8) {
    throw new Error("Ukuran tanda tangan terlalu kecil.");
  }

  // Printed name/role goes first so the signature image stays on top.
  if (input.label) {
    const labelKind = signatureKind(input.label.data);
    if (labelKind) {
      const labelPage = pages[input.label.placement.page] ?? target;
      const labelWidthPt = labelPage.getWidth();
      const labelHeightPt = labelPage.getHeight();
      const lp = input.label.placement;
      const lw = clamp(lp.width) * labelWidthPt;
      const lh = clamp(lp.height) * labelHeightPt;
      const lx = clamp(lp.x) * labelWidthPt;
      const ly = clamp(lp.y) * labelHeightPt;

      if (lw >= 4 && lh >= 4) {
        const image =
          labelKind === "png"
            ? await pdf.embedPng(input.label.data)
            : await pdf.embedJpg(input.label.data);
        labelPage.drawImage(image, {
          x: lx,
          y: labelHeightPt - ly - lh,
          width: lw,
          height: lh,
        });
      }
    }
  }

  target.drawImage(signatureImage, {
    x: left,
    y: pageHeight - top - h,
    width: w,
    height: h,
  });

  pdf.setProducer("E-Dusun");
  pdf.setCreator("E-Dusun — Layanan Administrasi Dusun");
  pdf.setAuthor(input.signer?.trim() || "Kepala Dusun");
  pdf.setModificationDate(new Date());

  return pdf.save();
}
