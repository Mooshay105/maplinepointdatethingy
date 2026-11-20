DROP INDEX IF EXISTS `events_user_id`;--> statement-breakpoint
ALTER TABLE `events` ALTER COLUMN "date" TO "date" integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `events_user_id` ON `events` (`user_id`);
