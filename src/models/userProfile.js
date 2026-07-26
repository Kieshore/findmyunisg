const prisma = require("../lib/prisma");
const { calculateAlevelScoresFromGrades } = require("../utils/aLevelScoreUtils");

let academicGradeColumnsReady = false;

async function ensureAcademicGradeColumns() {
  if (academicGradeColumnsReady) return;

  await prisma.$executeRaw`
    ALTER TABLE "user_academic_profiles"
    ADD COLUMN IF NOT EXISTS "h1_general_paper_grade" TEXT,
    ADD COLUMN IF NOT EXISTS "h1_project_work_grade" TEXT,
    ADD COLUMN IF NOT EXISTS "h1_content_grade" TEXT,
    ADD COLUMN IF NOT EXISTS "h1_mother_tongue_grade" TEXT,
    ADD COLUMN IF NOT EXISTS "h2_subject_1_grade" TEXT,
    ADD COLUMN IF NOT EXISTS "h2_subject_2_grade" TEXT,
    ADD COLUMN IF NOT EXISTS "h2_subject_3_grade" TEXT,
    ADD COLUMN IF NOT EXISTS "h2_subject_4_grade" TEXT
  `;

  academicGradeColumnsReady = true;
}

module.exports.getUserProfile = async function getUserProfile(userId) {
  const parsedUserId = Number(userId);

  if (Number.isNaN(parsedUserId)) {
    throw new Error("Invalid userId");
  }

  return prisma.user.findUnique({
    where: {
      user_id: parsedUserId,
    },
    select: {
      user_id: true,
      first_name: true,
      postal_code: true,
      citizenship: true,
      email: true,

      // One-to-one relation. No orderBy, no take.
      academic_profile: true,

      preferences: {
        orderBy: {
          created_at: "desc",
        },
        take: 1,
      },
    },
  });
};

function normalizeQualification(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (
    normalized === "diploma" ||
    normalized.includes("poly") ||
    normalized.includes("polytechnic") ||
    normalized.includes("diploma")
  ) {
    return "Diploma";
  }

  if (
    normalized === "a level" ||
    normalized === "a-level" ||
    normalized.includes("jc") ||
    normalized.includes("junior college") ||
    normalized.includes("a level") ||
    normalized.includes("a-level")
  ) {
    return "A Level";
  }

  return "";
}

function toNullableString(value) {
  const cleaned = String(value || "").trim();
  return cleaned || null;
}

function normalizePostalCode(value) {
  const cleaned = String(value || "").trim();

  if (!cleaned) return null;

  if (!/^\d{6}$/.test(cleaned)) {
    throw new Error("Postal code must be 6 digits");
  }

  return cleaned;
}

function toNullableInt(value) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error("Graduation year must be a valid whole number");
  }

  return parsed;
}

function toNullableNumber(value, label) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    throw new Error(`${label} must be a valid number`);
  }

  return parsed;
}

function normalizeGrade(value, label, required = false) {
  const grade = String(value || "").trim().toUpperCase();

  if (!grade) {
    if (required) {
      throw new Error(`${label} grade is required`);
    }

    return null;
  }

  if (!["A", "B", "C", "D", "E", "S", "U"].includes(grade)) {
    throw new Error(`${label} grade must be A, B, C, D, E, S, or U`);
  }

  return grade;
}

