CREATE TABLE `question_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question_id` integer NOT NULL,
	`option_text` text NOT NULL,
	`is_correct` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_options_question` ON `question_options` (`question_id`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subject_id` integer NOT NULL,
	`image_path` text NOT NULL,
	`hint_text` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_questions_subject` ON `questions` (`subject_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `quiz_session_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quiz_session_id` integer NOT NULL,
	`question_id` integer NOT NULL,
	`subject_id` integer NOT NULL,
	`sequence_index` integer NOT NULL,
	`selected_option_id` integer,
	`is_correct` integer,
	`hint_used` integer DEFAULT false NOT NULL,
	`time_spent_ms` integer,
	`presented_at` integer,
	`answered_at` integer,
	FOREIGN KEY (`quiz_session_id`) REFERENCES `quiz_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`selected_option_id`) REFERENCES `question_options`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ssq_session_seq` ON `quiz_session_questions` (`quiz_session_id`,`sequence_index`);--> statement-breakpoint
CREATE INDEX `idx_ssq_question_session` ON `quiz_session_questions` (`question_id`,`quiz_session_id`);--> statement-breakpoint
CREATE TABLE `quiz_session_subjects` (
	`quiz_session_id` integer NOT NULL,
	`subject_id` integer NOT NULL,
	`question_count` integer NOT NULL,
	`time_limit_seconds` integer NOT NULL,
	PRIMARY KEY(`quiz_session_id`, `subject_id`),
	FOREIGN KEY (`quiz_session_id`) REFERENCES `quiz_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `quiz_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`planned_question_count` integer NOT NULL,
	`time_limit_seconds` integer NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`score_correct` integer,
	`score_total` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_student` ON `quiz_sessions` (`student_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`default_question_count` integer DEFAULT 20 NOT NULL,
	`default_time_limit_seconds` integer DEFAULT 1800 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_name_unique` ON `subjects` (`name`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE INDEX `idx_users_role` ON `users` (`role`);