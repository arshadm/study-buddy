CREATE TABLE `student_subjects` (
	`student_id` integer NOT NULL,
	`subject_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`student_id`, `subject_id`),
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_student_subjects_subject` ON `student_subjects` (`subject_id`);--> statement-breakpoint
-- Backfill: existing students keep access to every subject they could already see, so this
-- migration doesn't silently empty anyone's start page. New students start with none.
INSERT INTO `student_subjects` (`student_id`, `subject_id`, `created_at`)
SELECT u.id, s.id, CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM `users` u CROSS JOIN `subjects` s
WHERE u.role = 'student';
