import { trpc } from "@/lib/trpc";
import { Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

export default function Login() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      <label><span className="mt-4 field-label">Senha</span><div className="relative"><input className="dark-input pr-10" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /><button className="absolute right-2 top-1/2 -translate-y-1/2 text-teal-100" type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} title={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
      <button className="primary-action mx-auto" disabled={login.isPending} type="submit">{login.isPending ? <Loader2 size={17} className="animate-spin" /> : <LockKeyhole size={17} />} Entrar</button>
    </form>
    <div className="mt-6 flex flex-col gap-2 text-center text-sm text-teal-100"><Link href="/esqueci-senha">Esqueci minha senha</Link><Link href="/cadastro-conta">Criar uma conta</Link></div>
  </div></div>;
}
