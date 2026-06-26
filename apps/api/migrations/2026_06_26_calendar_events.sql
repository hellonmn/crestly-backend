-- 2026-06-26 · School calendar
--
-- New tenant table holding general school events. The read API merges
-- these with `holidays` and `exam_datesheet` into one feed.
--
-- Apply to EVERY tenant school database (and the founding/platform DB,
-- which doubles as a tenant). Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS `calendar_events` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `session_code` VARCHAR(10)  NOT NULL,
  `title`        VARCHAR(160) NOT NULL,
  `description`  VARCHAR(1000) NULL,
  `category`     ENUM('event','ptm','function','activity','sports','exam','fee','meeting','notice','holiday','other')
                 NOT NULL DEFAULT 'event',
  `start_date`   DATE NOT NULL,
  `end_date`     DATE NULL,
  `start_time`   TIME NULL,
  `end_time`     TIME NULL,
  `all_day`      TINYINT(1) NOT NULL DEFAULT 1,
  `is_holiday`   TINYINT(1) NOT NULL DEFAULT 0,
  `audience`     ENUM('all','staff','parents') NOT NULL DEFAULT 'all',
  `class_slug`   VARCHAR(16) NULL,
  `location`     VARCHAR(160) NULL,
  `color`        VARCHAR(16) NULL,
  `created_by`   INT UNSIGNED NULL,
  `created_at`   TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_session_date` (`session_code`, `start_date`),
  KEY `idx_date` (`start_date`),
  KEY `fk_cal_by` (`created_by`),
  CONSTRAINT `fk_cal_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `schema_migrations` (`name`) VALUES ('2026_06_26_calendar_events')
  ON DUPLICATE KEY UPDATE `name` = `name`;
