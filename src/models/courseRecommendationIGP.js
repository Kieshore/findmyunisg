const prisma = require("../lib/prisma");
const {
  calculateBothFromGradeProfile,
  getUserAlevelScores,
} = require("../utils/aLevelScoreUtils");

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeUniCode(value) {
  const cleaned = String(value || "").trim();

  if (!cleaned) {
    return null;
  }

  return cleaned
    .split(",")
    .map(item => item.trim().toUpperCase())
    .filter(Boolean);
}

function normalizeLimit(value) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function isPolyQualification(value) {
  const normalized = String(value || "").toLowerCase();

  return (
    normalized.includes("poly") ||
    normalized.includes("polytechnic") ||
    normalized.includes("diploma")
  );
}

function isJcQualification(value) {
  const normalized = String(value || "").toLowerCase();

  return (
    normalized.includes("a level") ||
    normalized.includes("a-level") ||
    normalized.includes("jc") ||
    normalized.includes("junior college")
  );
}

function getAcademicValue(profile) {
  if (isPolyQualification(profile.qualification_type)) {
    return toNumber(profile.projected_gpa ?? profile.current_gpa);
  }

  if (isJcQualification(profile.qualification_type)) {
    const scores = getUserAlevelScores(profile);
    return scores.uas70;
  }

  return null;
}

function getAcademicValuesWithBoost(profile, difference) {
  const parsedDifference = Number(difference || 0);

  if (isPolyQualification(profile.qualification_type)) {
    const gpa = getAcademicValue(profile);

    return {
      directValue: gpa,
      directValueWithBoost:
        gpa === null ? null : Number((gpa + parsedDifference).toFixed(4)),

      bandGpaValue: gpa,
      bandGpaValueWithBoost:
        gpa === null ? null : Number((gpa + parsedDifference).toFixed(4)),

      uas70Value: null,
      uas70ValueWithBoost: null,

      rp90Value: null,
      rp90ValueWithBoost: null,
    };
  }

  if (isJcQualification(profile.qualification_type)) {
    const scores = getUserAlevelScores(profile);

    const graduationYear = Number(profile?.graduation_year || 0);
    const isOldRpSystem = graduationYear && graduationYear <= 2024;

    const uasBoost = isOldRpSystem
      ? Number(((parsedDifference / 90) * 70).toFixed(4))
      : parsedDifference;

    const rpBoost = isOldRpSystem
      ? parsedDifference
      : Number(((parsedDifference / 70) * 90).toFixed(4));

    return {
      directValue: scores.uas70,
      directValueWithBoost:
        scores.uas70 === null
          ? null
          : Number((scores.uas70 + uasBoost).toFixed(4)),

      bandGpaValue: null,
      bandGpaValueWithBoost: null,

      uas70Value: scores.uas70,
      uas70ValueWithBoost:
        scores.uas70 === null
          ? null
          : Number((scores.uas70 + uasBoost).toFixed(4)),

      rp90Value: scores.rp90 ?? scores.legacy90,
      rp90ValueWithBoost:
        (scores.rp90 ?? scores.legacy90) === null
          ? null
          : Number(((scores.rp90 ?? scores.legacy90) + rpBoost).toFixed(4)),
    };
  }

  return {
    directValue: null,
    directValueWithBoost: null,
    bandGpaValue: null,
    bandGpaValueWithBoost: null,
    uas70Value: null,
    uas70ValueWithBoost: null,
    rp90Value: null,
    rp90ValueWithBoost: null,
  };
}

function getBandCompareValueForRow(profileValues, bandRow) {
  const bandMin = Number(bandRow.band_min);
  const bandMax = Number(bandRow.band_max);

  if (Number.isNaN(bandMin) || Number.isNaN(bandMax)) {
    return null;
  }

  /*
    If a JC/A-Level band has band_max > 70, it cannot be UAS 70.
    It is an old RP /90 style band, usually used by SIT/SUSS.
  */
  if (bandMax > 70) {
    return profileValues.rp90ValueWithBoost;
  }

  /*
    If band_max <= 70, treat it as UAS 70.
  */
  return profileValues.uas70ValueWithBoost;
}

function isValueWithinBand(value, min, max) {
  const parsedValue = toNumber(value);
  const parsedMin = toNumber(min);
  const parsedMax = toNumber(max);

  if (
    parsedValue === null ||
    parsedMin === null ||
    parsedMax === null
  ) {
    return false;
  }

  return parsedValue >= parsedMin && parsedValue <= parsedMax;
}

