import { trpc } from "@/lib/trpc";
import { ArrowLeft, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const reset = trpc.auth.resetPassword.useMutation({
    onSuccess: () => { toast.success("Senha redefinida. Faça login novamente."); setLocation("/login"); },
    onError: error => toast.error(error.message),
  });

  return <div className="auth-screen"><div className="glass-card auth-panel">
    <Link className="mb-6 inline-flex items-center gap-2 text-sm text-teal-100" href="/login"><ArrowLeft size={15} /> Voltar para o login</Link>
    <h1 className="auth-title">Nova <em>senha.</em></h1>
    <p className="auth-copy">Escolha uma senha com pelo menos 8 caracteres.</p>
    <form className="mt-6 space-y-4" onSubmit={event => { event.preventDefault(); if (password !== confirmation) return toast.error("As senhas não conferem."); reset.mutate({ token, password }); }}>
      <label><span className="field-label">Nova senha</span><input className="dark-input" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} /></label>
      <label><span className="field-label">Confirme a senha</span><input className="dark-input" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
      <button className="primary-action mx-auto" disabled={reset.isPending || token.length < 32} type="submit">{reset.isPending ? <Loader2 size={17} className="animate-spin" /> : <KeyRound size={17} />} Salvar senha</button>
    </form>
  </div></div>;
}
