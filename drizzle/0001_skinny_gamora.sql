CREATE TABLE `answers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`participantId` int NOT NULL,
	`questionId` int NOT NULL,
	`selectedOptionId` int NOT NULL,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `answers_id` PRIMARY KEY(`id`),
	CONSTRAINT `answers_participant_question_unique` UNIQUE(`participantId`,`questionId`)
);
--> statement-breakpoint
CREATE TABLE `participant_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`teamId` int NOT NULL,
	`fullName` varchar(140) NOT NULL,
	`nickname` varchar(80) NOT NULL,
	`contact` varchar(320) NOT NULL,
	`avatarUrl` text,
	`avatarKey` varchar(512),
	`isBlocked` boolean NOT NULL DEFAULT false,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `participant_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `participant_profiles_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `question_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`questionId` int NOT NULL,
	`position` int NOT NULL,
	`label` text NOT NULL,
	`isCorrect` boolean NOT NULL DEFAULT false,
	CONSTRAINT `question_options_id` PRIMARY KEY(`id`),
	CONSTRAINT `question_options_position_unique` UNIQUE(`questionId`,`position`)
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roundId` int NOT NULL,
	`position` int NOT NULL,
	`prompt` text NOT NULL,
	`imageUrl` text,
	`imageKey` varchar(512),
	`videoUrl` text,
	`videoKey` varchar(512),
	`points` int NOT NULL DEFAULT 10,
	`timeLimitSeconds` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `questions_id` PRIMARY KEY(`id`),
	CONSTRAINT `questions_round_position_unique` UNIQUE(`roundId`,`position`)
);
--> statement-breakpoint
CREATE TABLE `round_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roundId` int NOT NULL,
	`participantId` int NOT NULL,
	`answeredCount` int NOT NULL DEFAULT 0,
	`correctCount` int NOT NULL DEFAULT 0,
	`points` int NOT NULL DEFAULT 0,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `round_scores_id` PRIMARY KEY(`id`),
	CONSTRAINT `round_scores_participant_round_unique` UNIQUE(`roundId`,`participantId`)
);
--> statement-breakpoint
CREATE TABLE `rounds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(120) NOT NULL,
	`description` text,
	`startsAt` bigint NOT NULL,
	`endsAt` bigint NOT NULL,
	`lifecycle` enum('draft','processing','result') NOT NULL DEFAULT 'draft',
	`closingWindowSeconds` int NOT NULL DEFAULT 60,
	`notifyBeforeMinutes` int NOT NULL DEFAULT 10,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`processedAt` timestamp,
	CONSTRAINT `rounds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `score_adjustments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`participantId` int NOT NULL,
	`roundId` int,
	`points` int NOT NULL,
	`reason` varchar(240) NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `score_adjustments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`slug` varchar(80) NOT NULL,
	`color` varchar(16) NOT NULL,
	`accentColor` varchar(16) NOT NULL,
	`symbol` varchar(12) NOT NULL DEFAULT '⚡',
	`description` text,
	`logoUrl` text,
	`logoKey` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teams_id` PRIMARY KEY(`id`),
	CONSTRAINT `teams_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `answers` ADD CONSTRAINT `answers_participantId_participant_profiles_id_fk` FOREIGN KEY (`participantId`) REFERENCES `participant_profiles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `answers` ADD CONSTRAINT `answers_questionId_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `answers` ADD CONSTRAINT `answers_selectedOptionId_question_options_id_fk` FOREIGN KEY (`selectedOptionId`) REFERENCES `question_options`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `participant_profiles` ADD CONSTRAINT `participant_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `participant_profiles` ADD CONSTRAINT `participant_profiles_teamId_teams_id_fk` FOREIGN KEY (`teamId`) REFERENCES `teams`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `question_options` ADD CONSTRAINT `question_options_questionId_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `questions` ADD CONSTRAINT `questions_roundId_rounds_id_fk` FOREIGN KEY (`roundId`) REFERENCES `rounds`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `round_scores` ADD CONSTRAINT `round_scores_roundId_rounds_id_fk` FOREIGN KEY (`roundId`) REFERENCES `rounds`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `round_scores` ADD CONSTRAINT `round_scores_participantId_participant_profiles_id_fk` FOREIGN KEY (`participantId`) REFERENCES `participant_profiles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `score_adjustments` ADD CONSTRAINT `score_adjustments_participantId_participant_profiles_id_fk` FOREIGN KEY (`participantId`) REFERENCES `participant_profiles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `score_adjustments` ADD CONSTRAINT `score_adjustments_roundId_rounds_id_fk` FOREIGN KEY (`roundId`) REFERENCES `rounds`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `score_adjustments` ADD CONSTRAINT `score_adjustments_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `answers_question_idx` ON `answers` (`questionId`);--> statement-breakpoint
CREATE INDEX `participant_profiles_team_idx` ON `participant_profiles` (`teamId`);--> statement-breakpoint
CREATE INDEX `question_options_question_idx` ON `question_options` (`questionId`);--> statement-breakpoint
CREATE INDEX `questions_round_idx` ON `questions` (`roundId`);--> statement-breakpoint
CREATE INDEX `round_scores_participant_idx` ON `round_scores` (`participantId`);--> statement-breakpoint
CREATE INDEX `rounds_schedule_idx` ON `rounds` (`startsAt`,`endsAt`);--> statement-breakpoint
CREATE INDEX `score_adjustments_participant_idx` ON `score_adjustments` (`participantId`);--> statement-breakpoint
CREATE INDEX `score_adjustments_round_idx` ON `score_adjustments` (`roundId`);