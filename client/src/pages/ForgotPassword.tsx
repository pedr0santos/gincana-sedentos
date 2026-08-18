import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const requestReset = trpc.auth.requestPasswordReset.useMutation({ onError: error => toast.error(error.message) });
  const submitted = requestReset.isSuccess;

  return <div className="auth-screen"><div className="glass-card auth-panel">
    <Link className="mb-6 inline-flex items-center gap-2 text-sm text-teal-100" href="/login"><ArrowLeft size={15} /> Voltar para o login</Link>
    <h1 className="auth-title">Recupere o <em>acesso.</em></h1>
    <p className="auth-copy">{submitted ? "Se o e-mail estiver cadastrado, enviaremos um link para redefinir sua senha." : "Informe seu e-mail e enviaremos um link para criar uma nova senha."}</p>
    {!submitted && <form className="mt-6 space-y-4" onSubmit={event => { event.preventDefault(); requestReset.mutate({ email }); }}>
      <label><span className="field-label">E-mail</span><input className="dark-input" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
      <button className="primary-action mx-auto" disabled={requestReset.isPending} type="submit">{requestReset.isPending ? <Loader2 size={17} className="animate-spin" /> : <Mail size={17} />} Enviar link</button>
    </form>}
    {submitted && <Link className="primary-action mx-auto mt-6" href="/login">Voltar ao login</Link>}
  </div></div>;
}
