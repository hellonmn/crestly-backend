-- 2026-06-27 · Tests: passing marks
--
-- Adds an optional pass mark to a test. score >= pass_marks => "passed".
-- Apply to every tenant DB (+ platform DB). Idempotent-ish: guarded by
-- the schema_migrations marker; the ADD COLUMN itself will error only if
-- re-run, so run once per DB.

ALTER TABLE `tests` ADD COLUMN `pass_marks` INT UNSIGNED NULL AFTER `total_marks`;

INSERT INTO `schema_migrations` (`name`) VALUES ('2026_06_27_test_pass_marks')
  ON DUPLICATE KEY UPDATE `name` = `name`;
