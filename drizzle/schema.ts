import {
  bigint,
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const teams = mysqlTable(
  "teams",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 80 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    color: varchar("color", { length: 16 }).notNull(),
    accentColor: varchar("accentColor", { length: 16 }).notNull(),
    symbol: varchar("symbol", { length: 12 }).notNull().default("⚡"),
    description: text("description"),
    logoUrl: text("logoUrl"),
    logoKey: varchar("logoKey", { length: 512 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("teams_slug_unique").on(table.slug)]
);

export const participantProfiles = mysqlTable(
  "participant_profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: int("teamId")
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    fullName: varchar("fullName", { length: 140 }).notNull(),
    nickname: varchar("nickname", { length: 80 }).notNull(),
    contact: varchar("contact", { length: 320 }).notNull(),
    avatarUrl: text("avatarUrl"),
    avatarKey: varchar("avatarKey", { length: 512 }),
    isBlocked: boolean("isBlocked").notNull().default(false),
    joinedAt: timestamp("joinedAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("participant_profiles_user_unique").on(table.userId),
    index("participant_profiles_team_idx").on(table.teamId),
  ]
);

export const rounds = mysqlTable(
  "rounds",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 120 }).notNull(),
    description: text("description"),
    startsAt: bigint("startsAt", { mode: "number" }).notNull(),
    endsAt: bigint("endsAt", { mode: "number" }).notNull(),
    lifecycle: mysqlEnum("lifecycle", ["draft", "processing", "result"])
      .notNull()
      .default("draft"),
    closingWindowSeconds: int("closingWindowSeconds").notNull().default(60),
    notifyBeforeMinutes: int("notifyBeforeMinutes").notNull().default(10),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    processedAt: timestamp("processedAt"),
  },
  table => [index("rounds_schedule_idx").on(table.startsAt, table.endsAt)]
);

export const questions = mysqlTable(
  "questions",
  {
    id: int("id").autoincrement().primaryKey(),
    roundId: int("roundId")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    position: int("position").notNull(),
    prompt: text("prompt").notNull(),
    imageUrl: text("imageUrl"),
    imageKey: varchar("imageKey", { length: 512 }),
    videoUrl: text("videoUrl"),
    videoKey: varchar("videoKey", { length: 512 }),
    points: int("points").notNull().default(10),
    timeLimitSeconds: int("timeLimitSeconds"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("questions_round_position_unique").on(table.roundId, table.position),
    index("questions_round_idx").on(table.roundId),
  ]
);

export const questionOptions = mysqlTable(
  "question_options",
  {
    id: int("id").autoincrement().primaryKey(),
    questionId: int("questionId")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    position: int("position").notNull(),
    label: text("label").notNull(),
    isCorrect: boolean("isCorrect").notNull().default(false),
  },
  table => [
    uniqueIndex("question_options_position_unique").on(table.questionId, table.position),
    index("question_options_question_idx").on(table.questionId),
  ]
);

export const answers = mysqlTable(
  "answers",
  {
    id: int("id").autoincrement().primaryKey(),
    participantId: int("participantId")
      .notNull()
      .references(() => participantProfiles.id, { onDelete: "cascade" }),
    questionId: int("questionId")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    selectedOptionId: int("selectedOptionId")
      .notNull()
      .references(() => questionOptions.id, { onDelete: "restrict" }),
    submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("answers_participant_question_unique").on(table.participantId, table.questionId),
    index("answers_question_idx").on(table.questionId),
  ]
);

export const roundScores = mysqlTable(
  "round_scores",
  {
    id: int("id").autoincrement().primaryKey(),
    roundId: int("roundId")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    participantId: int("participantId")
      .notNull()
      .references(() => participantProfiles.id, { onDelete: "cascade" }),
    answeredCount: int("answeredCount").notNull().default(0),
    correctCount: int("correctCount").notNull().default(0),
    points: int("points").notNull().default(0),
    processedAt: timestamp("processedAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("round_scores_participant_round_unique").on(table.roundId, table.participantId),
    index("round_scores_participant_idx").on(table.participantId),
  ]
);

export const scoreAdjustments = mysqlTable(
  "score_adjustments",
  {
    id: int("id").autoincrement().primaryKey(),
    participantId: int("participantId")
      .notNull()
      .references(() => participantProfiles.id, { onDelete: "cascade" }),
    roundId: int("roundId").references(() => rounds.id, { onDelete: "set null" }),
    points: int("points").notNull(),
    reason: varchar("reason", { length: 240 }).notNull(),
    createdByUserId: int("createdByUserId")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("score_adjustments_participant_idx").on(table.participantId),
    index("score_adjustments_round_idx").on(table.roundId),
  ]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type ParticipantProfile = typeof participantProfiles.$inferSelect;
export type GameRound = typeof rounds.$inferSelect;
