import { and, asc, desc, eq, inArray, like, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { randomUUID } from "node:crypto";
import {
  answers,
  adminRoleChanges,
  InsertUser,
  participantProfiles,
  passwordResetTokens,
  questionOptions,
  questions,
  rounds,
  roundQuestionAttempts,
  roundScores,
  scoreAdjustments,
  teams,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await requireDb();
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function createPasswordUser(input: { email: string; name: string; passwordHash: string }) {
  const db = await requireDb();
  const openId = `local_${randomUUID()}`;
  const result = await db.insert(users).values({
    openId,
    email: input.email,
    name: input.name,
    passwordHash: input.passwordHash,
    loginMethod: "password",
  });
  return getUserById(Number(result[0].insertId));
}

export async function getUserById(userId: number) {
  const db = await requireDb();
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0];
}

export async function updateLastSignedIn(userId: number) {
  const db = await requireDb();
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

export async function listAdminUsers(input: { search?: string; role?: "all" | "user" | "admin" }) {
  const db = await requireDb();
  const search = input.search?.trim();
  const conditions = [];
  if (input.role && input.role !== "all") conditions.push(eq(users.role, input.role));
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(or(like(users.name, pattern), like(users.email, pattern), like(participantProfiles.nickname, pattern)));
  }
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
      fullName: participantProfiles.fullName,
      nickname: participantProfiles.nickname,
      contact: participantProfiles.contact,
      isBlocked: participantProfiles.isBlocked,
      teamName: teams.name,
      teamColor: teams.color,
    })
    .from(users)
    .leftJoin(participantProfiles, eq(participantProfiles.userId, users.id))
    .leftJoin(teams, eq(participantProfiles.teamId, teams.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(users.name), asc(users.email));
}

export async function listAdminRoleChanges() {
  const db = await requireDb();
  const changes = await db.select().from(adminRoleChanges).orderBy(desc(adminRoleChanges.createdAt)).limit(100);
  const userIds = Array.from(new Set(changes.flatMap(change => [change.targetUserId, change.actorUserId])));
  if (!userIds.length) return [];
  const usersById = new Map(
    (await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, userIds))).map(user => [user.id, user])
  );
  return changes.map(change => ({
    ...change,
    targetUser: usersById.get(change.targetUserId) ?? null,
    actorUser: usersById.get(change.actorUserId) ?? null,
  }));
}

export async function updateAdminUserRole(
  input: { actorUserId: number; targetUserId: number; role: "user" | "admin"; ownerOpenId: string },
  database?: Awaited<ReturnType<typeof requireDb>>
) {
  const db = database ?? (await requireDb());
  return db.transaction(async tx => {
    const target = await tx
      .select({ id: users.id, openId: users.openId, role: users.role })
      .from(users)
      .where(eq(users.id, input.targetUserId))
      .limit(1);
    if (!target[0]) throw new Error("Usuário não encontrado.");
    if (target[0].role === input.role) return { changed: false as const, role: target[0].role };
    if (input.role === "user" && target[0].openId === input.ownerOpenId) throw new Error("O administrador principal não pode ser rebaixado.");
    if (input.role === "user" && target[0].id === input.actorUserId) throw new Error("Você não pode remover o próprio acesso administrativo.");
    if (input.role === "user") {
      const admins = await tx.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
      if (admins.length <= 1) throw new Error("O sistema precisa manter pelo menos um administrador.");
    }
    await tx
      .update(users)
      .set({ role: input.role, ...(input.role === "user" ? { sessionVersion: sql`${users.sessionVersion} + 1` } : {}) })
      .where(eq(users.id, input.targetUserId));
    await tx.insert(adminRoleChanges).values({
      targetUserId: input.targetUserId,
      actorUserId: input.actorUserId,
      previousRole: target[0].role,
      nextRole: input.role,
    });
    return { changed: true as const, role: input.role };
  });
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await requireDb();
  await db.update(users).set({ passwordHash, sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, userId));
}

export async function createPasswordResetToken(input: { userId: number; tokenHash: string; expiresAt: Date }) {
  const db = await requireDb();
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, input.userId));
  await db.insert(passwordResetTokens).values(input);
}

export async function getPasswordResetToken(tokenHash: string) {
  const db = await requireDb();
  const result = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash)).limit(1);
  return result[0];
}

export async function markPasswordResetTokenUsed(tokenId: number) {
  const db = await requireDb();
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, tokenId));
}

