"use client";

import { deletePermanentlyAction } from "@/lib/actions";

export default function DeletePermanentlyButton({ id }: { id: string }) {
  return (
    <form
      action={deletePermanentlyAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Hapus permanen dokumen ini? Tindakan ini tidak bisa dibatalkan."
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn btn-danger btn-sm">
        Hapus Permanen
      </button>
    </form>
  );
}
