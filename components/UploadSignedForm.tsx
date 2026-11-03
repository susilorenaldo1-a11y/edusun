"use client";

import { useActionState } from "react";
import { uploadSignedPdfAction } from "@/lib/actions";

export default function UploadSignedForm({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(
    uploadSignedPdfAction,
    null
  );

  return (
    <form
      action={formAction}
      className="flex gap-8"
      style={{ alignItems: "center", flexWrap: "wrap" }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="file" name="signed_pdf" accept=".pdf" required />
      <button type="submit" className="btn btn-primary btn-sm" disabled={isPending}>
        {isPending ? "Mengunggah…" : "Unggah PDF TTD"}
      </button>
      {state?.error && (
        <span className="muted" style={{ fontSize: 12.5, color: "var(--danger)" }}>
          {state.error}
        </span>
      )}
    </form>
  );
}
