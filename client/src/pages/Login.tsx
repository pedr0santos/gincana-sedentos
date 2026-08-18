import { trpc } from "@/lib/trpc";
import { Loader2, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

export default function Login() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      setLocation("/");
    },
    onError: error => toast.error(error.message),
  });

  return <div className="auth-screen"><div className="glass-card auth-panel">
    <button className="brand-mark" onClick={() => setLocation("/")}><span className="brand-orbit" /><span>SEDENTOS</span></button>
    <h1 className="auth-title">Entre na <em>arena.</em></h1>
    <p className="auth-copy">Acesse sua conta para responder rodadas e acompanhar sua equipe.</p>
    <form className="mt-6 space-y-4" onSubmit={event => { event.preventDefault(); login.mutate({ email, password }); }}>
      <label><span className="field-label">E-mail</span><input className="dark-input" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label><span className="field-label">Senha</span><input className="dark-input" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
      <button className="primary-action mx-auto" disabled={login.isPending} type="submit">{login.isPending ? <Loader2 size={17} className="animate-spin" /> : <LockKeyhole size={17} />} Entrar</button>
    </form>
    <div className="mt-6 flex flex-col gap-2 text-center text-sm text-teal-100"><Link href="/esqueci-senha">Esqueci minha senha</Link><Link href="/cadastro-conta">Criar uma conta</Link></div>
  </div></div>;
}
