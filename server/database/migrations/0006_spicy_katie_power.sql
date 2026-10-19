CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subject_id` integer NOT NULL,
	`role` text NOT NULL,
	`title` text NOT NULL,
	`file_path` text NOT NULL,
	`extracted_text` text,
	`extraction_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_documents_subject` ON `documents` (`subject_id`,`role`);