export function deriveRoundState(
  round: { startsAt: number; endsAt: number; lifecycle: "draft" | "processing" | "result"; closingWindowSeconds: number },
  now = Date.now()
) {
  if (round.lifecycle === "result") return "RESULTADO" as const;
  if (round.lifecycle === "processing") return "PROCESSANDO" as const;
  if (now < round.startsAt) return "AGUARDANDO" as const;
  if (now >= round.endsAt) return "ENCERRADA" as const;
  if (round.endsAt - now <= round.closingWindowSeconds * 1000) return "ENCERRANDO" as const;
  return "LIBERADA" as const;
}

export function canAcceptRoundAnswers(
  round: { startsAt: number; endsAt: number; lifecycle: "draft" | "processing" | "result"; closingWindowSeconds: number },
  now = Date.now()
) {
  const state = deriveRoundState(round, now);
  return state === "LIBERADA" || state === "ENCERRANDO";
}

export function calculateQuestionScore(points: number, responseTimeMs: number, timeLimitSeconds: number) {
  if (points <= 0 || timeLimitSeconds <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, responseTimeMs / (timeLimitSeconds * 1000)));
  return Math.max(1, Math.round(points * (1 - 0.5 * ratio)));
}

export function getQuestionDeadline(startedAt: number, timeLimitSeconds: number, roundEndsAt: number) {
  return Math.min(startedAt + Math.max(1, timeLimitSeconds) * 1000, roundEndsAt);
}

export function summarizeSubmittedAnswers(rows: Array<{ participantId: number; isCorrect: boolean; points: number; responseTimeMs?: number | null }>) {
  const totals = new Map<number, { answeredCount: number; correctCount: number; points: number; correctResponseTimeMs: number }>();
  rows.forEach(answer => {
    const current = totals.get(answer.participantId) ?? { answeredCount: 0, correctCount: 0, points: 0, correctResponseTimeMs: 0 };
    current.answeredCount += 1;
    if (answer.isCorrect) {
      current.correctCount += 1;
      current.points += answer.points;
      current.correctResponseTimeMs += answer.responseTimeMs ?? 0;
    }
    totals.set(answer.participantId, current);
  });
  return totals;
}

export function canCreateParticipantProfile(existingProfile: unknown) {
  return !existingProfile;
}

export function canSubmitParticipantAnswer(input: {
  isBlocked: boolean;
  hasExistingAnswer: boolean;
  round: { startsAt: number; endsAt: number; lifecycle: "draft" | "processing" | "result"; closingWindowSeconds: number };
  now?: number;
}) {
  return !input.isBlocked && !input.hasExistingAnswer && canAcceptRoundAnswers(input.round, input.now);
}

export function buildRankings(
  teamRows: Array<{ id: number; name: string; color: string; accentColor: string; symbol: string; slug: string; description: string | null; logoUrl: string | null; logoKey: string | null; createdAt: Date; updatedAt: Date }>,
  profileRows: Array<{ id: number; teamId: number; nickname: string; fullName: string; avatarUrl: string | null; isBlocked: boolean }>,
  scoreRows: Array<{ participantId: number; points: number; correctResponseTimeMs?: number }>,
  adjustmentRows: Array<{ participantId: number; points: number }>
) {
  const totalsByParticipant = new Map<number, { points: number; correctResponseTimeMs: number }>();
  scoreRows.forEach(score => {
    const current = totalsByParticipant.get(score.participantId) ?? { points: 0, correctResponseTimeMs: 0 };
    current.points += score.points;
    current.correctResponseTimeMs += score.correctResponseTimeMs ?? 0;
    totalsByParticipant.set(score.participantId, current);
  });
  adjustmentRows.forEach(adjustment => {
    const current = totalsByParticipant.get(adjustment.participantId) ?? { points: 0, correctResponseTimeMs: 0 };
    current.points += adjustment.points;
    totalsByParticipant.set(adjustment.participantId, current);
  });
  const participants = profileRows
    .map(profile => {
      const total = totalsByParticipant.get(profile.id) ?? { points: 0, correctResponseTimeMs: 0 };
      return { participantId: profile.id, teamId: profile.teamId, nickname: profile.nickname, fullName: profile.fullName, avatarUrl: profile.avatarUrl, isBlocked: profile.isBlocked, points: total.points, correctResponseTimeMs: total.correctResponseTimeMs };
    })
    .sort((a, b) => b.points - a.points || a.correctResponseTimeMs - b.correctResponseTimeMs || a.nickname.localeCompare(b.nickname))
    .map((participant, index) => ({ ...participant, rank: index + 1 }));
  const teams = teamRows
    .map(team => {
      const members = participants.filter(participant => participant.teamId === team.id);
      const points = members.reduce((total, participant) => total + participant.points, 0);
      const correctResponseTimeMs = members.reduce((total, participant) => total + participant.correctResponseTimeMs, 0);
      return { ...team, points, correctResponseTimeMs, memberCount: members.length, averagePoints: members.length ? Math.round(points / members.length) : 0, members };
    })
    .sort((a, b) => b.points - a.points || a.correctResponseTimeMs - b.correctResponseTimeMs || a.name.localeCompare(b.name))
    .map((team, index) => ({ ...team, rank: index + 1 }));
  return { teams, participants };
}

