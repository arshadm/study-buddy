PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_question_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question_id` integer NOT NULL,
	`option_text` text,
	`option_image_path` text,
	`is_correct` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_question_options`("id", "question_id", "option_text", "option_image_path", "is_correct", "sort_order") SELECT "id", "question_id", "option_text", NULL, "is_correct", "sort_order" FROM `question_options`;--> statement-breakpoint
DROP TABLE `question_options`;--> statement-breakpoint
ALTER TABLE `__new_question_options` RENAME TO `question_options`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_options_question` ON `question_options` (`question_id`);--> statement-breakpoint
CREATE TABLE `__new_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subject_id` integer NOT NULL,
	`section_id` integer,
	`image_path` text NOT NULL,
	`hint_text` text,
	`worked_solution_image_path` text,
	`difficulty` integer,
	`type` text DEFAULT 'multiple_choice' NOT NULL,
	`option_format` text DEFAULT 'text' NOT NULL,
	`answer_type` text,
	`answer_numeric_value` text,
	`answer_tolerance_percent` text,
	`answer_text` text,
	`answer_unit_hint` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_questions`("id", "subject_id", "section_id", "image_path", "hint_text", "worked_solution_image_path", "difficulty", "type", "option_format", "answer_type", "answer_numeric_value", "answer_tolerance_percent", "answer_text", "answer_unit_hint", "is_active", "created_at", "updated_at") SELECT "id", "subject_id", "section_id", "image_path", "hint_text", "worked_solution_image_path", "difficulty", "type", 'text', "answer_type", "answer_numeric_value", "answer_tolerance_percent", "answer_text", "answer_unit_hint", "is_active", "created_at", "updated_at" FROM `questions`;--> statement-breakpoint
DROP TABLE `questions`;--> statement-breakpoint
ALTER TABLE `__new_questions` RENAME TO `questions`;--> statement-breakpoint
CREATE INDEX `idx_questions_subject` ON `questions` (`subject_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_questions_section` ON `questions` (`section_id`);--> statement-breakpoint
ALTER TABLE `quiz_session_questions` ADD `submitted_answer_image_path` text;