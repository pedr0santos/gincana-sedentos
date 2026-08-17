import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { buildRankings, canAcceptRoundAnswers, canCreateParticipantProfile, canSubmitParticipantAnswer, deriveRoundState, summarizeSubmittedAnswers, toPublicRanking } from "./db";
import type { TrpcContext } from "./_core/context";

const moment = 1_800_000_000_000;
const baseRound = {
  startsAt: moment + 60_000,
  endsAt: moment + 960_000,
  lifecycle: "draft" as const,
  closingWindowSeconds: 60,
};

describe("regras temporais das rodadas", () => {
  it("mantém uma rodada inacessível antes do horário oficial do servidor", () => {
    expect(deriveRoundState(baseRound, moment)).toBe("AGUARDANDO");
    expect(canAcceptRoundAnswers(baseRound, moment)).toBe(false);
  });

  it("libera respostas somente dentro da janela oficial", () => {
    const openMoment = baseRound.startsAt + 25_000;
    expect(deriveRoundState(baseRound, openMoment)).toBe("LIBERADA");
    expect(canAcceptRoundAnswers(baseRound, openMoment)).toBe(true);
  });

  it("mantém respostas permitidas na janela de encerramento", () => {
    const closingMoment = baseRound.endsAt - 30_000;
    expect(deriveRoundState(baseRound, closingMoment)).toBe("ENCERRANDO");
    expect(canAcceptRoundAnswers(baseRound, closingMoment)).toBe(true);
  });

  it("bloqueia respostas quando o período termina e preserva estados de resultado", () => {
    expect(deriveRoundState(baseRound, baseRound.endsAt)).toBe("ENCERRADA");
    expect(canAcceptRoundAnswers(baseRound, baseRound.endsAt)).toBe(false);
    expect(deriveRoundState({ ...baseRound, lifecycle: "processing" }, moment)).toBe("PROCESSANDO");
    expect(deriveRoundState({ ...baseRound, lifecycle: "result" }, moment)).toBe("RESULTADO");
  });
});

describe("pontuação e classificação", () => {
  it("soma somente acertos e preserva a contagem de respostas", () => {
    const totals = summarizeSubmittedAnswers([
      { participantId: 7, isCorrect: true, points: 10 },
      { participantId: 7, isCorrect: false, points: 20 },
      { participantId: 8, isCorrect: true, points: 15 },
    ]);
    expect(totals.get(7)).toEqual({ answeredCount: 2, correctCount: 1, points: 10 });
    expect(totals.get(8)).toEqual({ answeredCount: 1, correctCount: 1, points: 15 });
  });

  it("combina rodadas e ajustes administrativos no ranking de equipes", () => {
    const now = new Date();
    const ranking = buildRankings(
      [
        { id: 1, name: "Aurora", slug: "aurora", color: "#00aaaa", accentColor: "#aaffff", symbol: "A", description: null, logoUrl: null, logoKey: null, createdAt: now, updatedAt: now },
        { id: 2, name: "Brasa", slug: "brasa", color: "#ff6600", accentColor: "#ffaa66", symbol: "B", description: null, logoUrl: null, logoKey: null, createdAt: now, updatedAt: now },
      ],
      [
        { id: 10, teamId: 1, nickname: "Ana", fullName: "Ana Luz", avatarUrl: null, isBlocked: false },
        { id: 11, teamId: 2, nickname: "Bia", fullName: "Bia Sol", avatarUrl: null, isBlocked: false },
      ],
      [{ participantId: 10, points: 30 }, { participantId: 11, points: 25 }],
      [{ participantId: 11, points: 10 }]
    );
    expect(ranking.teams[0]).toMatchObject({ id: 2, points: 35, rank: 1, averagePoints: 35 });
    expect(ranking.participants[0]).toMatchObject({ participantId: 11, points: 35, rank: 1 });
  });

  it("remove dados pessoais da projeção pública do ranking", () => {
    const now = new Date();
    const ranking = buildRankings(
      [{ id: 1, name: "Aurora", slug: "aurora", color: "#00aaaa", accentColor: "#aaffff", symbol: "A", description: "privada", logoUrl: "/logo", logoKey: "logo-key", createdAt: now, updatedAt: now }],
      [{ id: 10, teamId: 1, nickname: "Ana", fullName: "Ana Luz", avatarUrl: "/private-avatar", isBlocked: false }],
      [{ participantId: 10, points: 30 }],
      [],
    );
    const publicRanking = toPublicRanking(ranking);
    expect(publicRanking.participants[0]).toEqual({ participantId: 10, teamId: 1, nickname: "Ana", points: 30, rank: 1 });
    expect(publicRanking.participants[0]).not.toHaveProperty("fullName");
    expect(publicRanking.participants[0]).not.toHaveProperty("avatarUrl");
    expect(publicRanking.teams[0]).not.toHaveProperty("logoKey");
  });
});

describe("regras de proteção do participante", () => {
  it("impede novo cadastro quando o participante já possui equipe", () => {
    expect(canCreateParticipantProfile(null)).toBe(true);
    expect(canCreateParticipantProfile({ id: 10, teamId: 2 })).toBe(false);
  });

  it("impede usuário bloqueado e respostas repetidas, mesmo durante uma rodada liberada", () => {
    const openRound = { ...baseRound, startsAt: moment - 10_000, endsAt: moment + 10_000 };
    expect(canSubmitParticipantAnswer({ isBlocked: true, hasExistingAnswer: false, round: openRound, now: moment })).toBe(false);
    expect(canSubmitParticipantAnswer({ isBlocked: false, hasExistingAnswer: true, round: openRound, now: moment })).toBe(false);
    expect(canSubmitParticipantAnswer({ isBlocked: false, hasExistingAnswer: false, round: openRound, now: moment })).toBe(true);
  });
});

describe("autorização administrativa", () => {
  it("bloqueia procedimentos administrativos para participantes", async () => {
    const context = {
      user: {
        id: 1,
        openId: "participant-1",
        name: "Participante",
        email: "participante@example.com",
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} },
      res: { clearCookie: () => undefined },
    } as unknown as TrpcContext;
    const caller = appRouter.createCaller(context);
    await expect(caller.admin.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
