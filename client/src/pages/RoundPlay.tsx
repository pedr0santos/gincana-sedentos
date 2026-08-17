import { useAuth } from "@/_core/hooks/useAuth";
import { GameNav } from "@/components/GameNav";
import { formatPoints, getCountdown, stateMeta } from "@/lib/game";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, ChevronLeft, Circle, Loader2, Lock, Send, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

function RoundTimer({ endsAt, serverTime }: { endsAt: number; serverTime: number }) {
  const [clientNow, setClientNow] = useState(Date.now());
  const [offset, setOffset] = useState(() => serverTime - Date.now());
  useEffect(() => { setOffset(serverTime - Date.now()); }, [serverTime]);
  useEffect(() => { let timeout = 0; const tick = () => { setClientNow(Date.now()); timeout = window.setTimeout(tick, 1000); }; tick(); return () => window.clearTimeout(timeout); }, []);
  return <>{getCountdown(endsAt, clientNow + offset)}</>;
}

export default function RoundPlay() {
  const { user } = useAuth();
  const [, params] = useRoute("/rodada/:id");
  const [, setLocation] = useLocation();
  const roundId = Number(params?.id);
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.game.round.useQuery({ roundId }, { enabled: Boolean(user && roundId), refetchInterval: 5_000, refetchOnMount: "always" });
  const submit = trpc.game.submitAnswer.useMutation({
    onSuccess: () => { utils.game.round.invalidate({ roundId }); },
    onError: error => toast.error(error.message),
  });
  const [current, setCurrent] = useState(0);
  if (isLoading) return <div className="auth-screen"><Loader2 className="animate-spin text-teal-200" /></div>;
  if (!data) return <div className="app-bg"><GameNav /><main className="page-shell"><div className="glass-card empty-panel">Rodada não encontrada.</div></main></div>;
  const { round, questions, answerMap, canAnswer } = data;
  const question = questions[Math.min(current, Math.max(questions.length - 1, 0))];
  const submitted = question ? answerMap[question.id] : undefined;
  const status = stateMeta[round.state];
  const answeredCount = Object.keys(answerMap).length;
  return <div className="app-bg"><GameNav /><main className="page-shell max-w-4xl"><button className="mb-6 inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-teal-100" onClick={() => setLocation("/")}><ChevronLeft size={16} /> Voltar ao painel</button>
    <div className="glass-card flex flex-wrap items-center justify-between gap-4 p-5"><div><p className="eyebrow">{round.title}</p><h1 className="mt-2 font-display text-2xl font-bold">{canAnswer ? "Concentre-se. Cada resposta conta." : status.label}</h1></div><div className="text-right"><span className={`status-pill ${status.tone}`}>{status.label}</span><p className="mt-3 flex items-center justify-end gap-1 font-mono text-xl font-bold text-orange-100"><Timer size={17} /> <RoundTimer endsAt={round.endsAt} serverTime={round.serverTime} /></p></div></div>
    {!canAnswer || !question ? <div className="glass-card empty-panel mt-5"><Lock className="mx-auto mb-3 text-slate-400" /><p>{!question && (round.state === "LIBERADA" || round.state === "ENCERRANDO") ? "Esta rodada foi liberada, mas ainda não há perguntas cadastradas para responder. Avise a administração." : status.copy}</p>{round.state === "RESULTADO" && <button className="secondary-action mt-5" onClick={() => setLocation("/historico")}>Ver seu resultado</button>}</div> : <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_220px]"><article className="glass-card p-6 sm:p-8"><div className="flex items-start justify-between gap-4"><p className="eyebrow">Pergunta {current + 1} de {questions.length}</p><span className="font-mono text-xs text-orange-100">+{formatPoints(question.points)} pts</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-teal-200" style={{ width: `${((current + 1) / questions.length) * 100}%` }} /></div>{question.imageUrl && <img className="mt-6 max-h-64 w-full rounded-xl object-cover" src={question.imageUrl} alt="Imagem da pergunta" />}{question.videoUrl && <video className="mt-6 max-h-64 w-full rounded-xl" src={question.videoUrl} controls />}
      <h2 className="mt-7 font-display text-2xl font-bold leading-tight sm:text-3xl">{question.prompt}</h2><div className="mt-7 grid gap-3">{question.options.map((option: { id: number; label: string }, index: number) => { const active = submitted === option.id; return <button key={option.id} disabled={Boolean(submitted) || submit.isPending} onClick={() => submit.mutate({ questionId: question.id, selectedOptionId: option.id })} className={`flex items-center gap-4 rounded-xl border p-4 text-left transition ${active ? "border-teal-200 bg-teal-300/10" : "border-white/10 bg-black/10 hover:border-teal-200/50 hover:bg-teal-100/5"}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-mono text-xs ${active ? "bg-teal-200 text-teal-950" : "bg-white/8 text-slate-300"}`}>{String.fromCharCode(65 + index)}</span><span className="flex-1 text-sm font-bold leading-6">{option.label}</span>{active && <CheckCircle2 className="text-teal-200" size={19} />}</button>; })}</div>{submitted && <p className="mt-5 flex items-center gap-2 text-xs text-teal-100"><Lock size={14} /> Resposta enviada e bloqueada. Ela não pode ser alterada.</p>}
      <div className="mt-7 flex justify-between gap-3"><button className="secondary-action" disabled={current === 0} onClick={() => setCurrent(current - 1)}>Anterior</button>{current < questions.length - 1 ? <button className="primary-action mt-0" onClick={() => setCurrent(current + 1)}>Próxima <ChevronLeft className="rotate-180" size={16} /></button> : <button className="primary-action mt-0" onClick={() => toast.success(`Você enviou ${answeredCount} de ${questions.length} respostas.`)}><Send size={16} /> Finalizar</button>}</div>
    </article><aside className="glass-card h-fit p-5"><p className="eyebrow">Seu progresso</p><p className="mt-3 font-display text-4xl font-bold">{answeredCount}<span className="text-lg text-slate-500">/{questions.length}</span></p><p className="mt-1 text-xs text-slate-400">respostas confirmadas</p><div className="mt-6 grid grid-cols-5 gap-2">{questions.map((item, index) => <button key={item.id} onClick={() => setCurrent(index)} className={`grid aspect-square place-items-center rounded-lg text-xs font-bold ${answerMap[item.id] ? "bg-teal-200 text-teal-950" : current === index ? "border border-orange-200 bg-orange-200/10 text-orange-100" : "bg-white/7 text-slate-400"}`}>{answerMap[item.id] ? <CheckCircle2 size={15} /> : index + 1}</button>)}</div><p className="mt-6 flex gap-2 text-xs leading-5 text-slate-400"><Circle className="mt-0.5 shrink-0" size={12} /> Os pontos só aparecem após o encerramento e processamento da rodada.</p></aside></section>}
  </main></div>;
}
