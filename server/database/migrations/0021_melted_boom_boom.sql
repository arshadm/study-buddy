ALTER TABLE `questions` ADD `difficulty_score` integer;--> statement-breakpoint
ALTER TABLE `questions` ADD `difficulty_auto` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- Every difficulty set so far came from Claude (the one-off rating job), so they may be re-banded.
UPDATE `questions` SET `difficulty_auto` = 1 WHERE `difficulty` IS NOT NULL;
