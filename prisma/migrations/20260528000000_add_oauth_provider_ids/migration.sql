ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "google_id" TEXT,
    ADD COLUMN IF NOT EXISTS "microsoft_id" TEXT,
    ADD COLUMN IF NOT EXISTS "last_login_provider" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_google_id_key"
    ON "users"("google_id")
    WHERE "google_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "users_microsoft_id_key"
    ON "users"("microsoft_id")
    WHERE "microsoft_id" IS NOT NULL;