function getLatestByCourse(rows) {
  const latestMap = new Map();

  rows.forEach(row => {
    const courseId = row.course_id || row.admission_profile?.course_id;

    if (!courseId) {
      return;
    }

    const existing = latestMap.get(courseId);

    const rowYear =
      row.year_recorded ??
      row.admission_profile?.year_recorded ??
      0;

    const existingYear =
      existing?.year_recorded ??
      existing?.admission_profile?.year_recorded ??
      0;

    if (!existing || Number(rowYear) > Number(existingYear)) {
      latestMap.set(courseId, row);
    }
  });

  return latestMap;
}

function getCutoffGap({
  benchmarkValue,
  qualificationType,
  admissionsProfile,
  matchedBandMetric,
}) {
  const benchmark = toNumber(benchmarkValue);

  if (benchmark === null) {
    return null;
  }

  if (matchedBandMetric) {
    const bandMin = toNumber(matchedBandMetric.band_min);

    if (bandMin === null) {
      return null;
    }

    return Number((benchmark - bandMin).toFixed(4));
  }

  if (isPolyQualification(qualificationType)) {
    const minGpa = toNumber(admissionsProfile.min_gpa);

    if (minGpa === null) {
      return null;
    }

    return Number((benchmark - minGpa).toFixed(4));
  }

  if (isJcQualification(qualificationType)) {
    const uasCutoff = toNumber(admissionsProfile.tenth_percentile_uas_70);

    if (uasCutoff === null) {
      return null;
    }

    return Number((benchmark - uasCutoff).toFixed(4));
  }

  return null;
}

function buildCourseResult({
  admissionsProfile,
  latestOutcome,
  matchedVia,
  matchedBandMetric,
  benchmarkValue,
  qualificationType,
}) {
  const cutoffGap = getCutoffGap({
    benchmarkValue,
    qualificationType,
    admissionsProfile,
    matchedBandMetric,
  });

  return {
    course_id: admissionsProfile.course.course_id,
    course_name: admissionsProfile.course.course_name,
    university_code: admissionsProfile.course.university?.short_name ?? null,

    admission_profile_id: admissionsProfile.admission_profile_id,
    year_recorded: admissionsProfile.year_recorded,

    min_gpa: admissionsProfile.min_gpa,
    tenth_percentile_grades: admissionsProfile.tenth_percentile_grades,
    tenth_percentile_rp: admissionsProfile.tenth_percentile_rp,
    tenth_percentile_uas_70: admissionsProfile.tenth_percentile_uas_70,
    intake_size: admissionsProfile.intake_size,

    matched_via: matchedVia,
    benchmark_value: benchmarkValue,
    cutoff_gap: cutoffGap,

    band_metric: matchedBandMetric
      ? {
          band_metric_id: matchedBandMetric.band_metric_id,
          university_code: matchedBandMetric.university_code,
          qualification_type: matchedBandMetric.qualification_type,
          metric_type: matchedBandMetric.metric_type,
          scope_type: matchedBandMetric.scope_type,
          band_label: matchedBandMetric.band_label,
          band_min: matchedBandMetric.band_min,
          band_max: matchedBandMetric.band_max,
          percentage_value: matchedBandMetric.percentage_value,
          display_order: matchedBandMetric.display_order,
          source_note: matchedBandMetric.source_note,
        }
      : null,

    ges: latestOutcome
      ? {
          source_year: latestOutcome.source_year,
          basic_monthly_median: latestOutcome.basic_monthly_median,
          gross_monthly_median: latestOutcome.gross_monthly_median,
          employment_rate_ft_perm: latestOutcome.employment_rate_ft_perm,
          employment_rate_overall: latestOutcome.employment_rate_overall,
        }
      : null,
  };
}

function getAdmissionsProfileDelegate() {
  const delegate =
    prisma.courseAdmissionsProfile ||
    prisma.courseAdmissionProfile;

  if (!delegate) {
    throw new Error(
      "Prisma admissions profile model not found. Expected prisma.courseAdmissionsProfile or prisma.courseAdmissionProfile."
    );
  }

  return delegate;
}

