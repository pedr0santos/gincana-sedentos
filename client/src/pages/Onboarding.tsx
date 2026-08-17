import { useAuth } from "@/_core/hooks/useAuth";
import { GameNav } from "@/components/GameNav";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Check, ImageUp, Loader2, LockKeyhole } from "lucide-react";
import { ChangeEvent, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Onboarding() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { data: teams = [] } = trpc.game.teams.useQuery();
  const completeProfile = trpc.game.completeProfile.useMutation({ onSuccess: () => { toast.success("Equipe confirmada. Sua jornada começa agora!"); setLocation("/"); } });
  const upload = trpc.game.uploadMedia.useMutation();
  const [form, setForm] = useState({ fullName: "", nickname: "", contact: "", teamId: 0 });
  const [avatar, setAvatar] = useState<{ url: string; key: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  async function onAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(png|jpeg|webp)$/)) return toast.error("Escolha uma imagem PNG, JPEG ou WEBP.");
    try {
      setUploading(true);
      const dataUrl = await readFile(file);
      const result = await upload.mutateAsync({ dataUrl, fileName: file.name, category: "avatar" });
      setAvatar(result);
      toast.success("Foto carregada com segurança.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a foto.");
    } finally { setUploading(false); }
  }

  if (loading) return <div className="auth-screen"><Loader2 className="animate-spin text-teal-200" /></div>;
  if (!user) return <div className="auth-screen"><div className="glass-card auth-panel"><button className="brand-mark"><span className="brand-orbit" /><span>SEDENTOS</span></button><h1 className="auth-title">Entre na <em>arena.</em></h1><p className="auth-copy">Use sua conta para participar. A segurança do acesso é administrada pelo provedor de autenticação da plataforma.</p><button className="primary-action mx-auto" onClick={() => startLogin()}><LockKeyhole size={17} /> Entrar para continuar</button></div></div>;

  return <div className="app-bg"><GameNav /><main className="page-shell"><p className="eyebrow">Etapa 1 de 1 · perfil do participante</p><h1 className="page-title">Escolha seu lado. <span className="text-teal-200">E sustente até o fim.</span></h1><p className="page-intro">A equipe escolhida fica bloqueada para você. Somente a administração poderá alterá-la depois do cadastro.</p>
    <form className="glass-card form-card" onSubmit={event => { event.preventDefault(); if (!form.teamId) return toast.error("Selecione a sua equipe."); completeProfile.mutate({ ...form, avatarUrl: avatar?.url, avatarKey: avatar?.key }); }}>
      <div className="form-grid">
        <label><span className="field-label">Nome completo</span><input required className="dark-input" placeholder="Como aparece no evento" value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })} /></label>
        <label><span className="field-label">Apelido</span><input required className="dark-input" placeholder="Como a galera te chama" value={form.nickname} onChange={event => setForm({ ...form, nickname: event.target.value })} /></label>
        <label><span className="field-label">E-mail ou telefone</span><input required className="dark-input" placeholder="seu@email.com ou (00) 00000-0000" value={form.contact} onChange={event => setForm({ ...form, contact: event.target.value })} /></label>
        <div className="avatar-upload"><img className="avatar-preview" src={avatar?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(form.nickname || user.name || "S")}&background=174f4d&color=ffffff`} alt="Prévia do perfil" /><label className="cursor-pointer"><span className="field-label mb-1">Foto de perfil opcional</span><span className="text-xs text-teal-100">{uploading ? "Enviando..." : "Selecionar imagem"}</span><input disabled={uploading} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onAvatarChange} /></label><ImageUp className="ml-auto text-teal-200" size={19} /></div>
      </div>
      <div className="mt-7"><span className="field-label">Selecione sua equipe</span><div className="team-picker">{teams.map(team => <button type="button" key={team.id} className={form.teamId === team.id ? "team-choice selected" : "team-choice"} style={{ "--team": team.color } as React.CSSProperties} onClick={() => setForm({ ...form, teamId: team.id })}><div className="team-choice-top"><span className="team-avatar" style={{ background: team.color }}>{team.symbol}</span>{team.name}{form.teamId === team.id && <Check className="ml-auto" size={16} />}</div><p>{team.description}</p></button>)}</div></div>
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3"><p className="max-w-md text-xs leading-5 text-slate-400"><LockKeyhole className="mr-1 inline" size={13} /> A equipe não pode ser trocada livremente após a confirmação.</p><button disabled={completeProfile.isPending || uploading} className="primary-action mt-0" type="submit">{completeProfile.isPending && <Loader2 size={15} className="animate-spin" />} Confirmar equipe</button></div>
    </form>
  </main></div>;
}
