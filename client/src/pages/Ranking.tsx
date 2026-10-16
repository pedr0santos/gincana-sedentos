import { useAuth } from "@/_core/hooks/useAuth";
import { GameNav } from "@/components/GameNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { formatPoints } from "@/lib/game";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight, Loader2, Radio, RefreshCw, Trophy } from "lucide-react";
import { useEffect, useState } from "react";

type PlayerAvatarProps = {
  src: string | null;
  nickname: string;
  initials: string;
  teamColor?: string;
};

function PlayerAvatar({ src, nickname, initials, teamColor }: PlayerAvatarProps) {
  const [imageStatus, setImageStatus] = useState<"loading" | "loaded" | "error">(src ? "loading" : "error");

  return <Avatar className="size-9">
    {src && <AvatarImage
      src={src}
      alt={`Foto de ${nickname}`}
      className="object-cover"
      loading="eager"
      decoding="async"
      onLoadingStatusChange={status => setImageStatus(status === "loaded" ? "loaded" : status === "error" ? "error" : "loading")}
    />}
    <AvatarFallback className="text-xs text-white" style={{ background: teamColor }}>
      {src && imageStatus === "loading" ? <Loader2 size={15} className="animate-spin" aria-label={`Carregando foto de ${nickname}`} /> : initials || "?"}
    </AvatarFallback>
  </Avatar>;
}

