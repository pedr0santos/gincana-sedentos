import { trpc } from "@/lib/trpc";
import { Loader2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

export default function Register() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmation: "" });
  const register = trpc.auth.register.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      setLocation("/cadastro");
    },
    onError: error => toast.error(error.message),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (form.password !== form.confirmation) return toast.error("As senhas não conferem.");
    register.mutate({ name: form.name, email: form.email, password: form.password });
  }

  return <div className="auth-screen"><div className="glass-card auth-panel">
    <button className="brand-mark" onClick={() => setLocation("/")}><span className="brand-orbit" /><span>SEDENTOS</span></button>
    <h1 className="auth-title">Crie sua <em>conta.</em></h1>
    <p className="auth-copy">Cadastre seu acesso e depois complete seu perfil de participante.</p>
    <form className="mt-6 space-y-4" onSubmit={submit}>
      <label><span className="field-label">Nome</span><input className="dark-input" autoComplete="name" required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
      <label><span className="field-label">E-mail</span><input className="dark-input" type="email" autoComplete="email" required value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label>
      <label><span className="field-label">Senha</span><input className="dark-input" type="password" autoComplete="new-password" minLength={8} required value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></label>
      <label><span className="field-label">Confirme a senha</span><input className="dark-input" type="password" autoComplete="new-password" minLength={8} required value={form.confirmation} onChange={event => setForm({ ...form, confirmation: event.target.value })} /></label>
      <button className="primary-action mx-auto" disabled={register.isPending} type="submit">{register.isPending ? <Loader2 size={17} className="animate-spin" /> : <UserPlus size={17} />} Cadastrar</button>
    </form>
    <p className="mt-6 text-center text-sm text-teal-100">Já possui conta? <Link href="/login">Entrar</Link></p>
  </div></div>;
}
