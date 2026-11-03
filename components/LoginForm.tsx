"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/actions";

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <form action={formAction} className="card" style={{ maxWidth: 400, margin: "0 auto" }}>
      <div className="text-center mb-24">
        <h1 className="page-title" style={{ fontSize: 24 }}>Panel Admin</h1>
        <p className="muted">Masukkan PIN untuk mengakses antrean tanda tangan.</p>
      </div>

      {state?.error && <div className="alert alert-error">{state.error}</div>}

      <div className="field">
        <label className="label">PIN</label>
        <input
          className="input mono"
          name="pin"
          type="password"
          inputMode="numeric"
          autoFocus
          placeholder="••••••"
        />
      </div>

      <button type="submit" className="btn btn-primary btn-block" disabled={isPending}>
        {isPending ? "Memverifikasi…" : "Masuk"}
      </button>

      <p className="hint text-center mt-16">
        PIN demo: <span className="mono">UBK2024</span> (ubah lewat env <span className="mono">ADMIN_PIN</span>)
      </p>
    </form>
  );
}
