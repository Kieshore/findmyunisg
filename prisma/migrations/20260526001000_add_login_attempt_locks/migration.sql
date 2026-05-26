CREATE TABLE "login_attempt_locks" (
    "lock_id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempt_locks_pkey" PRIMARY KEY ("lock_id")
);

CREATE UNIQUE INDEX "login_attempt_locks_email_key"
    ON "login_attempt_locks"("email");
