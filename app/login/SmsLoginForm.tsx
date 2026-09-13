"use client";

import { useState } from "react";
import { requestSmsLoginCode, verifySmsLoginCode } from "@/app/actions/smsLogin";

export default function SmsLoginForm() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    const result = await requestSmsLoginCode(phone);
    setBusy(false);
    if (result.error) return setError(result.error);
    setSent(true);
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const result = await verifySmsLoginCode(phone, code);
    setBusy(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{error}</div>}
      <label className="block space-y-2">
        <span className="text-sm font-semibold text-on-surface-variant">Número de teléfono</span>
        <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={sent} placeholder="494 123 4567" className="w-full rounded-xl border border-outline-variant bg-surface-dim/60 px-4 py-3 text-sm outline-none focus:border-primary disabled:opacity-70" />
      </label>
      {sent && (
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">Código recibido por SMS</span>
          <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Código" className="w-full rounded-xl border border-outline-variant bg-surface-dim/60 px-4 py-3 text-center font-mono text-xl tracking-[0.3em] outline-none focus:border-primary" />
        </label>
      )}
      <button type="button" onClick={sent ? verify : send} disabled={busy || (sent ? code.length < 4 : phone.length < 10)} className="w-full rounded-xl bg-primary py-3 font-bold text-on-primary transition active:scale-[0.97] disabled:opacity-50">
        {busy ? "Espera..." : sent ? "Confirmar código" : "Enviar código por SMS"}
      </button>
      {sent && <button type="button" onClick={() => { setSent(false); setCode(""); setError(null); }} className="w-full text-xs font-semibold text-on-surface-variant hover:text-primary">Cambiar número</button>}
      <p className="text-center text-xs text-outline">La sesión permanecerá guardada en este dispositivo.</p>
    </div>
  );
}
