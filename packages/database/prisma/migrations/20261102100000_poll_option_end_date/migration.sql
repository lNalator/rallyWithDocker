ALTER TABLE "options" ADD COLUMN "end_date" DATE;

ALTER TABLE "options"
ADD CONSTRAINT "options_end_date_check"
CHECK ("end_date" IS NULL OR ("duration_minutes" = 0 AND "end_date" >= "start_time"::date));
