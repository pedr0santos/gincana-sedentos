import { useAuth } from "@/_core/hooks/useAuth";
import { GameNav } from "@/components/GameNav";
import { formatPoints, getCountdown, stateMeta } from "@/lib/game";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2,
  ChevronLeft,
  Circle,
  Loader2,
  Lock,
  Timer,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

function QuestionTimer({
  startedAt,
  deadlineAt,
  serverTime,
  onExpired,
}: {
  startedAt: number;
  deadlineAt: number;
  serverTime: number;
  onExpired: () => void;
}) {
  const [clientNow, setClientNow] = useState(Date.now());
  const [offset, setOffset] = useState(() => serverTime - Date.now());
  const expiryNotified = useRef(false);
  const now = clientNow + offset;
  const duration = Math.max(1, deadlineAt - startedAt);
  const elapsed = Math.max(0, Math.min(duration, now - startedAt));
  const progress = Math.max(
    0,
    Math.min(100, ((duration - elapsed) / duration) * 100)
  );

  useEffect(() => {
    setOffset(serverTime - Date.now());
  }, [serverTime]);

  useEffect(() => {
    expiryNotified.current = false;
  }, [deadlineAt]);

  useEffect(() => {
    const timer = window.setInterval(() => setClientNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (now >= deadlineAt && !expiryNotified.current) {
      expiryNotified.current = true;
      onExpired();
    }
  }, [deadlineAt, now, onExpired]);

  return (
    <div className="min-w-32 text-right">
      <p className="flex items-center justify-end gap-1 font-mono text-xl font-bold text-orange-100">
        <Timer size={17} /> {getCountdown(deadlineAt, now)}
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-orange-200 transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export default function RoundPlay() {
  const { user } = useAuth();
  const [, params] = useRoute("/rodada/:id");
  const [, setLocation] = useLocation();
  const roundId = Number(params?.id);
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.game.round.useQuery(
    { roundId },
    {
      enabled: Boolean(user && roundId),
      refetchInterval: 5_000,
      refetchOnMount: "always",
    }
  );
  const requestedQuestionRef = useRef<number | null>(null);
  const startQuestion = trpc.game.startQuestion.useMutation({
    onSuccess: () => utils.game.round.invalidate({ roundId }),
    onError: error => toast.error(error.message),
  });
  const submit = trpc.game.submitAnswer.useMutation({
    onSuccess: () => utils.game.round.invalidate({ roundId }),
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    requestedQuestionRef.current = null;
  }, [roundId]);

  useEffect(() => {
    const nextQuestionId = data?.progress?.activeQuestionId;
    if (
      !data?.canAnswer ||
      data.progress?.completed ||
      !nextQuestionId ||
      startQuestion.isPending
    )
      return;
    if (requestedQuestionRef.current === nextQuestionId) return;
    requestedQuestionRef.current = nextQuestionId;
    startQuestion.mutate({ roundId });
  }, [
    data?.canAnswer,
    data?.progress?.activeQuestionId,
    data?.progress?.completed,
    roundId,
    startQuestion.isPending,
    startQuestion.mutate,
  ]);

  if (isLoading)
    return (
      <div className="auth-screen">
        <Loader2 className="animate-spin text-teal-200" />
      </div>
    );
  if (!data)
    return (
      <div className="app-bg">
        <GameNav />
        <main className="page-shell">
          <div className="glass-card empty-panel">Rodada não encontrada.</div>
        </main>
      </div>
    );

  const { round, questions, answerMap, canAnswer, progress } = data;
  const question = questions.find(
    item => item.id === progress?.activeQuestionId
  );
  const status = stateMeta[round.state];
  const attempts = progress?.attempts ?? {};
  const answeredCount = Object.values(attempts).filter(
    attempt => attempt.status === "answered"
  ).length;
  const completedCount = Object.keys(attempts).length;
  const activeAttempt = progress?.activeAttempt;
  const advanceQuestion = () => {
    if (!startQuestion.isPending) startQuestion.mutate({ roundId });
  };

  return (
    <div className="app-bg">
      <GameNav />
      <main className="page-shell max-w-4xl">
        <button
          className="mb-6 inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-teal-100"
          onClick={() => setLocation("/")}
        >
          <ChevronLeft size={16} /> Voltar ao painel
        </button>
        <div className="glass-card flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="eyebrow">{round.title}</p>
            <h1 className="mt-2 font-display text-2xl font-bold">
              {canAnswer ? "Responda no seu ritmo." : status.label}
            </h1>
          </div>
          <span className={`status-pill ${status.tone}`}>{status.label}</span>
        </div>
        {!canAnswer || !questions.length ? (
          <div className="glass-card empty-panel mt-5">
            <Lock className="mx-auto mb-3 text-slate-400" />
            <p>
              {!questions.length &&
              (round.state === "LIBERADA" || round.state === "ENCERRANDO")
                ? "Esta rodada foi liberada, mas ainda não há perguntas cadastradas para responder. Avise a administração."
                : status.copy}
            </p>
            {round.state === "RESULTADO" && (
              <button
                className="secondary-action mt-5"
                onClick={() => setLocation("/historico")}
              >
                Ver seu resultado
              </button>
            )}
          </div>
        ) : progress?.completed ? (
          <div className="glass-card empty-panel mt-5">
            <CheckCircle2 className="mx-auto mb-3 text-teal-200" />
            <h2 className="font-display text-xl font-bold">
              Participação concluída.
            </h2>
            <p className="mt-2">
              Você respondeu ou aguardou todas as perguntas. Os pontos
              aparecerão após o processamento da rodada.
            </p>
            <button
              className="secondary-action mt-5"
              onClick={() => setLocation("/")}
            >
              Voltar ao painel
            </button>
          </div>
        ) : !question || !activeAttempt ? (
          <div className="glass-card empty-panel mt-5">
            <Loader2 className="mx-auto mb-3 animate-spin text-teal-200" />
            <p>Preparando a próxima pergunta...</p>
          </div>
        ) : (
          <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_220px]">
            <article className="glass-card p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <p className="eyebrow">
                  Pergunta {question.position} de {questions.length}
                </p>
                <QuestionTimer
                  startedAt={activeAttempt.startedAt}
                  deadlineAt={activeAttempt.deadlineAt}
                  serverTime={round.serverTime}
                  onExpired={advanceQuestion}
                />
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-teal-200"
                  style={{
                    width: `${(completedCount / questions.length) * 100}%`,
                  }}
                />
              </div>
              {question.imageUrl && (
                <img
                  className="mt-6 max-h-64 w-full rounded-xl object-cover"
                  src={question.imageUrl}
                  alt="Imagem da pergunta"
                />
              )}
              {question.videoUrl && (
                <video
                  className="mt-6 max-h-64 w-full rounded-xl"
                  src={question.videoUrl}
                  controls
                />
              )}
              <h2 className="mt-7 font-display text-2xl font-bold leading-tight sm:text-3xl">
                {question.prompt}
              </h2>
              {/* <p className="mt-3 text-xs text-slate-400">
                Pontuação máxima:{" "}
                <span className="font-bold text-orange-100">
                  {formatPoints(question.points)} pts
                </span>
                . Quanto mais rápido, maior a pontuação.
              </p> */}
              <div className="mt-7 grid gap-3">
                {question.options.map(
                  (option: { id: number; label: string }, index: number) => {
                    const active = answerMap[question.id] === option.id;
                    return (
                      <button
                        key={option.id}
                        disabled={
                          Boolean(answerMap[question.id]) || submit.isPending
                        }
                        onClick={() =>
                          submit.mutate({
                            questionId: question.id,
                            selectedOptionId: option.id,
                          })
                        }
                        className={`flex items-center gap-4 rounded-xl border p-4 text-left transition ${active ? "border-teal-200 bg-teal-300/10" : "border-white/10 bg-black/10 hover:border-teal-200/50 hover:bg-teal-100/5"}`}
                      >
                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-mono text-xs ${active ? "bg-teal-200 text-teal-950" : "bg-white/8 text-slate-300"}`}
                        >
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span className="flex-1 text-sm font-bold leading-6">
                          {option.label}
                        </span>
                        {active && (
                          <CheckCircle2 className="text-teal-200" size={19} />
                        )}
                      </button>
                    );
                  }
                )}
              </div>
            </article>
            <aside className="glass-card h-fit p-5">
              <p className="eyebrow">Seu progresso</p>
              <p className="mt-3 font-display text-4xl font-bold">
                {answeredCount}
                <span className="text-lg text-slate-500">
                  /{questions.length}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                respostas confirmadas
              </p>
              <div className="mt-6 grid grid-cols-5 gap-2">
                {questions.map(item => {
                  const attempt = attempts[item.id];
                  return (
                    <div
                      key={item.id}
                      className={`grid aspect-square place-items-center rounded-lg text-xs font-bold ${attempt?.status === "answered" ? "bg-teal-200 text-teal-950" : attempt?.status === "expired" ? "bg-white/10 text-slate-500" : item.id === question.id ? "border border-orange-200 bg-orange-200/10 text-orange-100" : "bg-white/7 text-slate-400"}`}
                    >
                      {attempt?.status === "answered" ? (
                        <CheckCircle2 size={15} />
                      ) : attempt?.status === "expired" ? (
                        <Lock size={13} />
                      ) : (
                        item.position
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-6 flex gap-2 text-xs leading-5 text-slate-400">
                <Circle className="mt-0.5 shrink-0" size={12} /> A pontuação
                final será calculada pelo tempo usado e exibida após o
                encerramento.
              </p>
            </aside>
          </section>
        )}
      </main>
    </div>
  );
}
