/*
  Warnings:

  - A unique constraint covering the columns `[user_id]` on the table `user_academic_profiles` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "user_academic_profiles_user_id_key" ON "user_academic_profiles"("user_id");