function getBandMetricDelegate() {
  const delegate =
    prisma.courseAdmissionBandMetric ||
    prisma.courseAdmissionsBandMetric ||
    prisma.courseAdmissionsProfileBandMetric ||
    prisma.admissionProfileBandMetric ||
    prisma.admissionBandMetric ||
    prisma.courseBandMetric;

  if (!delegate) {
    throw new Error(
      "Prisma band metric model not found. Add your actual Prisma band metric delegate name inside getBandMetricDelegate()."
    );
  }

  return delegate;
}

async function getUserAcademicProfiles(userId) {
  const parsedUserId = Number(userId);

  if (Number.isNaN(parsedUserId)) {
    throw new Error("Invalid userId");
  }

  /*
    This supports both:
    - old one-to-many academic_profiles structure
    - new one-profile-per-user structure
  */
  const profiles = await prisma.userAcademicProfile.findMany({
    where: {
      user_id: parsedUserId,
    },
    orderBy: {
      created_at: "desc",
    },
  });

  return profiles;
}

module.exports.updateTenthPercentileRp = async function updateTenthPercentileRp(
  courseId
) {
  const parsedCourseId =
    courseId === null || courseId === undefined || courseId === ""
      ? null
      : Number(courseId);

  const admissionsDelegate = getAdmissionsProfileDelegate();

  const profiles = await admissionsDelegate.findMany({
    where: {
      ...(parsedCourseId
        ? {
            course_id: parsedCourseId,
          }
        : {}),
      tenth_percentile_grades: {
        not: null,
      },
    },
  });

  const updated = [];

  for (const profile of profiles) {
    const calculated = calculateBothFromGradeProfile(
      profile.tenth_percentile_grades
    );

    if (!calculated) {
      continue;
    }

    const result = await admissionsDelegate.update({
      where: {
        admission_profile_id: profile.admission_profile_id,
      },
      data: {
        tenth_percentile_rp: calculated.legacy90,
        tenth_percentile_uas_70: calculated.uas70,
      },
    });

    updated.push(result);
  }

  return {
    count: updated.length,
    updated,
  };
};

