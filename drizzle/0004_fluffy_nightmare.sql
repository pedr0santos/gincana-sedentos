CREATE TABLE `round_question_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roundId` int NOT NULL,
	`participantId` int NOT NULL,
	`questionId` int NOT NULL,
	`status` enum('active','answered','expired') NOT NULL DEFAULT 'active',
	`startedAt` bigint NOT NULL,
	`deadlineAt` bigint NOT NULL,
	`completedAt` bigint,
	`responseTimeMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `round_question_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `round_question_attempts_unique` UNIQUE(`roundId`,`participantId`,`questionId`)
);
--> statement-breakpoint
ALTER TABLE `round_scores` ADD `correctResponseTimeMs` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `rounds` ADD `questionTimeLimitSeconds` int DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE `round_question_attempts` ADD CONSTRAINT `round_question_attempts_roundId_rounds_id_fk` FOREIGN KEY (`roundId`) REFERENCES `rounds`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `round_question_attempts` ADD CONSTRAINT `round_question_attempts_participantId_participant_profiles_id_fk` FOREIGN KEY (`participantId`) REFERENCES `participant_profiles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `round_question_attempts` ADD CONSTRAINT `round_question_attempts_questionId_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `round_question_attempts_participant_round_idx` ON `round_question_attempts` (`participantId`,`roundId`);--> statement-breakpoint
CREATE INDEX `round_question_attempts_question_idx` ON `round_question_attempts` (`questionId`);