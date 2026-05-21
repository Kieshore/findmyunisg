const prisma = require("../lib/prisma");
const {
  attachInterestScoresToCourses,
  buildInterestProfileFromQuery,
  parseBoolean,
} = require("./coursePriorityRecommendation");
const { getEligibleCoursesForUser } = require("./courseRecommendationIGP");

// const PREV_PRESTIGE_SCORES = {
//   NUS: 92,
//   NTU: 89,
//   SMU: 85,
//   SUTD: 82,
//   SIT: 78,
//   SUSS: 75,
// };

const BASE_PRESTIGE_SCORES = {
  NUS: 94,
  NTU: 91,
  SMU: 82,
  SUTD: 80,
  SIT: 65,
  SUSS: 41,
};

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeUniCodes(value) {
  if (!value) return [];

  return String(value)
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function getLatestRowByCourse(admissionRows) {
  const latestByCourse = new Map();

  for (const row of admissionRows) {
    const courseId = row.course.course_id;

    if (!latestByCourse.has(courseId)) {
      latestByCourse.set(courseId, row);
    }
  }

  return Array.from(latestByCourse.values());
}

function buildBaseCompareCourse(row) {
  const outcome = row.course.outcomes?.[0] || null;

  return {
    course_id: row.course.course_id,
    course_name: row.course.course_name,
    university_code: row.course.university?.short_name ?? null,
    admission_profile_id: row.admission_profile_id,
    year_recorded: row.year_recorded,
    min_gpa: row.min_gpa,
    tenth_percentile_grades: row.tenth_percentile_grades,
    tenth_percentile_rp: row.tenth_percentile_rp,
    tenth_percentile_uas_70: row.tenth_percentile_uas_70,
    intake_size: row.intake_size,
    matched_via: "compare_all_courses",
    cutoff_gap: null,
    band_metric: null,
    prestige_score:
      BASE_PRESTIGE_SCORES[String(row.course.university?.short_name || "").toUpperCase()] ??
      null,
    ges: outcome
      ? {
          source_year: outcome.source_year,
          basic_monthly_median: outcome.basic_monthly_median,
          gross_monthly_median: outcome.gross_monthly_median,
          employment_rate_ft_perm: outcome.employment_rate_ft_perm,
          employment_rate_overall: outcome.employment_rate_overall,
        }
      : null,
  };
}

function flattenEligibleCourses(payload) {
  const results = payload?.results || [];
  return results.flatMap((result) => (Array.isArray(result.courses) ? result.courses : []));
}

function mergeEligibleData(baseCourses, eligibleCourses) {
  const eligibleMap = new Map(
    eligibleCourses.map((course) => [String(course.course_id), course])
  );

  return baseCourses.map((course) => {
    const eligible = eligibleMap.get(String(course.course_id));

    if (!eligible) {
      return {
        ...course,
        is_eligible_after_boost: false,
        recommendation_score: null,
      };
    }

    return {
      ...course,
      ...eligible,
      is_eligible_after_boost: true,
      recommendation_score: eligible.total_score ?? eligible.priority_score ?? null,
      interest_fit: eligible.interest_fit ?? course.interest_fit ?? null,
      priority_metrics: eligible.priority_metrics ?? null,
    };
  });
}

module.exports.getComparableCoursesForUser = async function getComparableCoursesForUser(
  queryParams
) {
  const {
    userId,
    search = "",
    difference = 0,
    limit = null,
    uni_code = null,
    band_min_percentage = 80,
    exclude_unwanted_interests = false,
    only_wanted_interests = false,
  } = queryParams;

  const parsedUserId = Number(userId);

  if (Number.isNaN(parsedUserId)) {
    throw new Error("Invalid userId");
  }

  const normalizedSearch = String(search || "").trim();
  const normalizedUniCodes = normalizeUniCodes(uni_code);

  const admissionRows = await prisma.courseAdmissionsProfile.findMany({
    where: {
      ...(normalizedSearch
        ? {
            course: {
              course_name: {
                contains: normalizedSearch,
                mode: "insensitive",
              },
            },
          }
        : {}),
      ...(normalizedUniCodes.length
        ? {
            course: {
              university: {
                short_name: {
                  in: normalizedUniCodes,
                },
              },
            },
          }
        : {}),
    },
    include: {
      course: {
        select: {
          course_id: true,
          course_name: true,
          university: {
            select: {
              short_name: true,
            },
          },
          outcomes: {
            orderBy: {
              source_year: "desc",
            },
            take: 1,
            select: {
              source_year: true,
              basic_monthly_median: true,
              gross_monthly_median: true,
              employment_rate_ft_perm: true,
              employment_rate_overall: true,
            },
          },
        },
      },
    },
    orderBy: {
      year_recorded: "desc",
    },
    ...(limit ? { take: Number(limit) } : {}),
  });

  const latestRows = getLatestRowByCourse(admissionRows);
  let baseCourses = latestRows.map(buildBaseCompareCourse);

  const interestProfile = buildInterestProfileFromQuery(queryParams);
  const excludeUnwantedInterests = parseBoolean(exclude_unwanted_interests, false);
  const onlyWantedInterests = parseBoolean(only_wanted_interests, false);

  const interestResult = await attachInterestScoresToCourses(baseCourses, interestProfile, {
    excludeUnwantedInterests,
    onlyWantedInterests,
  });

  baseCourses = interestResult.courses;

  const eligibleData = await getEligibleCoursesForUser(
    parsedUserId,
    difference,
    null,
    uni_code,
    band_min_percentage
  );

  const eligibleCourses = flattenEligibleCourses(eligibleData);
  const courses = mergeEligibleData(baseCourses, eligibleCourses);

  return {
    user_id: parsedUserId,
    search: normalizedSearch,
    total_courses: courses.length,
    total_excluded_courses: interestResult.excluded_courses?.length ?? 0,
    interest_profile_used: interestProfile,
    courses,
  };
};