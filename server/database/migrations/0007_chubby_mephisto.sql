CREATE TABLE `open_question_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`set_attempt_id` integer NOT NULL,
	`open_question_id` integer NOT NULL,
	`student_id` integer NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`round_count` integer DEFAULT 0 NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`set_attempt_id`) REFERENCES `open_question_set_attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`open_question_id`) REFERENCES `open_questions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_oq_attempts_set_attempt_question` ON `open_question_attempts` (`set_attempt_id`,`open_question_id`);--> statement-breakpoint
CREATE INDEX `idx_oq_attempts_student` ON `open_question_attempts` (`student_id`);--> statement-breakpoint
CREATE TABLE `open_question_rounds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` integer NOT NULL,
	`round_index` integer NOT NULL,
	`prompt_text` text NOT NULL,
	`student_answer_text` text,
	`grading_status` text DEFAULT 'pending' NOT NULL,
	`llm_verdict` text,
	`llm_feedback_text` text,
	`answered_at` integer,
	`graded_at` integer,
	FOREIGN KEY (`attempt_id`) REFERENCES `open_question_attempts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_oq_rounds_attempt_index` ON `open_question_rounds` (`attempt_id`,`round_index`);--> statement-breakpoint
CREATE TABLE `open_question_set_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`set_id` integer NOT NULL,
	`student_id` integer NOT NULL,
	`subject_id` integer NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`set_id`) REFERENCES `open_question_sets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_oq_set_attempts_student` ON `open_question_set_attempts` (`student_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_oq_set_attempts_set` ON `open_question_set_attempts` (`set_id`,`student_id`);--> statement-breakpoint
CREATE TABLE `open_question_sets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subject_id` integer NOT NULL,
	`section_id` integer,
	`chapter_document_id` integer,
	`title` text NOT NULL,
	`passage_text` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`chapter_document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_open_question_sets_subject` ON `open_question_sets` (`subject_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_open_question_sets_section` ON `open_question_sets` (`section_id`);--> statement-breakpoint
CREATE TABLE `open_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`set_id` integer NOT NULL,
	`prompt_text` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`set_id`) REFERENCES `open_question_sets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_open_questions_set` ON `open_questions` (`set_id`,`is_active`);