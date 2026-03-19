CREATE TABLE IF NOT EXISTS `projects` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `public_key` text NOT NULL,
  `rotating_public_key` text,
  `rotating_key_expires_at` integer,
  `created_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `secrets` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `projects`(`id`) ON DELETE CASCADE,
  `env` text NOT NULL,
  `key` text NOT NULL,
  `encrypted_value` text NOT NULL,
  `updated_at` integer NOT NULL,
  CONSTRAINT `secrets_project_id_env_key_unique` UNIQUE(`project_id`, `env`, `key`)
);

CREATE TABLE IF NOT EXISTS `audit` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `projects`(`id`),
  `action` text NOT NULL,
  `env` text,
  `requested_at` integer NOT NULL,
  `ip` text
);

CREATE TABLE IF NOT EXISTS `nonces` (
  `nonce` text PRIMARY KEY NOT NULL,
  `expires_at` integer NOT NULL
);
