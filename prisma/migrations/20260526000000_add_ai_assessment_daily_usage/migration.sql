CREATE TABLE "ai_assessment_daily_usage" (
    "usage_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "usage_date" DATE NOT NULL,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_assessment_daily_usage_pkey" PRIMARY KEY ("usage_id")
);

CREATE UNIQUE INDEX "ai_assessment_daily_usage_user_id_usage_date_key"
    ON "ai_assessment_daily_usage"("user_id", "usage_date");

CREATE INDEX "ai_assessment_daily_usage_usage_date_idx"
    ON "ai_assessment_daily_usage"("usage_date");

ALTER TABLE "ai_assessment_daily_usage"
    ADD CONSTRAINT "ai_assessment_daily_usage_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
