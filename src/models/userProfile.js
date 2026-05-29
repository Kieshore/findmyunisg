const prisma = require("../lib/prisma");

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
      full_name: true,
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

  if (graduationYear < 2000 || graduationYear > currentYear + 10) {
    throw new Error("Graduation year looks invalid");
  }

  if (academicScore === null) {
    throw new Error(
      qualificationType === "Diploma"
        ? "GPA is required for Diploma"
        : "A Level score is required"
    );
  }

  if (qualificationType === "Diploma") {
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
    };
  }

  if (qualificationType === "A Level") {
  const isOldRpSystem = graduationYear <= 2024;

  if (isOldRpSystem) {
    if (academicScore < 0 || academicScore > 90) {
      throw new Error("RP must be between 0 and 90 for A Level students graduating in 2024 or earlier");
    }

    const uas70 = Number(((academicScore / 90) * 70).toFixed(2));

    return {
      qualification_type: qualificationType,
      institution_name: school,
      diploma_name: null,
      graduation_year: graduationYear,
      current_gpa: null,
      projected_gpa: null,
      rank_points: academicScore,
      uas_70: uas70,
    };
  }

  if (academicScore < 0 || academicScore > 70) {
    throw new Error("UAS 70 must be between 0 and 70 for A Level students graduating in 2025 or later");
  }

  const derivedRp90 = Number(((academicScore / 70) * 90).toFixed(2));

  return {
    qualification_type: qualificationType,
    institution_name: school,
    diploma_name: null,
    graduation_year: graduationYear,
    current_gpa: null,
    projected_gpa: null,
    rank_points: derivedRp90,
    uas_70: academicScore,
  };
}

  throw new Error("Invalid qualification");
}

module.exports.getMyAcademicProfile = async function getMyAcademicProfile(userId) {
  const parsedUserId = Number(userId);

  if (Number.isNaN(parsedUserId)) {
    throw new Error("Invalid user ID");
  }

  return prisma.userAcademicProfile.findUnique({
    where: {
      user_id: parsedUserId,
    },
  });
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
      full_name: true,
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

  return prisma.userAcademicProfile.upsert({
    where: {
      user_id: parsedUserId,
    },
    update: data,
    create: {
      user_id: parsedUserId,
      ...data,
    },
  });
};
