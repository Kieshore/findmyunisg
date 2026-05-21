/*
  Warnings:

  - A unique constraint covering the columns `[postal_code]` on the table `universities` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "universities" ADD COLUMN     "postal_code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "universities_postal_code_key" ON "universities"("postal_code");
