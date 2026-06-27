const prisma = require("../lib/prisma");

const DEFAULT_INTEREST_STATE = {
  wanted: {
    high: [],
    medium: [],
    low: [],
  },
  unwanted: {
    high: [],
    medium: [],
    low: [],
  },
};

const DEFAULT_FINDER_STATE = {
  activeUni: "All",
  gpaBoost: "0",
  bandMinPercentage: "80",
  selectedUniversities: [],
  onlyWanted: true,
  excludeUnwanted: false,
  courseKeyword: "",
  priority: {
    1: ["interest"],
    2: ["prestige"],
    3: ["salary"],
    4: ["employability"],
  },
};

function cleanInterestState(value) {
  return {
    wanted: {
      high: Array.isArray(value?.wanted?.high) ? value.wanted.high : [],
      medium: Array.isArray(value?.wanted?.medium) ? value.wanted.medium : [],
      low: Array.isArray(value?.wanted?.low) ? value.wanted.low : [],
    },
    unwanted: {
      high: Array.isArray(value?.unwanted?.high) ? value.unwanted.high : [],
      medium: Array.isArray(value?.unwanted?.medium) ? value.unwanted.medium : [],
      low: Array.isArray(value?.unwanted?.low) ? value.unwanted.low : [],
    },
  };
}

function cleanFinderState(value) {
  return {
    ...DEFAULT_FINDER_STATE,
    ...value,
    selectedUniversities: Array.isArray(value?.selectedUniversities)
      ? value.selectedUniversities
      : [],
    priority:
      value?.priority && typeof value.priority === "object"
        ? {
            1: Array.isArray(value.priority["1"]) ? value.priority["1"] : [],
            2: Array.isArray(value.priority["2"]) ? value.priority["2"] : [],
            3: Array.isArray(value.priority["3"]) ? value.priority["3"] : [],
            4: Array.isArray(value.priority["4"]) ? value.priority["4"] : [],
          }
        : DEFAULT_FINDER_STATE.priority,
  };
}

module.exports.getInterestPreference = async function getInterestPreference(userId) {
  const parsedUserId = Number(userId);

  if (Number.isNaN(parsedUserId)) {
    throw new Error("Invalid userId");
  }

  const row = await prisma.userInterestPreference.findUnique({
    where: {
      user_id: parsedUserId,
    },
  });

  if (!row) {
    return DEFAULT_INTEREST_STATE;
  }

  return cleanInterestState({
    wanted: row.wanted_interests,
    unwanted: row.unwanted_interests,
  });
};

module.exports.upsertInterestPreference = async function upsertInterestPreference(
  userId,
  interestState
) {
  const parsedUserId = Number(userId);

  if (Number.isNaN(parsedUserId)) {
    throw new Error("Invalid userId");
  }

  const cleanState = cleanInterestState(interestState);

  const row = await prisma.userInterestPreference.upsert({
    where: {
      user_id: parsedUserId,
    },
    update: {
      wanted_interests: cleanState.wanted,
      unwanted_interests: cleanState.unwanted,
    },
    create: {
      user_id: parsedUserId,
      wanted_interests: cleanState.wanted,
      unwanted_interests: cleanState.unwanted,
    },
  });

  return {
    wanted: row.wanted_interests,
    unwanted: row.unwanted_interests,
  };
};

module.exports.getFinderPreference = async function getFinderPreference(userId) {
  const parsedUserId = Number(userId);

  if (Number.isNaN(parsedUserId)) {
    throw new Error("Invalid userId");
  }

  const row = await prisma.userCourseFinderPreference.findUnique({
    where: {
      user_id: parsedUserId,
    },
  });

  if (!row) {
    return DEFAULT_FINDER_STATE;
  }

  return cleanFinderState({
    activeUni: row.active_uni,
    gpaBoost: row.gpa_boost,
    bandMinPercentage: row.band_min_percentage,
    selectedUniversities: row.selected_universities,
    onlyWanted: row.only_wanted,
    excludeUnwanted: row.exclude_unwanted,
    courseKeyword: row.course_keyword,
    priority: row.priority_space,
  });
};

module.exports.upsertFinderPreference = async function upsertFinderPreference(
  userId,
  finderState
) {
  const parsedUserId = Number(userId);

  if (Number.isNaN(parsedUserId)) {
    throw new Error("Invalid userId");
  }

  const cleanState = cleanFinderState(finderState);

  const row = await prisma.userCourseFinderPreference.upsert({
    where: {
      user_id: parsedUserId,
    },
    update: {
      active_uni: cleanState.activeUni,
      gpa_boost: String(cleanState.gpaBoost ?? "0"),
      band_min_percentage: String(cleanState.bandMinPercentage ?? "80"),
      selected_universities: cleanState.selectedUniversities,
      only_wanted: Boolean(cleanState.onlyWanted),
      exclude_unwanted: Boolean(cleanState.excludeUnwanted),
      course_keyword: cleanState.courseKeyword || "",
      priority_space: cleanState.priority,
    },
    create: {
      user_id: parsedUserId,
      active_uni: cleanState.activeUni,
      gpa_boost: String(cleanState.gpaBoost ?? "0"),
      band_min_percentage: String(cleanState.bandMinPercentage ?? "80"),
      selected_universities: cleanState.selectedUniversities,
      only_wanted: Boolean(cleanState.onlyWanted),
      exclude_unwanted: Boolean(cleanState.excludeUnwanted),
      course_keyword: cleanState.courseKeyword || "",
      priority_space: cleanState.priority,
    },
  });

  return cleanFinderState({
    activeUni: row.active_uni,
    gpaBoost: row.gpa_boost,
    bandMinPercentage: row.band_min_percentage,
    selectedUniversities: row.selected_universities,
    onlyWanted: row.only_wanted,
    excludeUnwanted: row.exclude_unwanted,
    courseKeyword: row.course_keyword,
    priority: row.priority_space,
  });
};