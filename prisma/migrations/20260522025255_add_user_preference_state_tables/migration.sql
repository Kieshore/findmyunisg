-- CreateTable
CREATE TABLE "user_interest_preferences" (
    "interest_preference_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "wanted_interests" JSONB,
    "unwanted_interests" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_interest_preferences_pkey" PRIMARY KEY ("interest_preference_id")
);

-- CreateTable
CREATE TABLE "user_course_finder_preferences" (
    "finder_preference_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "gpa_boost" TEXT DEFAULT '0',
    "band_min_percentage" TEXT DEFAULT '80',
    "selected_universities" JSONB,
    "only_wanted" BOOLEAN NOT NULL DEFAULT false,
    "exclude_unwanted" BOOLEAN NOT NULL DEFAULT false,
    "course_keyword" TEXT DEFAULT '',
    "active_uni" TEXT DEFAULT 'All',
    "priority_space" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_course_finder_preferences_pkey" PRIMARY KEY ("finder_preference_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_interest_preferences_user_id_key" ON "user_interest_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_course_finder_preferences_user_id_key" ON "user_course_finder_preferences"("user_id");

-- AddForeignKey
ALTER TABLE "user_interest_preferences" ADD CONSTRAINT "user_interest_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_course_finder_preferences" ADD CONSTRAINT "user_course_finder_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
