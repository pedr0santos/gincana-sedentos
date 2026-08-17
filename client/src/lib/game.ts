export const stateMeta: Record<string, { label: string; tone: string; copy: string }> = {
  AGUARDANDO: { label: "PRÓXIMA RODADA", tone: "waiting", copy: "Prepare-se. As perguntas serão liberadas no horário indicado." },
  LIBERADA: { label: "RODADA LIBERADA", tone: "live", copy: "Responda agora e leve pontos para sua equipe." },
  ENCERRANDO: { label: "ENCERRANDO", tone: "warning", copy: "Últimos instantes. Finalize suas respostas." },
  ENCERRADA: { label: "RODADA ENCERRADA", tone: "muted", copy: "O período de respostas terminou." },
  PROCESSANDO: { label: "PROCESSANDO", tone: "warning", copy: "Estamos calculando os resultados desta rodada." },
  RESULTADO: { label: "RESULTADO DISPONÍVEL", tone: "result", copy: "A pontuação desta rodada já foi consolidada." },
};

export function formatPoints(points: number) {
  return new Intl.NumberFormat("pt-BR").format(points);
}

export function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(timestamp));
}

export function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
}

export function getCountdown(target: number, now: number) {
  const total = Math.max(0, Math.floor((target - now) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function toDateTimeInput(timestamp: number) {
  const date = new Date(timestamp - new Date().getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}

export function fromDateTimeInput(value: string) {
  return new Date(value).getTime();
}

export function initials(value?: string | null) {
  return (value ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word.charAt(0).toUpperCase())
    .join("");
}
