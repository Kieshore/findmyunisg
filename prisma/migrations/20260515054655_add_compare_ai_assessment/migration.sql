-- CreateTable
CREATE TABLE "CompareAiAssessment" (
    "assessment_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "left_course_id" INTEGER NOT NULL,
    "right_course_id" INTEGER NOT NULL,
    "input_hash" TEXT NOT NULL,
    "request_payload" JSONB NOT NULL,
    "assessment_result" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompareAiAssessment_pkey" PRIMARY KEY ("assessment_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompareAiAssessment_input_hash_key" ON "CompareAiAssessment"("input_hash");
