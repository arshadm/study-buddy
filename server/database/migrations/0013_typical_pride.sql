PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_quiz_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`planned_question_count` integer NOT NULL,
	`time_limit_seconds` integer,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`score_correct` real,
	`score_total` integer,
	`paper_attempt_id` integer,
	`paper_section_index` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`paper_attempt_id`) REFERENCES `paper_attempts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_quiz_sessions`("id", "student_id", "status", "planned_question_count", "time_limit_seconds", "started_at", "finished_at", "score_correct", "score_total", "paper_attempt_id", "paper_section_index", "created_at") SELECT "id", "student_id", "status", "planned_question_count", "time_limit_seconds", "started_at", "finished_at", "score_correct", "score_total", "paper_attempt_id", "paper_section_index", "created_at" FROM `quiz_sessions`;--> statement-breakpoint
DROP TABLE `quiz_sessions`;--> statement-breakpoint
ALTER TABLE `__new_quiz_sessions` RENAME TO `quiz_sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_sessions_student` ON `quiz_sessions` (`student_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_sessions_paper_attempt` ON `quiz_sessions` (`paper_attempt_id`,`paper_section_index`);--> statement-breakpoint
ALTER TABLE `quiz_session_questions` ADD `self_mark_score_percent` integer;