export async function getProfileByUserId(userId: number) {
  const db = await requireDb();
  const rows = await db
    .select({
      id: participantProfiles.id,
      userId: participantProfiles.userId,
      teamId: participantProfiles.teamId,
      fullName: participantProfiles.fullName,
      nickname: participantProfiles.nickname,
      contact: participantProfiles.contact,
      avatarUrl: participantProfiles.avatarUrl,
      avatarKey: participantProfiles.avatarKey,
      isBlocked: participantProfiles.isBlocked,
      joinedAt: participantProfiles.joinedAt,
      teamName: teams.name,
      teamSlug: teams.slug,
      teamColor: teams.color,
      teamAccentColor: teams.accentColor,
      teamSymbol: teams.symbol,
      teamLogoUrl: teams.logoUrl,
    })
    .from(participantProfiles)
    .innerJoin(teams, eq(participantProfiles.teamId, teams.id))
    .where(eq(participantProfiles.userId, userId))
    .limit(1);
  return rows[0];
}

export async function getProfileById(profileId: number) {
  const db = await requireDb();
  const rows = await db.select().from(participantProfiles).where(eq(participantProfiles.id, profileId)).limit(1);
  return rows[0];
}

export async function createParticipantProfile(input: {
  userId: number;
  fullName: string;
  nickname: string;
  contact: string;
  teamId: number;
  avatarUrl?: string | null;
  avatarKey?: string | null;
}) {
  const db = await requireDb();
  const selectedTeam = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, input.teamId)).limit(1);
  if (!selectedTeam[0]) throw new Error("Equipe inválida.");
  const existing = await getProfileByUserId(input.userId);
  if (!canCreateParticipantProfile(existing)) throw new Error("Seu cadastro já foi concluído e a equipe só pode ser alterada pela administração.");
  await db.insert(participantProfiles).values({ ...input });
  return getProfileByUserId(input.userId);
}

export async function listTeams() {
  const db = await requireDb();
  return db.select().from(teams).orderBy(asc(teams.name));
}

export async function processExpiredRounds(now = Date.now()) {
  const db = await requireDb();
  const expired = await db
    .select()
    .from(rounds)
    .where(and(lte(rounds.endsAt, now), eq(rounds.lifecycle, "draft")));

  for (const round of expired) {
    await db.update(rounds).set({ lifecycle: "processing" }).where(eq(rounds.id, round.id));
    const submitted = await db
      .select({
        participantId: answers.participantId,
        isCorrect: questionOptions.isCorrect,
        points: questions.points,
        responseTimeMs: roundQuestionAttempts.responseTimeMs,
      })
      .from(answers)
      .innerJoin(questionOptions, eq(answers.selectedOptionId, questionOptions.id))
      .innerJoin(questions, eq(answers.questionId, questions.id))
      .leftJoin(roundQuestionAttempts, and(
        eq(roundQuestionAttempts.roundId, round.id),
        eq(roundQuestionAttempts.participantId, answers.participantId),
        eq(roundQuestionAttempts.questionId, answers.questionId)
      ))
      .where(eq(questions.roundId, round.id));

    const totals = summarizeSubmittedAnswers(submitted.map(answer => ({
      ...answer,
      points: answer.responseTimeMs === null
        ? answer.points
        : calculateQuestionScore(answer.points, answer.responseTimeMs ?? 0, round.questionTimeLimitSeconds),
    })));

    const scoreRows = Array.from(totals.entries()).map(([participantId, score]) => ({
      roundId: round.id,
      participantId,
      ...score,
      processedAt: new Date(),
    }));
    if (scoreRows.length) {
      await db.insert(roundScores).values(scoreRows).onDuplicateKeyUpdate({
        set: {
          answeredCount: sql`VALUES(${roundScores.answeredCount})`,
          correctCount: sql`VALUES(${roundScores.correctCount})`,
          points: sql`VALUES(${roundScores.points})`,
          correctResponseTimeMs: sql`VALUES(${roundScores.correctResponseTimeMs})`,
          processedAt: new Date(),
        },
      });
    }
    await db.update(rounds).set({ lifecycle: "result", processedAt: new Date() }).where(eq(rounds.id, round.id));
  }
}

