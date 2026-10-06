CREATE TABLE `admin_role_changes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`targetUserId` int NOT NULL,
	`actorUserId` int NOT NULL,
	`previousRole` enum('user','admin') NOT NULL,
	`nextRole` enum('user','admin') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_role_changes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `admin_role_changes` ADD CONSTRAINT `admin_role_changes_targetUserId_users_id_fk` FOREIGN KEY (`targetUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_role_changes` ADD CONSTRAINT `admin_role_changes_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `admin_role_changes_target_idx` ON `admin_role_changes` (`targetUserId`);--> statement-breakpoint
CREATE INDEX `admin_role_changes_actor_idx` ON `admin_role_changes` (`actorUserId`);--> statement-breakpoint
CREATE INDEX `admin_role_changes_created_idx` ON `admin_role_changes` (`createdAt`);