function validateAcademicProfile(payload) {
  const qualificationType = normalizeQualification(payload.qualification_type);

  if (!qualificationType) {
    throw new Error("Qualification must be either Diploma or A Level");
  }

  const school = toNullableString(payload.school);
  const course = toNullableString(payload.course);
  const graduationYear = toNullableInt(payload.graduation_year);
  const academicScore = toNullableNumber(payload.academic_score, "Academic score");

  if (!school) {
    throw new Error("School is required");
  }

  if (qualificationType === "Diploma" && !course) {
    throw new Error("Course is required for Diploma");
  }

  if (graduationYear === null) {
    throw new Error("Graduation year is required");
  }

  const currentYear = new Date().getFullYear();

  if (graduationYear < 1950 || graduationYear > currentYear + 10) {
    throw new Error("Graduation year looks invalid");
  }

  if (qualificationType === "Diploma") {
    if (academicScore === null) {
      throw new Error("GPA is required for Diploma");
    }

    if (academicScore < 0 || academicScore > 4) {
      throw new Error("GPA must be between 0 and 4");
    }

    return {
      qualification_type: qualificationType,
      institution_name: school,
      diploma_name: course,
      graduation_year: graduationYear,
      current_gpa: academicScore,
      projected_gpa: academicScore,
      rank_points: null,
      uas_70: null,
      h1_general_paper_grade: null,
      h1_project_work_grade: null,
      h1_content_grade: null,
      h1_mother_tongue_grade: null,
      h2_subject_1_grade: null,
      h2_subject_2_grade: null,
      h2_subject_3_grade: null,
      h2_subject_4_grade: null,
    };
  }

  if (qualificationType === "A Level") {
    const isOldRpSystem = graduationYear <= 2024;
    const gradePayload = {
      h1_general_paper_grade: normalizeGrade(
        payload.h1_general_paper_grade,
        "General Paper",
        true
      ),
      h1_project_work_grade: normalizeGrade(
        payload.h1_project_work_grade,
        "Project Work",
        isOldRpSystem
      ),
      h1_content_grade: normalizeGrade(payload.h1_content_grade, "H1 content subject"),
      h1_mother_tongue_grade: normalizeGrade(
        payload.h1_mother_tongue_grade,
        "Mother Tongue"
      ),
      h2_subject_1_grade: normalizeGrade(payload.h2_subject_1_grade, "H2 subject 1", true),
      h2_subject_2_grade: normalizeGrade(payload.h2_subject_2_grade, "H2 subject 2", true),
      h2_subject_3_grade: normalizeGrade(payload.h2_subject_3_grade, "H2 subject 3", true),
      h2_subject_4_grade: normalizeGrade(payload.h2_subject_4_grade, "H2 subject 4"),
    };
    const calculated = calculateAlevelScoresFromGrades({
      graduation_year: graduationYear,
      ...gradePayload,
    });

    if (calculated.rp90 === null || calculated.uas70 === null) {
      throw new Error("Please enter enough A Level grades to calculate your RP and UAS");
    }

    return {
      qualification_type: qualificationType,
      institution_name: school,
      diploma_name: null,
      graduation_year: graduationYear,
      current_gpa: null,
      projected_gpa: null,
      rank_points: calculated.rp90,
      uas_70: calculated.uas70,
      ...gradePayload,
    };
  }

  throw new Error("Invalid qualification");
}

module.exports.getMyAcademicProfile = async function getMyAcademicProfile(userId) {
  const parsedUserId = Number(userId);

  if (Number.isNaN(parsedUserId)) {
    throw new Error("Invalid user ID");
  }

  await ensureAcademicGradeColumns();

  const rows = await prisma.$queryRaw`
    SELECT
      academic_profile_id,
      user_id,
      qualification_type,
      current_gpa,
      projected_gpa,
      rank_points,
      uas_70,
      diploma_name,
      institution_name,
      graduation_year,
      h1_general_paper_grade,
      h1_project_work_grade,
      h1_content_grade,
      h1_mother_tongue_grade,
      h2_subject_1_grade,
      h2_subject_2_grade,
      h2_subject_3_grade,
      h2_subject_4_grade,
      english_grade,
      math_grade,
      computing_grade,
      created_at
    FROM "user_academic_profiles"
    WHERE "user_id" = ${parsedUserId}
    LIMIT 1
  `;

  return rows[0] || null;
};

module.exports.updateMyProfile = async function updateMyProfile(userId, payload) {
  const parsedUserId = Number(userId);

  if (Number.isNaN(parsedUserId)) {
    throw new Error("Invalid user ID");
  }

  const postalCode = normalizePostalCode(payload.postal_code);

  return prisma.user.update({
    where: {
      user_id: parsedUserId,
    },
    data: {
      postal_code: postalCode,
    },
    select: {
      user_id: true,
      first_name: true,
      email: true,
      citizenship: true,
      postal_code: true,
    },
  });
};