export async function getRankingData() {
  await processExpiredRounds();
  const db = await requireDb();
  const [teamRows, profileRows, scoreRows, adjustmentRows] = await Promise.all([
    db.select().from(teams),
    db.select().from(participantProfiles),
    db.select().from(roundScores),
    db.select().from(scoreAdjustments),
  ]);

  return buildRankings(teamRows, profileRows, scoreRows, adjustmentRows);
}

/**
 * Public ranking contract. Keep this projection intentionally separate from
 * the authenticated/admin ranking because the public endpoint must not expose
 * full names, profile photos, storage keys, contacts, or other private fields.
 */
export function toPublicRanking(ranking: ReturnType<typeof buildRankings>) {
  return {
    teams: ranking.teams.map(team => ({
      id: team.id,
      name: team.name,
      color: team.color,
      accentColor: team.accentColor,
      symbol: team.symbol,
      points: team.points,
      memberCount: team.memberCount,
      averagePoints: team.averagePoints,
      rank: team.rank,
    })),
    participants: ranking.participants.map(participant => ({
      participantId: participant.participantId,
      teamId: participant.teamId,
      nickname: participant.nickname,
      points: participant.points,
      rank: participant.rank,
    })),
  };
}

export async function getPublicRankingData() {
  return toPublicRanking(await getRankingData());
}

export async function getParticipantHistory(participantId: number) {
  const db = await requireDb();
  const history = await db
    .select({
      roundId: roundScores.roundId,
      title: rounds.title,
      startsAt: rounds.startsAt,
      answeredCount: roundScores.answeredCount,
      correctCount: roundScores.correctCount,
      points: roundScores.points,
    })
    .from(roundScores)
    .innerJoin(rounds, eq(roundScores.roundId, rounds.id))
    .where(eq(roundScores.participantId, participantId))
    .orderBy(desc(rounds.startsAt));
  const adjustments = await db
    .select({ id: scoreAdjustments.id, points: scoreAdjustments.points, reason: scoreAdjustments.reason, createdAt: scoreAdjustments.createdAt })
    .from(scoreAdjustments)
    .where(eq(scoreAdjustments.participantId, participantId))
    .orderBy(desc(scoreAdjustments.createdAt));
  return { history, adjustments };
}

export async function getRoundQuestionSet(roundId: number, includeAnswers = false) {
  const db = await requireDb();
  const rows = await db
    .select({
      questionId: questions.id,
      position: questions.position,
      prompt: questions.prompt,
      imageUrl: questions.imageUrl,
      videoUrl: questions.videoUrl,
      points: questions.points,
      timeLimitSeconds: questions.timeLimitSeconds,
      optionId: questionOptions.id,
      optionPosition: questionOptions.position,
      label: questionOptions.label,
      isCorrect: questionOptions.isCorrect,
    })
    .from(questions)
    .innerJoin(questionOptions, eq(questions.id, questionOptions.questionId))
    .where(eq(questions.roundId, roundId))
    .orderBy(asc(questions.position), asc(questionOptions.position));

  const map = new Map<number, any>();
  rows.forEach(row => {
    const existing = map.get(row.questionId) ?? {
      id: row.questionId,
      position: row.position,
      prompt: row.prompt,
      imageUrl: row.imageUrl,
      videoUrl: row.videoUrl,
      points: row.points,
      timeLimitSeconds: row.timeLimitSeconds,
      options: [],
    };
    existing.options.push({ id: row.optionId, position: row.optionPosition, label: row.label, ...(includeAnswers ? { isCorrect: row.isCorrect } : {}) });
    map.set(row.questionId, existing);
  });
  return Array.from(map.values());
}

export async function getRoundById(roundId: number) {
  const db = await requireDb();
  const row = await db.select().from(rounds).where(eq(rounds.id, roundId)).limit(1);
  return row[0];
}

async function getParticipantAttemptRows(participantId: number, roundId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(roundQuestionAttempts)
    .where(and(eq(roundQuestionAttempts.participantId, participantId), eq(roundQuestionAttempts.roundId, roundId)));
}

