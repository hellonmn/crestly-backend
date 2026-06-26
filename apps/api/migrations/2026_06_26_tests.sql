-- 2026-06-26 · Online tests (MCQ + fill-in-the-blanks)
--
-- Teacher-authored tests attempted by students through the parent
-- portal; MCQ + fill-blank answers are auto-graded on submit.
--
-- Apply to EVERY tenant school database. Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS `tests` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `session_code`   VARCHAR(10) NOT NULL,
  `title`          VARCHAR(160) NOT NULL,
  `instructions`   VARCHAR(2000) NULL,
  `class_slug`     VARCHAR(16) NOT NULL,
  `section_code`   VARCHAR(8) NULL,
  `subject_id`     INT UNSIGNED NULL,
  `status`         ENUM('draft','published','closed') NOT NULL DEFAULT 'draft',
  `duration_min`   SMALLINT UNSIGNED NULL,
  `available_from` DATETIME NULL,
  `available_to`   DATETIME NULL,
  `shuffle`        TINYINT(1) NOT NULL DEFAULT 0,
  `total_marks`    INT UNSIGNED NOT NULL DEFAULT 0,
  `created_by`     INT UNSIGNED NULL,
  `created_at`     TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_session_class` (`session_code`, `class_slug`),
  KEY `idx_status` (`status`),
  KEY `fk_test_subj` (`subject_id`),
  KEY `fk_test_by` (`created_by`),
  CONSTRAINT `fk_test_subj` FOREIGN KEY (`subject_id`) REFERENCES `exam_subjects` (`id`) ON UPDATE RESTRICT,
  CONSTRAINT `fk_test_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `test_questions` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `test_id`        INT UNSIGNED NOT NULL,
  `q_type`         ENUM('mcq','fill_blank') NOT NULL,
  `prompt`         VARCHAR(2000) NOT NULL,
  `marks`          INT UNSIGNED NOT NULL DEFAULT 1,
  `sort_order`     INT UNSIGNED NOT NULL DEFAULT 0,
  -- MCQ options as JSON: [{"text":"..."}]
  `options_json`   TEXT NULL,
  -- Answer key as JSON. mcq: [0,2] (correct indices). fill_blank: ["paris","Paris"].
  `answer_json`    TEXT NOT NULL,
  `case_sensitive` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_test` (`test_id`),
  CONSTRAINT `fk_tq_test` FOREIGN KEY (`test_id`) REFERENCES `tests` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `test_attempts` (
  `id`                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `test_id`            INT UNSIGNED NOT NULL,
  `sr_number`          INT UNSIGNED NOT NULL,
  `submitted_by_phone` VARCHAR(20) NULL,
  `status`             ENUM('in_progress','submitted') NOT NULL DEFAULT 'in_progress',
  `score`              INT UNSIGNED NULL,
  `max_score`          INT UNSIGNED NOT NULL DEFAULT 0,
  `started_at`         TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `submitted_at`       DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_test_student` (`test_id`, `sr_number`),
  KEY `idx_student` (`sr_number`),
  CONSTRAINT `fk_ta_test` FOREIGN KEY (`test_id`) REFERENCES `tests` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `test_attempt_answers` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `attempt_id`    INT UNSIGNED NOT NULL,
  `question_id`   INT UNSIGNED NOT NULL,
  -- mcq: selected option indices as JSON e.g. [1]
  `selected_json` TEXT NULL,
  `response_text` VARCHAR(500) NULL,
  `is_correct`    TINYINT(1) NOT NULL DEFAULT 0,
  `awarded_marks` INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_attempt` (`attempt_id`),
  KEY `fk_taa_q` (`question_id`),
  CONSTRAINT `fk_taa_attempt` FOREIGN KEY (`attempt_id`) REFERENCES `test_attempts` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_taa_q` FOREIGN KEY (`question_id`) REFERENCES `test_questions` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `schema_migrations` (`name`) VALUES ('2026_06_26_tests')
  ON DUPLICATE KEY UPDATE `name` = `name`;
