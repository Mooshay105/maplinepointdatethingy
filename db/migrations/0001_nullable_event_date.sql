DROP INDEX "events_user_id";--> statement-breakpoint
DROP INDEX "layers_user_id";--> statement-breakpoint
DROP INDEX "map_groups_user_id";--> statement-breakpoint
ALTER TABLE `events` ALTER COLUMN "date" TO "date" integer;--> statement-breakpoint
CREATE INDEX `events_user_id` ON `events` (`user_id`);--> statement-breakpoint
CREATE INDEX `layers_user_id` ON `layers` (`user_id`);--> statement-breakpoint
CREATE INDEX `map_groups_user_id` ON `map_groups` (`user_id`);