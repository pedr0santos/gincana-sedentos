import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async importOriginal => ({
  ...await importOriginal<typeof import("./db")>(),
  createParticipantProfile: vi.fn(),
  deriveRoundState: vi.fn(),
  ensureDefaultTeams: vi.fn(),
  getDb: vi.fn(),
  getParticipantRoundProgress: vi.fn(),
  getParticipantHistory: vi.fn(),
  getProfileByUserId: vi.fn(),
  getRankingData: vi.fn(),
  getRoundById: vi.fn(),
  getRoundQuestionSet: vi.fn(),
  getSubmittedAnswerMap: vi.fn(),
  getTeamHistory: vi.fn(),
  getUpcomingRound: vi.fn(),
  listTeams: vi.fn(),
  processExpiredRounds: vi.fn(),
  startParticipantQuestion: vi.fn(),
  submitParticipantAnswer: vi.fn(),
}));

vi.mock("./storage", () => ({ storagePut: vi.fn() }));

import { buildRankings, getRankingData, startParticipantQuestion, submitParticipantAnswer } from "./db";
import { appRouter } from "./routers";

function participantContext(): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "participant-42",
      name: "Participante",
      email: "participant@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("procedures protegidas da gincana", () => {
  it("retorna uma página autenticada com posições globais e somente dados permitidos", async () => {
    const ranking = buildRankings([], Array.from({ length: 23 }, (_, index) => ({
      id: index + 1, teamId: 1, nickname: `Jogador ${String(index + 1).padStart(2, "0")}`,
      fullName: "Nome privado", avatarUrl: "https://storage/private", avatarKey: "private-key", isBlocked: false,
    })), [], []);
    vi.mocked(getRankingData).mockResolvedValue(ranking);
    const caller = appRouter.createCaller(participantContext());
    const page = await caller.game.participantRanking({ page: 2 });
    expect(page).toMatchObject({ total: 23, page: 2, pageSize: 10, totalPages: 3 });
    expect(page.items).toHaveLength(10);
    expect(page.items[0]).toEqual({ participantId: 11, teamId: 1, nickname: "Jogador 11", rank: 11, points: 0, avatarUrl: "/api/media/avatar/11" });
    expect((await caller.game.participantRanking({ page: 99 })).items).toHaveLength(3);
    expect((await caller.game.participantRanking({})).page).toBe(1);
  });

  it("rejeita consulta de fotos do ranking sem sessão", async () => {
    const caller = appRouter.createCaller({ ...participantContext(), user: null });
    await expect(caller.game.participantRanking({ page: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejeita página inválida %s", async page => {
    const caller = appRouter.createCaller(participantContext());
    await expect(caller.game.participantRanking({ page })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("associa a submissão de resposta à identidade autenticada, não a um id do cliente", async () => {
    vi.mocked(submitParticipantAnswer).mockResolvedValueOnce({ success: true });
    const caller = appRouter.createCaller(participantContext());

    await expect(caller.game.submitAnswer({ questionId: 15, selectedOptionId: 50 })).resolves.toEqual({ success: true });
    expect(submitParticipantAnswer).toHaveBeenCalledWith({ userId: 42, questionId: 15, selectedOptionId: 50 });
  });

  it("propaga a recusa de uma resposta duplicada sem alterar a resposta original", async () => {
    vi.mocked(submitParticipantAnswer).mockRejectedValueOnce(new Error("Esta resposta já foi enviada e não pode ser alterada."));
    const caller = appRouter.createCaller(participantContext());

    await expect(caller.game.submitAnswer({ questionId: 15, selectedOptionId: 51 })).rejects.toThrow("Esta resposta já foi enviada e não pode ser alterada.");
  });

  it("associa o início da pergunta à identidade autenticada", async () => {
    vi.mocked(startParticipantQuestion).mockResolvedValueOnce({ completed: false, attempt: null });
    const caller = appRouter.createCaller(participantContext());

    await expect(caller.game.startQuestion({ roundId: 9 })).resolves.toEqual({ completed: false, attempt: null });
    expect(startParticipantQuestion).toHaveBeenCalledWith({ userId: 42, roundId: 9 });
  });

  it("rejeita ações administrativas críticas quando chamadas por um participante", async () => {
    const caller = appRouter.createCaller(participantContext());
    await expect(caller.admin.saveTeam({ id: 1, name: "Aurora", color: "#16B8B0", accentColor: "#85FFF3", symbol: "✦", description: null, logoUrl: null, logoKey: null })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("protege movimentação, bloqueio e ajuste de pontos contra chamadas de participantes", async () => {
    const caller = appRouter.createCaller(participantContext());
    await expect(caller.admin.moveParticipant({ participantId: 8, teamId: 2 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.blockParticipant({ participantId: 8, isBlocked: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.adjustScore({ participantId: 8, points: 20, reason: "Bônus de organização" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("protege criação de rodadas e equipes contra chamadas de participantes", async () => {
    const caller = appRouter.createCaller(participantContext());
    await expect(caller.admin.createOrUpdateRound({ title: "Rodada protegida", description: null, startsAt: 1_800_000_000_000, endsAt: 1_800_000_060_000, closingWindowSeconds: 60, notifyBeforeMinutes: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.createTeam({ name: "Nova", slug: "nova", color: "#16B8B0", accentColor: "#85FFF3", symbol: "✦", description: null })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
