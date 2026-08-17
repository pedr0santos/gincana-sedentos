import { Bell, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type FeaturedRound = { id: number; title: string; state: string; startsAt: number; notifyBeforeMinutes: number } | null | undefined;

export function RoundAlerts({ round }: { round: FeaturedRound }) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  useEffect(() => {
    if (!round || permission !== "granted") return;
    const now = Date.now();
    const openingSoon = round.startsAt > now && round.startsAt - now <= round.notifyBeforeMinutes * 60_000;
    const released = round.state === "LIBERADA" || round.state === "ENCERRANDO";
    const key = `sedentos-alert-${round.id}-${released ? "open" : "soon"}`;
    if ((!openingSoon && !released) || sessionStorage.getItem(key)) return;
    const body = released ? "A rodada está liberada. Responda agora e pontue para sua equipe." : `${round.title} começa em breve. Prepare-se para entrar na arena.`;
    new Notification(released ? "Rodada liberada!" : "Atenção, participante", { body, tag: key });
    sessionStorage.setItem(key, "sent");
  }, [round, permission]);

  if (permission === "unsupported") return null;
  if (permission === "granted") return <span className="inline-flex items-center gap-1 text-xs font-bold text-teal-100"><BellRing size={14} /> Alertas ativos nesta tela</span>;
  return <button className="secondary-action px-3 py-2 text-xs" onClick={async () => { const next = await Notification.requestPermission(); setPermission(next); if (next === "granted") toast.success("Alertas ativados enquanto a gincana estiver aberta."); else toast.message("Você pode liberar alertas nas permissões do navegador."); }}><Bell size={14} /> Ativar alertas</button>;
}
