CREATE TABLE `applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`status` text NOT NULL,
	`task_id` integer,
	`drafts` text,
	`extra_answers` text DEFAULT '[]' NOT NULL,
	`events` text DEFAULT '[]' NOT NULL,
	`report` text,
	`error` text,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `job_enrichment` (
	`job_id` integer NOT NULL,
	`profile_version` text NOT NULL,
	`match_score` integer NOT NULL,
	`data` text NOT NULL,
	`model` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`job_id`, `profile_version`),
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `job_enrichment_match_idx` ON `job_enrichment` (`match_score`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`source_job_id` text,
	`url` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`title` text NOT NULL,
	`company` text,
	`location` text,
	`work_model` text,
	`contract` text,
	`seniority` text,
	`salary_text` text,
	`posted_at` integer,
	`description_text` text,
	`local_score` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`analysis_error` text,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`seen_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_dedupeKey_unique` ON `jobs` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `jobs` (`status`);--> statement-breakpoint
CREATE INDEX `jobs_posted_at_idx` ON `jobs` (`posted_at`);--> statement-breakpoint
CREATE INDEX `jobs_local_score_idx` ON `jobs` (`local_score`);--> statement-breakpoint
CREATE TABLE `llm_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer NOT NULL,
	`task` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer NOT NULL,
	`output_tokens` integer NOT NULL,
	`cost_usd` real
);
--> statement-breakpoint
CREATE TABLE `profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`version` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `search_queries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`keywords` text NOT NULL,
	`location` text,
	`origin` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `search_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text NOT NULL,
	`trigger` text NOT NULL,
	`per_source` text DEFAULT '{}' NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`enabled` integer NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL,
	`last_error` text,
	`last_run_at` integer
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`runner` text DEFAULT 'worker' NOT NULL,
	`payload` text NOT NULL,
	`result` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`run_at` integer NOT NULL,
	`locked_at` integer,
	`error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tasks_claim_idx` ON `tasks` (`status`,`runner`,`run_at`);