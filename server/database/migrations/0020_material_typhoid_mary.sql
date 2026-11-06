CREATE TABLE `question_explanations` (
	`question_id` integer PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`content` text,
	`error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