module.exports.saveMyAcademicProfile = async function saveMyAcademicProfile(
  userId,
  payload
) {
  const parsedUserId = Number(userId);

  if (Number.isNaN(parsedUserId)) {
    throw new Error("Invalid user ID");
  }

  const data = validateAcademicProfile(payload);

  await ensureAcademicGradeColumns();

  const rows = await prisma.$queryRaw`
    INSERT INTO "user_academic_profiles" (
      "user_id",
      "qualification_type",
      "current_gpa",
      "projected_gpa",
      "rank_points",
      "uas_70",
      "diploma_name",
      "institution_name",
      "graduation_year",
      "h1_general_paper_grade",
      "h1_project_work_grade",
      "h1_content_grade",
      "h1_mother_tongue_grade",
      "h2_subject_1_grade",
      "h2_subject_2_grade",
      "h2_subject_3_grade",
      "h2_subject_4_grade"
    )
    VALUES (
      ${parsedUserId},
      ${data.qualification_type},
      ${data.current_gpa},
      ${data.projected_gpa},
      ${data.rank_points},
      ${data.uas_70},
      ${data.diploma_name},
      ${data.institution_name},
      ${data.graduation_year},
      ${data.h1_general_paper_grade},
      ${data.h1_project_work_grade},
      ${data.h1_content_grade},
      ${data.h1_mother_tongue_grade},
      ${data.h2_subject_1_grade},
      ${data.h2_subject_2_grade},
      ${data.h2_subject_3_grade},
      ${data.h2_subject_4_grade}
    )
    ON CONFLICT ("user_id") DO UPDATE SET
      "qualification_type" = EXCLUDED."qualification_type",
      "current_gpa" = EXCLUDED."current_gpa",
      "projected_gpa" = EXCLUDED."projected_gpa",
      "rank_points" = EXCLUDED."rank_points",
      "uas_70" = EXCLUDED."uas_70",
      "diploma_name" = EXCLUDED."diploma_name",
      "institution_name" = EXCLUDED."institution_name",
      "graduation_year" = EXCLUDED."graduation_year",
      "h1_general_paper_grade" = EXCLUDED."h1_general_paper_grade",
      "h1_project_work_grade" = EXCLUDED."h1_project_work_grade",
      "h1_content_grade" = EXCLUDED."h1_content_grade",
      "h1_mother_tongue_grade" = EXCLUDED."h1_mother_tongue_grade",
      "h2_subject_1_grade" = EXCLUDED."h2_subject_1_grade",
      "h2_subject_2_grade" = EXCLUDED."h2_subject_2_grade",
      "h2_subject_3_grade" = EXCLUDED."h2_subject_3_grade",
      "h2_subject_4_grade" = EXCLUDED."h2_subject_4_grade"
    RETURNING *
  `;

  return rows[0];
};

module.exports.deleteMyAccount = async function deleteMyAccount(userId) {
  const parsedUserId = Number(userId);

  if (Number.isNaN(parsedUserId)) {
    throw new Error("Invalid user ID");
  }

  const user = await prisma.user.findUnique({
    where: {
      user_id: parsedUserId,
    },
    select: {
      user_id: true,
      email: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  await prisma.$transaction(async tx => {
    await tx.$executeRaw`DELETE FROM "CompareAiAssessment" WHERE "user_id" = ${parsedUserId}`;
    await tx.$executeRaw`DELETE FROM "ai_assessment_daily_usage" WHERE "user_id" = ${parsedUserId}`;
    await tx.$executeRaw`DELETE FROM "user_saved_courses" WHERE "user_id" = ${parsedUserId}`;
    await tx.$executeRaw`DELETE FROM "user_interest_preferences" WHERE "user_id" = ${parsedUserId}`;
    await tx.$executeRaw`DELETE FROM "user_course_finder_preferences" WHERE "user_id" = ${parsedUserId}`;
    await tx.$executeRaw`DELETE FROM "user_preferences" WHERE "user_id" = ${parsedUserId}`;
    await tx.$executeRaw`DELETE FROM "user_academic_profiles" WHERE "user_id" = ${parsedUserId}`;
    await tx.$executeRaw`DELETE FROM "login_attempt_locks" WHERE "email" = ${user.email}`;

    await tx.user.delete({
      where: {
        user_id: parsedUserId,
      },
    });
  });

  return true;
};
