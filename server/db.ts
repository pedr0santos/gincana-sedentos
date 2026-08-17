import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  answers,
  InsertUser,
  participantProfiles,
  questionOptions,
  questions,
  rounds,
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

const defaultTeams = [
  { name: "Aurora", slug: "aurora", color: "#16b8b0", accentColor: "#85fff3", symbol: "✦", description: "Energia que desperta a competição." },
  { name: "Brasa", slug: "brasa", color: "#f26b38", accentColor: "#ffbf81", symbol: "◆", description: "Coragem para incendiar a disputa." },
  { name: "Pulsar", slug: "pulsar", color: "#6477ff", accentColor: "#c7d1ff", symbol: "◉", description: "Ritmo, precisão e velocidade." },
  { name: "Vértice", slug: "vertice", color: "#b768e7", accentColor: "#f1c5ff", symbol: "▲", description: "Estratégia para chegar ao topo." },
];

export async function ensureDefaultTeams() {
  const db = await requireDb();
  const existing = await db.select({ id: teams.id }).from(teams).limit(1);
  if (!existing.length) await db.insert(teams).values(defaultTeams);
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

export function summarizeSubmittedAnswers(rows: Array<{ participantId: number; isCorrect: boolean; points: number }>) {
  const totals = new Map<number, { answeredCount: number; correctCount: number; points: number }>();
  rows.forEach(answer => {
    const current = totals.get(answer.participantId) ?? { answeredCount: 0, correctCount: 0, points: 0 };
    current.answeredCount += 1;
    if (answer.isCorrect) {
      current.correctCount += 1;
      current.points += answer.points;
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
  scoreRows: Array<{ participantId: number; points: number }>,
  adjustmentRows: Array<{ participantId: number; points: number }>
) {
  const totalsByParticipant = new Map<number, number>();
  scoreRows.forEach(score => totalsByParticipant.set(score.participantId, (totalsByParticipant.get(score.participantId) ?? 0) + score.points));
  adjustmentRows.forEach(adjustment => totalsByParticipant.set(adjustment.participantId, (totalsByParticipant.get(adjustment.participantId) ?? 0) + adjustment.points));
  const participants = profileRows
    .map(profile => ({ participantId: profile.id, teamId: profile.teamId, nickname: profile.nickname, fullName: profile.fullName, avatarUrl: profile.avatarUrl, isBlocked: profile.isBlocked, points: totalsByParticipant.get(profile.id) ?? 0 }))
    .sort((a, b) => b.points - a.points || a.nickname.localeCompare(b.nickname))
    .map((participant, index) => ({ ...participant, rank: index + 1 }));
  const teams = teamRows
    .map(team => {
      const members = participants.filter(participant => participant.teamId === team.id);
      const points = members.reduce((total, participant) => total + participant.points, 0);
      return { ...team, points, memberCount: members.length, averagePoints: members.length ? Math.round(points / members.length) : 0, members };
    })
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
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
  await ensureDefaultTeams();
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
      })
      .from(answers)
      .innerJoin(questionOptions, eq(answers.selectedOptionId, questionOptions.id))
      .innerJoin(questions, eq(answers.questionId, questions.id))
      .where(eq(questions.roundId, round.id));

    const totals = summarizeSubmittedAnswers(submitted);

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
          processedAt: new Date(),
        },
      });
    }
    await db.update(rounds).set({ lifecycle: "result", processedAt: new Date() }).where(eq(rounds.id, round.id));
  }
}

export async function getRankingData() {
  await ensureDefaultTeams();
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
    .select({ questionId: questions.id, roundId: rounds.id, startsAt: rounds.startsAt, endsAt: rounds.endsAt, lifecycle: rounds.lifecycle, closingWindowSeconds: rounds.closingWindowSeconds })
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
  const option = await db
    .select({ id: questionOptions.id })
    .from(questionOptions)
    .where(and(eq(questionOptions.id, input.selectedOptionId), eq(questionOptions.questionId, input.questionId)))
    .limit(1);
  if (!option[0]) throw new Error("Alternativa inválida.");
  try {
    await db.insert(answers).values({ participantId: profile.id, questionId: input.questionId, selectedOptionId: input.selectedOptionId });
  } catch {
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
