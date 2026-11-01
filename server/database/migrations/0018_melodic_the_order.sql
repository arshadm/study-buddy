CREATE TABLE `question_tags` (
	`question_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`question_id`, `tag_id`),
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `subject_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_question_tags_tag` ON `question_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `subject_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subject_id` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_subject_tags_subject_name` ON `subject_tags` (`subject_id`,`name`);