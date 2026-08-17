import { useAuth } from "@/_core/hooks/useAuth";
import { GameNav } from "@/components/GameNav";
import { RoundAlerts } from "@/components/RoundAlerts";
import { startLogin } from "@/const";
import { formatPoints, formatTime, getCountdown, stateMeta } from "@/lib/game";
import { trpc } from "@/lib/trpc";
import { ArrowRight, ChevronRight, Loader2, Radio, Timer, Trophy, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

function Clock({ target, serverTime }: { target: number; serverTime: number }) {
  const [clientNow, setClientNow] = useState(Date.now());
  const [offset, setOffset] = useState(() => serverTime - Date.now());
  useEffect(() => { setOffset(serverTime - Date.now()); }, [serverTime]);
  useEffect(() => { let handle = 0; const tick = () => { setClientNow(Date.now()); handle = window.setTimeout(tick, 1000); }; tick(); return () => window.clearTimeout(handle); }, []);
  return <>{getCountdown(target, clientNow + offset)}</>;
}

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.game.dashboard.useQuery(undefined, { enabled: Boolean(user), refetchInterval: 10_000, refetchOnMount: "always" });
  useEffect(() => {
    if (data && !data.profile) setLocation("/cadastro");
  }, [data, setLocation]);
  if (loading || (user && isLoading)) return <div className="auth-screen"><Loader2 className="animate-spin text-teal-200" /></div>;
  if (!user) return <div className="auth-screen"><div className="glass-card auth-panel"><button className="brand-mark"><span className="brand-orbit" /><span>SEDENTOS</span></button><div className="auth-geometry"><span /><span /><span /></div><h1 className="auth-title">A disputa pede <em>presença.</em></h1><p className="auth-copy">Entre para responder rodadas, acompanhar sua equipe e conquistar cada posição do ranking.</p><button className="primary-action mx-auto" onClick={() => startLogin()}><Radio size={17} /> Entrar na gincana</button></div></div>;
  if (!data?.profile) return null;
  const { profile, personal, team, ranking, featuredRound } = data;
  const status = featuredRound ? stateMeta[featuredRound.state] : stateMeta.AGUARDANDO;
  const isOpen = featuredRound?.state === "LIBERADA" || featuredRound?.state === "ENCERRANDO";
  const target = isOpen ? featuredRound!.endsAt : featuredRound?.startsAt;
  return <div className="app-bg"><GameNav /><main className="page-shell"><p className="eyebrow">Bem-vindo de volta · {profile.teamName}</p><h1 className="page-title">Oi, {profile.nickname}. <span className="text-teal-200">Pronto para pontuar?</span></h1><p className="page-intro">Cada acerto fortalece sua equipe. Confira o painel e entre em ação quando a arena liberar.</p>
    <section className="score-grid"><article className="glass-card metric-card"><p className="metric-label">Sua pontuação</p><p className="metric-value">{formatPoints(personal?.points ?? 0)}</p><p className="metric-sub">pontos conquistados</p></article><article className="glass-card metric-card"><p className="metric-label">{team?.name ?? "Sua equipe"}</p><p className="metric-value">{formatPoints(team?.points ?? 0)}</p><p className="metric-sub">posição #{team?.rank ?? "–"} no ranking</p></article><article className="glass-card metric-card"><p className="metric-label">Sua colocação</p><p className="metric-value">#{personal?.rank ?? "–"}</p><p className="metric-sub">entre participantes</p></article></section>
    <section className="hero-grid"><article className="glass-card round-spotlight"><div className="flex flex-wrap items-center justify-between gap-3"><span className={`status-pill ${status.tone}`}>{status.label}</span><RoundAlerts round={featuredRound} /></div><h2 className="round-name">{featuredRound?.title ?? "Programação em breve"}</h2><p className="max-w-md text-sm leading-6 text-slate-300">{status.copy}</p>{target ? <><div className="mt-5 flex items-center gap-2 text-xs font-bold text-teal-100"><Timer size={15} /> {isOpen ? "Rodada termina em" : `Início às ${formatTime(featuredRound!.startsAt)}`}</div><div className="countdown"><Clock target={target} serverTime={featuredRound!.serverTime} /></div></> : <p className="mt-8 text-sm text-slate-400">A administração ainda não publicou a próxima rodada.</p>}{isOpen && <button className="primary-action" onClick={() => setLocation(`/rodada/${featuredRound!.id}`)}>Responder agora <ArrowRight size={17} /></button>}</article>
      <article className="glass-card ranking-preview"><div className="flex items-center justify-between"><div><p className="eyebrow">Disputa geral</p><h2 className="mt-2 font-display text-xl font-bold">Ranking das equipes</h2></div><button className="secondary-action px-3 py-2" onClick={() => setLocation("/ranking")}><Trophy size={15} /></button></div><div className="mt-4">{ranking.map(item => <div className="team-row" key={item.id}><span className="rank-number">0{item.rank}</span><div className="team-detail"><span className="team-avatar" style={{ background: item.color }}>{item.symbol}</span><div className="min-w-0"><p className="team-name">{item.name}</p><div className="mt-1.5"><div className="progress-track"><div className="progress-fill" style={{ width: `${Math.max(7, (item.points / Math.max(ranking[0]?.points || 1, 1)) * 100)}%`, background: item.color }} /></div></div></div></div><span className="team-points">{formatPoints(item.points)}</span></div>)}</div></article></section>
    <section className="section-heading"><div><p className="eyebrow">Sua tropa</p><h2>Sua equipe em movimento</h2></div><button className="secondary-action" onClick={() => setLocation("/equipe")}>Ver equipe <UsersRound size={16} /></button></section>
    <article className="glass-card flex flex-wrap items-center gap-4 p-5"><span className="team-avatar h-14 w-14 text-2xl" style={{ background: profile.teamColor }}>{profile.teamSymbol}</span><div className="min-w-[180px] flex-1"><p className="text-lg font-extrabold">{profile.teamName}</p><p className="mt-1 text-xs text-slate-400">{team?.memberCount ?? 0} integrantes · média de {formatPoints(team?.averagePoints ?? 0)} pontos</p></div><button className="secondary-action" onClick={() => setLocation("/historico")}>Seu histórico <ChevronRight size={16} /></button></article>
  </main></div>;
}
