ALTER TABLE `questions` DROP COLUMN `answer_type`;--> statement-breakpoint
ALTER TABLE `questions` DROP COLUMN `answer_numeric_value`;--> statement-breakpoint
ALTER TABLE `questions` DROP COLUMN `answer_tolerance_percent`;--> statement-breakpoint
ALTER TABLE `questions` DROP COLUMN `answer_text`;--> statement-breakpoint
ALTER TABLE `questions` DROP COLUMN `answer_unit_hint`;--> statement-breakpoint
ALTER TABLE `quiz_session_questions` DROP COLUMN `submitted_answer_text`;