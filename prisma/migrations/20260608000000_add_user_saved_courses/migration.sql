CREATE TABLE IF NOT EXISTS "user_saved_courses" (
  "saved_course_id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "course_id" INTEGER NOT NULL,
  "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_saved_courses_pkey" PRIMARY KEY ("saved_course_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_saved_courses_user_id_course_id_key"
  ON "user_saved_courses"("user_id", "course_id");

CREATE INDEX IF NOT EXISTS "user_saved_courses_user_id_idx"
  ON "user_saved_courses"("user_id");

CREATE INDEX IF NOT EXISTS "user_saved_courses_course_id_idx"
  ON "user_saved_courses"("course_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_saved_courses_user_id_fkey'
  ) THEN
    ALTER TABLE "user_saved_courses"
      ADD CONSTRAINT "user_saved_courses_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_saved_courses_course_id_fkey'
  ) THEN
    ALTER TABLE "user_saved_courses"
      ADD CONSTRAINT "user_saved_courses_course_id_fkey"
      FOREIGN KEY ("course_id") REFERENCES "courses"("course_id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
