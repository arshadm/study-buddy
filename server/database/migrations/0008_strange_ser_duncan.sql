CREATE TABLE `claude_auth_status` (
	`id` integer PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'ok' NOT NULL,
	`last_checked_at` integer,
	`last_error_message` text
);
