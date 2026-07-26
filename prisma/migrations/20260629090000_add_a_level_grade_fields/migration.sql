ALTER TABLE "user_academic_profiles"
ADD COLUMN IF NOT EXISTS "h1_general_paper_grade" TEXT,
ADD COLUMN IF NOT EXISTS "h1_project_work_grade" TEXT,
ADD COLUMN IF NOT EXISTS "h1_content_grade" TEXT,
ADD COLUMN IF NOT EXISTS "h1_mother_tongue_grade" TEXT,
ADD COLUMN IF NOT EXISTS "h2_subject_1_grade" TEXT,
ADD COLUMN IF NOT EXISTS "h2_subject_2_grade" TEXT,
ADD COLUMN IF NOT EXISTS "h2_subject_3_grade" TEXT,
ADD COLUMN IF NOT EXISTS "h2_subject_4_grade" TEXT;
