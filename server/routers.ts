import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createParticipantProfile,
  deriveRoundState,
  ensureDefaultTeams,
  getDb,
  getParticipantHistory,
  getProfileByUserId,
  getRankingData,
  getPublicRankingData,
  getRoundById,
  getRoundQuestionSet,
  getSubmittedAnswerMap,
  getTeamHistory,
  getUpcomingRound,
  listTeams,
  processExpiredRounds,
  submitParticipantAnswer,
} from "./db";
import { answers, participantProfiles, questionOptions, questions, rounds, roundScores, scoreAdjustments, teams } from "../drizzle/schema";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { storagePut } from "./storage";

function withProtectedAvatar<T extends { id: number; avatarKey?: string | null; avatarUrl?: string | null }>(profile: T | null | undefined) {
  if (!profile) return profile;
  return { ...profile, avatarUrl: profile.avatarKey ? `/api/media/avatar/${profile.id}` : null };
}

const profileInput = z.object({
  fullName: z.string().trim().min(3).max(140),
  nickname: z.string().trim().min(2).max(80),
  contact: z.string().trim().min(5).max(320),
  teamId: z.number().int().positive(),
  avatarUrl: z.string().max(1000).nullable().optional(),
  avatarKey: z.string().max(512).nullable().optional(),
});

