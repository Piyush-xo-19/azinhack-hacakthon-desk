CREATE TABLE `claims` (
	`participant_id` text NOT NULL,
	`action` text NOT NULL,
	`at` integer NOT NULL,
	`actor` text NOT NULL,
	PRIMARY KEY(`participant_id`, `action`),
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `deliveries` (
	`participant_id` text NOT NULL,
	`channel` text NOT NULL,
	`status` text NOT NULL,
	`at` integer NOT NULL,
	`provider_id` text,
	`error` text,
	PRIMARY KEY(`participant_id`, `channel`),
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`team` text DEFAULT '' NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participants_email_unique` ON `participants` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `participants_token_unique` ON `participants` (`token`);