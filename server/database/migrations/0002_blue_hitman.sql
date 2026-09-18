CREATE TABLE `sections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subject_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sections_subject_name` ON `sections` (`subject_id`,`name`);--> statement-breakpoint
ALTER TABLE `questions` ADD `section_id` integer REFERENCES sections(id);--> statement-breakpoint
CREATE INDEX `idx_questions_section` ON `questions` (`section_id`);