export async function getParticipantRoundProgress(participantId: number, roundId: number, now = Date.now()) {
  const db = await requireDb();
  const questionRows = await db
    .select({ id: questions.id, position: questions.position })
    .from(questions)
    .where(eq(questions.roundId, roundId))
    .orderBy(asc(questions.position));
  let attemptRows = await getParticipantAttemptRows(participantId, roundId);
  const activeAttempt = attemptRows.find(attempt => attempt.status === "active");
  if (activeAttempt && now >= activeAttempt.deadlineAt) {
    await db
      .update(roundQuestionAttempts)
      .set({ status: "expired", completedAt: activeAttempt.deadlineAt, responseTimeMs: null })
      .where(and(eq(roundQuestionAttempts.id, activeAttempt.id), eq(roundQuestionAttempts.status, "active")));
    attemptRows = await getParticipantAttemptRows(participantId, roundId);
  }
  const currentAttempt = attemptRows.find(attempt => attempt.status === "active") ?? null;
  const attemptMap = Object.fromEntries(attemptRows.map(attempt => [attempt.questionId, {
    status: attempt.status,
    startedAt: attempt.startedAt,
    deadlineAt: attempt.deadlineAt,
    completedAt: attempt.completedAt,
    responseTimeMs: attempt.responseTimeMs,
  }]));
  const nextQuestion = questionRows.find(question => !attemptMap[question.id]);
  return {
    activeQuestionId: currentAttempt?.questionId ?? nextQuestion?.id ?? null,
    activeAttempt: currentAttempt,
    completed: !currentAttempt && !nextQuestion,
    attempts: attemptMap,
  };
}

export async function startParticipantQuestion(input: { userId: number; roundId: number }) {
  await processExpiredRounds();
  const db = await requireDb();
  const profile = await getProfileByUserId(input.userId);
  const round = await getRoundById(input.roundId);
  if (!profile) throw new Error("Conclua seu cadastro antes de responder.");
  if (!round || !canAcceptRoundAnswers(round)) throw new Error("Esta rodada não está disponível para respostas.");
  if (profile.isBlocked) throw new Error("Sua participação está bloqueada. Procure a administração.");

  const questionSet = await getRoundQuestionSet(round.id);
  const progress = await getParticipantRoundProgress(profile.id, round.id);
  if (progress.activeAttempt) return { completed: false, attempt: progress.activeAttempt };
  const nextQuestion = questionSet.find(question => !progress.attempts[question.id]);
  if (!nextQuestion) return { completed: true, attempt: null };

  const startedAt = Date.now();
  const deadlineAt = getQuestionDeadline(startedAt, round.questionTimeLimitSeconds, round.endsAt);
  try {
    await db.insert(roundQuestionAttempts).values({
      roundId: round.id,
      participantId: profile.id,
      questionId: nextQuestion.id,
      status: "active",
      startedAt,
      deadlineAt,
    });
  } catch {
    const existing = await db
      .select()
      .from(roundQuestionAttempts)
      .where(and(
        eq(roundQuestionAttempts.roundId, round.id),
        eq(roundQuestionAttempts.participantId, profile.id),
        eq(roundQuestionAttempts.questionId, nextQuestion.id)
      ))
      .limit(1);
    if (!existing[0]) throw new Error("Não foi possível iniciar a pergunta.");
    return { completed: false, attempt: existing[0] };
  }
  const attempt = await db
    .select()
    .from(roundQuestionAttempts)
    .where(and(
      eq(roundQuestionAttempts.roundId, round.id),
      eq(roundQuestionAttempts.participantId, profile.id),
      eq(roundQuestionAttempts.questionId, nextQuestion.id)
    ))
    .limit(1);
  return { completed: false, attempt: attempt[0] ?? null };
}

export async function getUpcomingRound() {
  const db = await requireDb();
  const all = await db.select().from(rounds).orderBy(asc(rounds.startsAt));
  const now = Date.now();
  const active = all.find(round => deriveRoundState(round, now) === "LIBERADA" || deriveRoundState(round, now) === "ENCERRANDO");
  const next = all.find(round => round.startsAt > now);
  const selected = active ?? next ?? all.filter(round => round.lifecycle === "result").at(-1);
  return selected ? { ...selected, state: deriveRoundState(selected, now), serverTime: now } : null;
}

