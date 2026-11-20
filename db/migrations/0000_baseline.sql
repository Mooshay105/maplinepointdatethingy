CREATE TABLE IF NOT EXISTS `events` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`date` integer NOT NULL,
	`icon` text NOT NULL,
	`icon_color` text NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`group_id` integer,
	`layer_id` integer,
	`travel_note` text DEFAULT '' NOT NULL,
	`collapsed` integer DEFAULT false NOT NULL,
	`locked` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `events_user_id` ON `events` (`user_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `layers` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`group_id` integer NOT NULL,
	`name` text NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`collapsed` integer DEFAULT false NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `layers_user_id` ON `layers` (`user_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `map_groups` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`collapsed` integer DEFAULT false NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `map_groups_user_id` ON `map_groups` (`user_id`);