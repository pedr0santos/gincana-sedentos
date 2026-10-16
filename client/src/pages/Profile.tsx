import { useAuth } from "@/_core/hooks/useAuth";
import { GameNav } from "@/components/GameNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ImageUp, Loader2, LockKeyhole, Save, Trash2, UserRound } from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
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

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const profileQuery = trpc.game.myProfile.useQuery(undefined, { enabled: Boolean(user), refetchOnMount: "always" });
  const upload = trpc.game.uploadMedia.useMutation();
  const updateProfile = trpc.game.updateMyProfile.useMutation();
  const [form, setForm] = useState({ fullName: "", nickname: "", contact: "" });
  const [avatarKey, setAvatarKey] = useState<string | null | undefined>(undefined);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState<number | null>(null);

  const profile = profileQuery.data;
  useEffect(() => {
    if (!profile) return;
    setForm({ fullName: profile.fullName, nickname: profile.nickname, contact: profile.contact });
    setAvatarKey(undefined);
    setAvatarPreview(null);
    setRemoveAvatar(false);
  }, [profile]);

  async function onAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
      toast.error("Escolha uma imagem PNG, JPEG ou WEBP.");
      event.target.value = "";
      return;
    }
    try {
      const dataUrl = await readFile(file);
      const result = await upload.mutateAsync({ dataUrl, fileName: file.name, category: "avatar" });
      setAvatarKey(result.key);
      setAvatarPreview(dataUrl);
      setRemoveAvatar(false);
      toast.success("Nova foto carregada. Salve o perfil para confirmar a alteração.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a foto.");
    } finally {
      event.target.value = "";
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const avatarChanged = avatarKey !== undefined;
      await updateProfile.mutateAsync({
        ...form,
        ...(avatarKey !== undefined ? { avatarKey } : {}),
      });
      await Promise.all([utils.game.myProfile.invalidate(), utils.auth.me.invalidate()]);
      if (avatarChanged) setAvatarVersion(Date.now());
      setAvatarKey(undefined);
      setAvatarPreview(null);
      setRemoveAvatar(false);
      toast.success("Perfil atualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o perfil.");
    }
  }

  if (authLoading || (user && profileQuery.isLoading)) {
    return <div className="auth-screen"><Loader2 className="animate-spin text-teal-200" /></div>;
  }

  if (!user) {
    return <div className="app-bg"><GameNav /><main className="page-shell"><section className="glass-card empty-panel"><UserRound className="mx-auto mb-3 text-teal-200" /><p>Entre na sua conta para acessar seu perfil.</p><Button className="mt-4" onClick={() => setLocation("/login")}>Entrar</Button></section></main></div>;
  }

  if (profileQuery.isError) {
    return <div className="app-bg"><GameNav /><main className="page-shell"><section className="glass-card empty-panel" role="alert"><p>Não foi possível carregar seu perfil.</p><Button variant="ghost" className="mt-3" onClick={() => void profileQuery.refetch()}>Tentar novamente</Button></section></main></div>;
  }

  if (!profile) {
    return <div className="app-bg"><GameNav /><main className="page-shell"><section className="glass-card empty-panel"><p>Conclua seu cadastro para editar o perfil.</p><Button className="mt-4" onClick={() => setLocation("/cadastro")}>Concluir cadastro</Button></section></main></div>;
  }

  const shownAvatar = avatarPreview ?? (removeAvatar ? null : profile.avatarUrl);
  const avatarSrc = shownAvatar?.startsWith("/api/media/avatar/") && avatarVersion
    ? `${shownAvatar}?v=${avatarVersion}`
    : shownAvatar;
  const initials = form.fullName.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join("").toUpperCase();
  const isSaving = updateProfile.isPending || upload.isPending;

  return <div className="app-bg"><GameNav /><main className="page-shell">
    <p className="eyebrow">Conta do participante</p>
    <h1 className="page-title">Meu <span className="text-teal-200">perfil.</span></h1>
    <p className="page-intro">Mantenha seus dados atualizados. Sua equipe permanece vinculada ao cadastro.</p>
    <section className="mt-8 grid items-start gap-4 lg:grid-cols-[1.2fr_.8fr]">
      <form className="glass-card min-w-0 p-5 sm:p-7" onSubmit={onSubmit}>
        <div className="flex flex-wrap items-center gap-4 border-b border-white/10 pb-6">
          <Avatar className="size-20 border border-white/15">
            {avatarSrc && <AvatarImage key={avatarSrc} src={avatarSrc} alt={`Foto de ${form.fullName || "perfil"}`} className="object-cover" />}
            <AvatarFallback className="bg-teal-900 text-lg font-bold text-white">{initials || "?"}</AvatarFallback>
          </Avatar>
          <div className="flex flex-wrap items-center gap-2">
            <label className={`secondary-action cursor-pointer ${isSaving ? "pointer-events-none opacity-50" : ""}`}>
              <ImageUp size={16} /> Alterar foto
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={isSaving} onChange={onAvatarChange} />
            </label>
            {shownAvatar && <Button type="button" variant="ghost" aria-label="Remover foto" title="Remover foto" disabled={isSaving} onClick={() => { setAvatarKey(null); setAvatarPreview(null); setRemoveAvatar(true); }}>
              <Trash2 size={16} /> Remover
            </Button>}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="field-label">Nome completo</span><input required minLength={3} maxLength={140} className="dark-input" autoComplete="name" value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })} /></label>
          <label><span className="field-label">Apelido</span><input required minLength={2} maxLength={80} className="dark-input" autoComplete="nickname" value={form.nickname} onChange={event => setForm({ ...form, nickname: event.target.value })} /></label>
          <label><span className="field-label">Contato do perfil (e-mail ou telefone)</span><input required minLength={5} maxLength={320} className="dark-input" value={form.contact} onChange={event => setForm({ ...form, contact: event.target.value })} /></label>
          <label className="sm:col-span-2"><span className="field-label">E-mail de acesso</span><input readOnly className="dark-input cursor-not-allowed opacity-65" value={user.email ?? "Não informado"} aria-describedby="login-email-note" /><span id="login-email-note" className="mt-1 block text-xs text-slate-400">Este e-mail é usado para entrar na conta e não é alterado nesta página.</span></label>
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-end gap-3 border-t border-white/10 pt-5">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isSaving ? "Salvando..." : "Salvar perfil"}
          </Button>
        </div>
      </form>

      <aside className="glass-card min-w-0 p-5 sm:p-7" aria-labelledby="profile-team-title">
        <p className="eyebrow">Equipe atual</p>
        <h2 id="profile-team-title" className="mt-2 font-display text-xl font-bold">Seu grupo na gincana</h2>
        <div className="mt-6 flex items-center gap-4 border-y border-white/10 py-5">
          <span className="team-avatar h-14 w-14 text-2xl" style={{ background: `linear-gradient(135deg, ${profile.teamColor}, ${profile.teamAccentColor})` }}>{profile.teamSymbol}</span>
          <div className="min-w-0"><p className="team-name text-base">{profile.teamName}</p><p className="mt-1 truncate text-xs text-slate-400">{profile.teamSlug}</p></div>
        </div>
        <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-slate-300"><LockKeyhole className="mt-1 shrink-0 text-teal-200" size={15} />A equipe é definida no cadastro e só pode ser alterada pela administração.</p>
      </aside>
    </section>
  </main></div>;
}
