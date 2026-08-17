import { formatPoints } from "@/lib/game";
import { trpc } from "@/lib/trpc";
import { Expand, Loader2, Radio } from "lucide-react";
import { useState } from "react";

export default function LiveRanking() {
  const { data, isLoading } = trpc.game.ranking.useQuery(undefined, { refetchInterval: 5_000, refetchOnMount: "always" });
  const [lastUpdate] = useState(() => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date()));
  if (isLoading) return <div className="auth-screen"><Loader2 className="animate-spin text-teal-200" /></div>;
  return <main className="live-wall"><div className="flex items-center justify-between gap-4"><div><p className="eyebrow"><Radio className="mr-1 inline" size={12} /> modo projeção</p><h1 className="live-title">GINCANA <span>SEDENTOS</span></h1></div><button className="secondary-action" onClick={() => document.documentElement.requestFullscreen?.()}><Expand size={17} /> Tela cheia</button></div><section className="live-list">{data?.teams.map(team => <article className="live-team" key={team.id}><span className="live-rank">{team.rank}º</span><div className="flex items-center gap-4"><span className="team-avatar h-12 w-12 text-2xl" style={{ background: team.color }}>{team.symbol}</span><h2 className="live-team-name">{team.name}</h2></div><p className="live-points">{formatPoints(team.points)} <span className="text-sm text-slate-400">pts</span></p></article>)}</section><footer className="live-footer"><span>Ranking atualizado na tela aberta</span><span>Última leitura {lastUpdate}</span></footer></main>;
}
