PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subject_id` integer NOT NULL,
	`role` text NOT NULL,
	`title` text NOT NULL,
	`file_path` text,
	`extracted_text` text,
	`extraction_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_documents`("id", "subject_id", "role", "title", "file_path", "extracted_text", "extraction_error", "created_at", "updated_at") SELECT "id", "subject_id", "role", "title", "file_path", "extracted_text", "extraction_error", "created_at", "updated_at" FROM `documents`;--> statement-breakpoint
DROP TABLE `documents`;--> statement-breakpoint
ALTER TABLE `__new_documents` RENAME TO `documents`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_documents_subject` ON `documents` (`subject_id`,`role`);