const roundInput = z.object({
  id: z.number().int().positive().optional(),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2400).nullable().optional(),
  startsAt: z.number().int().positive(),
  endsAt: z.number().int().positive(),
  closingWindowSeconds: z.number().int().min(10).max(600).default(60),
  notifyBeforeMinutes: z.number().int().min(0).max(120).default(10),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  game: router({
    teams: publicProcedure.query(async () => listTeams()),
    myProfile: protectedProcedure.query(async ({ ctx }) => withProtectedAvatar(await getProfileByUserId(ctx.user.id))),
    completeProfile: protectedProcedure.input(profileInput).mutation(async ({ ctx, input }) => {
      await ensureDefaultTeams();
      return withProtectedAvatar(await createParticipantProfile({ ...input, userId: ctx.user.id }));
    }),
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      await ensureDefaultTeams();
      await processExpiredRounds();
      const profile = await getProfileByUserId(ctx.user.id);
      const [ranking, featuredRound] = await Promise.all([getRankingData(), getUpcomingRound()]);
      const personal = profile ? ranking.participants.find(item => item.participantId === profile.id) : null;
      const team = profile ? ranking.teams.find(item => item.id === profile.teamId) : null;
      return { profile: withProtectedAvatar(profile), personal, team, ranking: ranking.teams, featuredRound, serverTime: Date.now() };
    }),
    ranking: publicProcedure.query(async () => getPublicRankingData()),
    myTeam: protectedProcedure.query(async ({ ctx }) => {
      const profile = await getProfileByUserId(ctx.user.id);
      if (!profile) return null;
      const [ranking, history] = await Promise.all([getRankingData(), getTeamHistory(profile.teamId)]);
      return { team: ranking.teams.find(item => item.id === profile.teamId) ?? null, history };
    }),
    history: protectedProcedure.query(async ({ ctx }) => {
      const profile = await getProfileByUserId(ctx.user.id);
      if (!profile) return null;
      const history = await getParticipantHistory(profile.id);
      const totals = history.history.reduce(
        (current, item) => ({
          answered: current.answered + item.answeredCount,
          correct: current.correct + item.correctCount,
          points: current.points + item.points,
        }),
        { answered: 0, correct: 0, points: 0 }
      );
      return { ...history, totals, accuracy: totals.answered ? Math.round((totals.correct / totals.answered) * 100) : 0 };
    }),
    round: protectedProcedure.input(z.object({ roundId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      await processExpiredRounds();
      const profile = await getProfileByUserId(ctx.user.id);
      const round = await getRoundById(input.roundId);
      if (!profile || !round) return null;
      const state = deriveRoundState(round);
      const canAnswer = !profile.isBlocked && ["LIBERADA", "ENCERRANDO"].includes(state);
      const questionSet = canAnswer ? await getRoundQuestionSet(round.id) : [];
      const answerMap = await getSubmittedAnswerMap(profile.id, questionSet.map(question => question.id));
      return { round: { ...round, state, serverTime: Date.now() }, questions: questionSet, answerMap, canAnswer };
    }),
    submitAnswer: protectedProcedure
      .input(z.object({ questionId: z.number().int().positive(), selectedOptionId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => submitParticipantAnswer({ ...input, userId: ctx.user.id })),
    uploadMedia: protectedProcedure
      .input(z.object({ dataUrl: z.string().min(32).max(11_500_000), fileName: z.string().min(1).max(160), category: z.enum(["avatar", "team", "question"]) }))
      .mutation(async ({ ctx, input }) => {
        if (input.category !== "avatar" && ctx.user.role !== "admin") throw new Error("Apenas administradores podem enviar esta mídia.");
        const match = input.dataUrl.match(/^data:(image\/(?:png|jpeg|webp)|video\/mp4);base64,([A-Za-z0-9+/=]+)$/);
        if (!match) throw new Error("Envie uma imagem PNG, JPEG, WEBP ou um vídeo MP4 válido.");
        const [, mimeType, base64] = match;
        const buffer = Buffer.from(base64, "base64");
        if (!buffer.length || buffer.length > 8 * 1024 * 1024) throw new Error("O arquivo deve ter no máximo 8 MB.");
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
        return storagePut(`gincana/${input.category}/${ctx.user.id}/${safeName}`, buffer, mimeType);
      }),
  }),

  admin: router({
    overview: adminProcedure.query(async () => {
      await ensureDefaultTeams();
      await processExpiredRounds();
      const db = await getDb();
      if (!db) throw new Error("Banco indisponível.");
      const [ranking, participantCount, roundCount, scheduledRounds] = await Promise.all([
        getRankingData(),
        db.select({ id: participantProfiles.id }).from(participantProfiles),
        db.select({ id: rounds.id }).from(rounds),
        db.select().from(rounds).orderBy(asc(rounds.startsAt)),
      ]);
      return { ranking, participantCount: participantCount.length, roundCount: roundCount.length, rounds: scheduledRounds.map(round => ({ ...round, state: deriveRoundState(round) })) };
    }),
    participants: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("Banco indisponível.");
      const rows = await db
        .select({
          id: participantProfiles.id,
          userId: participantProfiles.userId,
          fullName: participantProfiles.fullName,
          nickname: participantProfiles.nickname,
          contact: participantProfiles.contact,
          avatarUrl: participantProfiles.avatarUrl,
          avatarKey: participantProfiles.avatarKey,
          isBlocked: participantProfiles.isBlocked,
          teamId: teams.id,
          teamName: teams.name,
          teamColor: teams.color,
        })
        .from(participantProfiles)
        .innerJoin(teams, eq(participantProfiles.teamId, teams.id))
        .orderBy(asc(participantProfiles.fullName));
      const ranking = await getRankingData();
      return rows.map(row => ({ ...row, avatarUrl: row.avatarKey ? `/api/media/avatar/${row.id}` : null, points: ranking.participants.find(item => item.participantId === row.id)?.points ?? 0 }));
    }),
    rounds: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("Banco indisponível.");
      const data = await db.select().from(rounds).orderBy(asc(rounds.startsAt));
      return Promise.all(data.map(async round => ({ ...round, state: deriveRoundState(round), questions: await getRoundQuestionSet(round.id, true) })));
    }),
    createOrUpdateRound: adminProcedure.input(roundInput).mutation(async ({ input }) => {
      if (input.endsAt <= input.startsAt) throw new Error("O encerramento deve ocorrer depois do início.");
      const db = await getDb();
      if (!db) throw new Error("Banco indisponível.");
      const values = { ...input, description: input.description ?? null };
      if (input.id) {
        await db.update(rounds).set(values).where(eq(rounds.id, input.id));
        return { id: input.id };
      }
      const result = await db.insert(rounds).values(values);
      return { id: Number(result[0].insertId) };
    }),
    deleteRound: adminProcedure.input(z.object({ roundId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco indisponível.");
      await db.delete(rounds).where(eq(rounds.id, input.roundId));
      return { success: true };
    }),
    saveQuestion: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive().optional(),
          roundId: z.number().int().positive(),
          position: z.number().int().min(1),
          prompt: z.string().trim().min(4).max(5000),
          imageUrl: z.string().max(1000).nullable().optional(),
          imageKey: z.string().max(512).nullable().optional(),
          videoUrl: z.string().max(1000).nullable().optional(),
          videoKey: z.string().max(512).nullable().optional(),
          points: z.number().int().min(1).max(10000),
          timeLimitSeconds: z.number().int().min(5).max(3600).nullable().optional(),
          options: z.array(z.object({ id: z.number().int().positive().optional(), label: z.string().trim().min(1).max(600), isCorrect: z.boolean() })).min(2).max(5),
        })
      )
      .mutation(async ({ input }) => {
        if (input.options.filter(option => option.isCorrect).length !== 1) throw new Error("Defina exatamente uma alternativa correta.");
        const db = await getDb();
        if (!db) throw new Error("Banco indisponível.");
        const round = await db.select({ id: rounds.id }).from(rounds).where(eq(rounds.id, input.roundId)).limit(1);
        if (!round[0]) throw new Error("A rodada selecionada não existe mais. Atualize o painel e tente novamente.");
        const occupiedPosition = await db
          .select({ id: questions.id })
          .from(questions)
          .where(and(eq(questions.roundId, input.roundId), eq(questions.position, input.position), input.id ? ne(questions.id, input.id) : undefined))
          .limit(1);
        if (occupiedPosition[0]) throw new Error(`A posição ${input.position} já está ocupada nesta rodada. Escolha outra ordem ou edite a pergunta existente.`);
        const questionValues = {
          roundId: input.roundId,
          position: input.position,
          prompt: input.prompt,
          imageUrl: input.imageUrl ?? null,
          imageKey: input.imageKey ?? null,
          videoUrl: input.videoUrl ?? null,
          videoKey: input.videoKey ?? null,
          points: input.points,
          timeLimitSeconds: input.timeLimitSeconds ?? null,
        };
        let questionId = input.id;
        if (questionId) {
          await db.update(questions).set(questionValues).where(eq(questions.id, questionId));
          await db.delete(questionOptions).where(eq(questionOptions.questionId, questionId));
        } else {
          const result = await db.insert(questions).values(questionValues);
          questionId = Number(result[0].insertId);
        }
        await db.insert(questionOptions).values(input.options.map((option, index) => ({ questionId: questionId!, position: index + 1, label: option.label, isCorrect: option.isCorrect })));
        return { id: questionId };
      }),
    updateParticipant: adminProcedure
      .input(z.object({ participantId: z.number().int().positive(), fullName: z.string().trim().min(3).max(140), nickname: z.string().trim().min(2).max(80), contact: z.string().trim().min(5).max(320) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Banco indisponível.");
        await db.update(participantProfiles).set(input).where(eq(participantProfiles.id, input.participantId));
        return { success: true };
      }),
    moveParticipant: adminProcedure.input(z.object({ participantId: z.number().int().positive(), teamId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco indisponível.");
      await db.update(participantProfiles).set({ teamId: input.teamId }).where(eq(participantProfiles.id, input.participantId));
      return { success: true };
    }),
    blockParticipant: adminProcedure.input(z.object({ participantId: z.number().int().positive(), isBlocked: z.boolean() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco indisponível.");
      await db.update(participantProfiles).set({ isBlocked: input.isBlocked }).where(eq(participantProfiles.id, input.participantId));
      return { success: true };
    }),
    deleteParticipant: adminProcedure.input(z.object({ participantId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco indisponível.");
      const profile = await db.select({ id: participantProfiles.id }).from(participantProfiles).where(eq(participantProfiles.id, input.participantId)).limit(1);
      if (!profile[0]) throw new Error("Participante não encontrado ou já removido.");
      await db.delete(answers).where(eq(answers.participantId, input.participantId));
      await db.delete(roundScores).where(eq(roundScores.participantId, input.participantId));
      await db.delete(scoreAdjustments).where(eq(scoreAdjustments.participantId, input.participantId));
      await db.delete(participantProfiles).where(eq(participantProfiles.id, input.participantId));
      return { success: true };
    }),
    adjustScore: adminProcedure.input(z.object({ participantId: z.number().int().positive(), roundId: z.number().int().positive().nullable().optional(), points: z.number().int().min(-10000).max(10000).refine(value => value !== 0), reason: z.string().trim().min(3).max(240) })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco indisponível.");
      await db.insert(scoreAdjustments).values({ ...input, roundId: input.roundId ?? null, createdByUserId: ctx.user.id });
      return { success: true };
    }),
    saveTeam: adminProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(2).max(80), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/), accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/), symbol: z.string().trim().min(1).max(12), description: z.string().max(800).nullable().optional(), logoUrl: z.string().max(1000).nullable().optional(), logoKey: z.string().max(512).nullable().optional() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco indisponível.");
      await db.update(teams).set({ ...input, description: input.description ?? null, logoUrl: input.logoUrl ?? null, logoKey: input.logoKey ?? null }).where(eq(teams.id, input.id));
      return { success: true };
    }),
    createTeam: adminProcedure.input(z.object({ name: z.string().trim().min(2).max(80), slug: z.string().trim().regex(/^[a-z0-9-]{2,80}$/), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/), accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/), symbol: z.string().trim().min(1).max(12), description: z.string().max(800).nullable().optional() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco indisponível.");
      const allTeams = await db.select({ id: teams.id }).from(teams);
      if (allTeams.length >= 4) throw new Error("A gincana trabalha com quatro equipes. Edite uma equipe existente ou remova uma equipe sem participantes antes de criar outra.");
      const result = await db.insert(teams).values({ ...input, description: input.description ?? null });
      return { id: Number(result[0].insertId) };
    }),
    deleteTeam: adminProcedure.input(z.object({ teamId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco indisponível.");
      const members = await db.select({ id: participantProfiles.id }).from(participantProfiles).where(eq(participantProfiles.teamId, input.teamId)).limit(1);
      if (members.length) throw new Error("Não é possível excluir uma equipe que ainda possui participantes.");
      await db.delete(teams).where(eq(teams.id, input.teamId));
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