export async function submitParticipantAnswer(input: { userId: number; questionId: number; selectedOptionId: number }) {
  await processExpiredRounds();
  const db = await requireDb();
  const profile = await getProfileByUserId(input.userId);
  if (!profile) throw new Error("Conclua seu cadastro antes de responder.");
  const question = await db
    .select({ questionId: questions.id, roundId: rounds.id, startsAt: rounds.startsAt, endsAt: rounds.endsAt, lifecycle: rounds.lifecycle, closingWindowSeconds: rounds.closingWindowSeconds, questionTimeLimitSeconds: rounds.questionTimeLimitSeconds })
    .from(questions)
    .innerJoin(rounds, eq(questions.roundId, rounds.id))
    .where(eq(questions.id, input.questionId))
    .limit(1);
  const item = question[0];
  if (!item || !canAcceptRoundAnswers(item)) throw new Error("Esta rodada não está disponível para respostas.");
  const existingAnswer = await db
    .select({ id: answers.id })
    .from(answers)
    .where(and(eq(answers.participantId, profile.id), eq(answers.questionId, input.questionId)))
    .limit(1);
  if (!canSubmitParticipantAnswer({ isBlocked: profile.isBlocked, hasExistingAnswer: Boolean(existingAnswer[0]), round: item })) {
    if (profile.isBlocked) throw new Error("Sua participação está bloqueada. Procure a administração.");
    throw new Error("Esta resposta já foi enviada e não pode ser alterada.");
  }
  const progress = await getParticipantRoundProgress(profile.id, item.roundId);
  if (progress.activeQuestionId !== input.questionId || !progress.activeAttempt || progress.activeAttempt.questionId !== input.questionId) {
    throw new Error("Responda a pergunta atual antes de avançar.");
  }
  const now = Date.now();
  if (now >= progress.activeAttempt.deadlineAt) {
    await db.update(roundQuestionAttempts).set({ status: "expired", completedAt: progress.activeAttempt.deadlineAt, responseTimeMs: null }).where(and(eq(roundQuestionAttempts.id, progress.activeAttempt.id), eq(roundQuestionAttempts.status, "active")));
    throw new Error("O tempo desta pergunta acabou.");
  }
  const option = await db
    .select({ id: questionOptions.id })
    .from(questionOptions)
    .where(and(eq(questionOptions.id, input.selectedOptionId), eq(questionOptions.questionId, input.questionId)))
    .limit(1);
  if (!option[0]) throw new Error("Alternativa inválida.");
  const responseTimeMs = Math.max(0, now - progress.activeAttempt.startedAt);
  try {
    await db.transaction(async tx => {
      const updated = await tx
        .update(roundQuestionAttempts)
        .set({ status: "answered", completedAt: now, responseTimeMs })
        .where(and(eq(roundQuestionAttempts.id, progress.activeAttempt!.id), eq(roundQuestionAttempts.status, "active")));
      if (!updated[0]?.affectedRows) throw new Error("O tempo desta pergunta acabou.");
      await tx.insert(answers).values({ participantId: profile.id, questionId: input.questionId, selectedOptionId: input.selectedOptionId });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "O tempo desta pergunta acabou.") throw error;
    throw new Error("Esta resposta já foi enviada e não pode ser alterada.");
  }
  return { success: true };
}

export async function getSubmittedAnswerMap(participantId: number, questionIds: number[]) {
  if (!questionIds.length) return {} as Record<number, number>;
  const db = await requireDb();
  const rows = await db
    .select({ questionId: answers.questionId, selectedOptionId: answers.selectedOptionId })
    .from(answers)
    .where(and(eq(answers.participantId, participantId), inArray(answers.questionId, questionIds)));
  return Object.fromEntries(rows.map(row => [row.questionId, row.selectedOptionId]));
}

export async function getTeamHistory(teamId: number) {
  const db = await requireDb();
  const rows = await db
    .select({
      roundId: rounds.id,
      title: rounds.title,
      startsAt: rounds.startsAt,
      points: roundScores.points,
      participantId: participantProfiles.id,
    })
    .from(roundScores)
    .innerJoin(participantProfiles, eq(roundScores.participantId, participantProfiles.id))
    .innerJoin(rounds, eq(roundScores.roundId, rounds.id))
    .where(eq(participantProfiles.teamId, teamId))
    .orderBy(asc(rounds.startsAt));
  const totals = new Map<number, { roundId: number; title: string; startsAt: number; points: number }>();
  rows.forEach(row => {
    const current = totals.get(row.roundId) ?? { roundId: row.roundId, title: row.title, startsAt: row.startsAt, points: 0 };
    current.points += row.points;
    totals.set(row.roundId, current);
  });
  return Array.from(totals.values());
}
