PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_open_question_sets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subject_id` integer NOT NULL,
	`section_id` integer,
	`title` text NOT NULL,
	`passage_text` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_open_question_sets`("id", "subject_id", "section_id", "title", "passage_text", "is_active", "created_at", "updated_at") SELECT "id", "subject_id", "section_id", "title", "passage_text", "is_active", "created_at", "updated_at" FROM `open_question_sets`;--> statement-breakpoint
DROP TABLE `open_question_sets`;--> statement-breakpoint
ALTER TABLE `__new_open_question_sets` RENAME TO `open_question_sets`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_open_question_sets_subject` ON `open_question_sets` (`subject_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_open_question_sets_section` ON `open_question_sets` (`section_id`);--> statement-breakpoint
ALTER TABLE `sections` ADD `chapter_document_id` integer REFERENCES documents(id) ON DELETE set null;