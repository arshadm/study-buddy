CREATE TABLE `paper_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`paper_id` integer NOT NULL,
	`student_id` integer NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`current_section_index` integer DEFAULT 0 NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_paper_attempts_student` ON `paper_attempts` (`student_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `paper_sections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`paper_id` integer NOT NULL,
	`subject_id` integer NOT NULL,
	`question_count` integer NOT NULL,
	`time_limit_seconds` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_paper_sections_order` ON `paper_sections` (`paper_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `papers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `questions` ADD `worked_solution_image_path` text;--> statement-breakpoint
ALTER TABLE `questions` ADD `difficulty` integer;--> statement-breakpoint
ALTER TABLE `questions` ADD `type` text DEFAULT 'multiple_choice' NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `answer_type` text;--> statement-breakpoint
ALTER TABLE `questions` ADD `answer_numeric_value` real;--> statement-breakpoint
ALTER TABLE `questions` ADD `answer_tolerance_percent` real;--> statement-breakpoint
ALTER TABLE `questions` ADD `answer_text` text;--> statement-breakpoint
ALTER TABLE `questions` ADD `answer_unit_hint` text;--> statement-breakpoint
ALTER TABLE `quiz_session_questions` ADD `submitted_answer_text` text;--> statement-breakpoint
ALTER TABLE `quiz_session_questions` ADD `flagged` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `quiz_sessions` ADD `paper_attempt_id` integer REFERENCES paper_attempts(id);--> statement-breakpoint
ALTER TABLE `quiz_sessions` ADD `paper_section_index` integer;--> statement-breakpoint
CREATE INDEX `idx_sessions_paper_attempt` ON `quiz_sessions` (`paper_attempt_id`,`paper_section_index`);