export default function Ranking() {
  const { user, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const [page, setPage] = useState(1);
  const showPhotos = Boolean(user) && !authLoading;
  const publicRanking = trpc.game.ranking.useQuery(undefined, { refetchInterval: 8_000, refetchOnMount: "always" });
  const participantRanking = trpc.game.participantRanking.useQuery({ page }, {
    enabled: showPhotos,
    refetchInterval: showPhotos ? 8_000 : false,
    refetchOnMount: "always",
    retry: false,
  });
  const { data, isLoading } = publicRanking;
  const teams = data?.teams ?? [];
  const publicPlayers = data?.participants ?? [];
  const total = showPhotos ? participantRanking.data?.total ?? 0 : publicPlayers.length;
  const totalPages = showPhotos ? participantRanking.data?.totalPages ?? 1 : Math.max(1, Math.ceil(total / 10));
  const currentPage = showPhotos ? participantRanking.data?.page ?? page : Math.min(page, totalPages);
  const players = showPhotos
    ? participantRanking.data?.items ?? []
    : publicPlayers.slice((currentPage - 1) * 10, currentPage * 10).map(player => ({ ...player, avatarUrl: null }));
  const playersLoading = showPhotos && participantRanking.isLoading;
  const playersError = showPhotos ? participantRanking.isError : publicRanking.isError;

  useEffect(() => {
    if (showPhotos ? participantRanking.data : data) setPage(currentPage);
  }, [showPhotos, participantRanking.data, data, currentPage]);

  useEffect(() => {
    if (!showPhotos || participantRanking.data?.page !== page || page >= totalPages) return;
    void utils.game.participantRanking.prefetch({ page: page + 1 }, { staleTime: 8_000 });
  }, [page, showPhotos, totalPages, participantRanking.data?.page, utils]);

  if (isLoading) return <div className="auth-screen"><Loader2 className="animate-spin text-teal-200" /></div>;
  return <div className="app-bg"><GameNav /><main className="page-shell"><p className="eyebrow"><Radio className="mr-1 inline" size={12} /> atualização enquanto esta tela estiver aberta</p><h1 className="page-title">A corrida pelo <span className="text-orange-200">topo.</span></h1><p className="page-intro">A classificação reflete os pontos computados no servidor após cada rodada concluída.</p>
    <section className="mt-8 grid items-start gap-4 lg:grid-cols-[1.2fr_.8fr]"><article className="glass-card min-w-0 overflow-hidden"><div className="border-b border-white/10 p-6"><Trophy className="text-orange-200" size={22} /><h2 className="mt-3 font-display text-2xl font-bold">Equipes</h2></div><div className="ranking-list">{teams.map(team => <div className="team-row py-5" key={team.id}><span className="rank-number text-base">#{team.rank}</span><div className="team-detail"><span className="team-avatar h-11 w-11 text-xl" style={{ background: team.color }}>{team.symbol}</span><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><p className="team-name text-base">{team.name}</p><span className="text-xs text-slate-400">{team.memberCount} pessoas</span></div><div className="mt-3"><div className="progress-track"><div className="progress-fill" style={{ width: `${Math.max(5, (team.points / Math.max(teams[0]?.points || 1, 1)) * 100)}%`, background: `linear-gradient(90deg, ${team.color}, ${team.accentColor})` }} /></div></div></div></div><span className="team-points text-base">{formatPoints(team.points)} pontos</span></div>)}</div></article>
      <article className="glass-card min-w-0 p-5" aria-labelledby="player-ranking-title">
        <p className="eyebrow">Ranking individual</p>
        <h2 id="player-ranking-title" className="mt-2 font-display text-xl font-bold">Jogadores em destaque</h2>
        <div className="mt-4" aria-busy={playersLoading}>
          {playersError ? <div className="empty-panel" role="alert">
            <p>Não foi possível atualizar o ranking.</p>
            <Button variant="ghost" className="mt-3" disabled={showPhotos ? participantRanking.isFetching : publicRanking.isFetching} onClick={() => void (showPhotos ? participantRanking.refetch() : publicRanking.refetch())}>
              <RefreshCw size={16} /> Tentar novamente
            </Button>
          </div> : playersLoading ? <div className="flex min-h-40 items-center justify-center" role="status" aria-label="Carregando jogadores"><Loader2 className="animate-spin text-teal-200" /></div> : <>
            {players.map(player => {
              const team = teams.find(item => item.id === player.teamId);
              const initials = player.nickname.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join("").toUpperCase();
              return <div className="grid grid-cols-[minmax(1.75rem,max-content)_minmax(0,1fr)_auto] items-center gap-2 border-b border-white/10 py-3 last:border-0" key={player.participantId}>
                <span className="rank-number">{player.rank}º</span>
                <div className="flex min-w-0 items-center gap-2">
                  <PlayerAvatar
                    key={`${player.participantId}-${showPhotos}-${player.avatarUrl ?? "initials"}`}
                    src={showPhotos ? player.avatarUrl : null}
                    nickname={player.nickname}
                    initials={initials}
                    teamColor={team?.color}
                  />
                  <div className="min-w-0">
                    <p className="team-name truncate" title={player.nickname}>{player.nickname}</p>
                    <p className="mt-1 truncate text-[11px] text-slate-400" title={team?.name}>{team?.name ?? "Sem equipe"}</p>
                  </div>
                </div>
                <span className="team-points max-w-28 text-right"><span className="block break-all">{formatPoints(player.points)}</span><span className="block text-[10px] font-normal text-slate-400">pontos</span></span>
              </div>;
            })}
            {!players.length && <div className="empty-panel">Ainda não há participantes no ranking.</div>}
            {total > 0 && <p className="mt-4 text-center text-xs text-slate-400" aria-live="polite">{(currentPage - 1) * 10 + 1}–{Math.min(currentPage * 10, total)} de {total} jogadores</p>}
            {totalPages > 1 && <Pagination className="mt-3" aria-label="Páginas do ranking individual">
              <PaginationContent>
                <PaginationItem><Button variant="ghost" size="icon" title="Página anterior" aria-label="Página anterior" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft /></Button></PaginationItem>
                <PaginationItem><span className="px-3 text-xs text-slate-300" aria-current="page">Página {currentPage} de {totalPages}</span></PaginationItem>
                <PaginationItem><Button variant="ghost" size="icon" title="Próxima página" aria-label="Próxima página" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight /></Button></PaginationItem>
              </PaginationContent>
            </Pagination>}
          </>}
        </div>
      </article></section>
  </main></div>;
}