module.exports.getEligibleCoursesForUser = async function getEligibleCoursesForUser(
  userId,
  difference = 0,
  limit = null,
  uni_code = null,
  band_min_percentage = 80
) {
  const parsedDifference = Number(difference || 0);
  const parsedLimit = normalizeLimit(limit);
  const parsedBandMinPercentage = Number(band_min_percentage || 80);
  const normalizedUniCode = normalizeUniCode(uni_code);

  const admissionsDelegate = getAdmissionsProfileDelegate();
  const bandMetricDelegate = getBandMetricDelegate();

  const academicProfiles = await getUserAcademicProfiles(userId);

  const results = [];

  if (!academicProfiles.length) {
    return {
      user_id: Number(userId),
      results: [],
    };
  }

  for (const profile of academicProfiles) {
    const profileValues = getAcademicValuesWithBoost(profile, parsedDifference);

    const benchmarkValue = profileValues.directValue;
    const benchmarkValueWithBoost = profileValues.directValueWithBoost;

    if (benchmarkValueWithBoost === null) {
      results.push({
        academic_profile_id: profile.academic_profile_id,
        qualification_type: profile.qualification_type,
        benchmark_value: null,
        benchmark_value_with_boost: null,

        uas70_value: profileValues.uas70Value,
        uas70_value_with_boost: profileValues.uas70ValueWithBoost,

        rp90_value: profileValues.rp90Value,
        rp90_value_with_boost: profileValues.rp90ValueWithBoost,

        difference_used: parsedDifference,
        uni_code: normalizedUniCode,
        courses: [],
        band_min_percentage_used: parsedBandMinPercentage,
      });

      continue;
    }

    const courseUniversityWhere = normalizedUniCode?.length
      ? {
          university: {
            short_name: {
              in: normalizedUniCode,
            },
          },
        }
      : {};

    const directWhere = isPolyQualification(profile.qualification_type)
      ? {
          min_gpa: {
            not: null,
            lte: benchmarkValueWithBoost,
          },
        }
      : {
          tenth_percentile_uas_70: {
            not: null,
            lte: benchmarkValueWithBoost,
          },
        };

    const directCandidates = await admissionsDelegate.findMany({
      where: {
        ...directWhere,
        course: courseUniversityWhere,
      },
      include: {
        course: {
          include: {
            university: true,
            outcomes: {
              orderBy: {
                source_year: "desc",
              },
              take: 1,
            },
          },
        },
      },
      orderBy: {
        year_recorded: "desc",
      },
    });

    const latestDirectMap = getLatestByCourse(directCandidates);

    const bandQualificationType = isPolyQualification(profile.qualification_type)
      ? "poly_gpa"
      : "a_level_uas";

    const bandCandidates = await bandMetricDelegate.findMany({
      where: {
        qualification_type: bandQualificationType,
        percentage_value: {
          gte: parsedBandMinPercentage,
        },
        ...(normalizedUniCode?.length
          ? {
              university_code: {
                in: normalizedUniCode,
              },
            }
          : {}),
        admission_profile: {
          course: courseUniversityWhere,
        },
      },
      include: {
        admission_profile: {
          include: {
            course: {
              include: {
                university: true,
                outcomes: {
                  orderBy: {
                    source_year: "desc",
                  },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: [
        {
          percentage_value: "desc",
        },
        {
          display_order: "asc",
        },
      ],
    });

    const filteredBandCandidates = bandCandidates.filter(row => {
      const compareValue = isPolyQualification(profile.qualification_type)
        ? profileValues.bandGpaValueWithBoost
        : getBandCompareValueForRow(profileValues, row);

      return isValueWithinBand(compareValue, row.band_min, row.band_max);
    });

    const latestBandMap = getLatestByCourse(filteredBandCandidates);

    const deduped = new Map();

    for (const admissionsProfile of latestDirectMap.values()) {
      const latestOutcome = admissionsProfile.course.outcomes[0] || null;

      const result = buildCourseResult({
        admissionsProfile,
        latestOutcome,
        matchedVia: "direct_igp",
        matchedBandMetric: null,
        benchmarkValue: benchmarkValueWithBoost,
        qualificationType: profile.qualification_type,
      });

      deduped.set(admissionsProfile.course.course_id, result);
    }

    for (const bandMetric of latestBandMap.values()) {
      const admissionsProfile = bandMetric.admission_profile;
      const latestOutcome = admissionsProfile.course.outcomes[0] || null;
      const existing = deduped.get(admissionsProfile.course.course_id);

      const bandBenchmarkValue = isPolyQualification(profile.qualification_type)
        ? profileValues.bandGpaValueWithBoost
        : getBandCompareValueForRow(profileValues, bandMetric);

      const result = buildCourseResult({
        admissionsProfile,
        latestOutcome,
        matchedVia: "band_metric",
        matchedBandMetric: bandMetric,
        benchmarkValue: bandBenchmarkValue,
        qualificationType: profile.qualification_type,
      });

      if (!existing) {
        deduped.set(admissionsProfile.course.course_id, result);
      } else {
        deduped.set(admissionsProfile.course.course_id, {
          ...existing,
          matched_via: "direct_igp_and_band_metric",
          band_metric: result.band_metric,
          cutoff_gap:
            existing.cutoff_gap === null || result.cutoff_gap === null
              ? existing.cutoff_gap ?? result.cutoff_gap
              : Math.min(existing.cutoff_gap, result.cutoff_gap),
        });
      }
    }

    let rankedCourses = Array.from(deduped.values()).sort((a, b) => {
      const aGap = a.cutoff_gap ?? -9999;
      const bGap = b.cutoff_gap ?? -9999;

      if (bGap !== aGap) {
        return bGap - aGap;
      }

      const aSalary = Number(a.ges?.gross_monthly_median ?? 0);
      const bSalary = Number(b.ges?.gross_monthly_median ?? 0);

      return bSalary - aSalary;
    });

    if (parsedLimit) {
      rankedCourses = rankedCourses.slice(0, parsedLimit);
    }

    results.push({
      academic_profile_id: profile.academic_profile_id,
      qualification_type: profile.qualification_type,

      benchmark_value: benchmarkValue,
      benchmark_value_with_boost: benchmarkValueWithBoost,

      uas70_value: profileValues.uas70Value,
      uas70_value_with_boost: profileValues.uas70ValueWithBoost,

      rp90_value: profileValues.rp90Value,
      rp90_value_with_boost: profileValues.rp90ValueWithBoost,

      difference_used: parsedDifference,
      uni_code: normalizedUniCode,

      courses: rankedCourses,
      band_min_percentage_used: parsedBandMinPercentage,
    });
  }

  return {
    user_id: Number(userId),
    results,
  };
};