const crypto = require("crypto");
const prisma = require("../lib/prisma");
const openai = require("../lib/openai");
const { buildCompareAssessmentPrompt } = require("../utils/compareAssessmentPrompt");

const PROMPT_VERSION = "compare_assessment_v6_absolute_course_wording";
const DAILY_GENERATE_LIMIT = 3;
const SG_TIMEZONE = "Asia/Singapore";
const GOOGLE_DISTANCE_MATRIX_URL = "https://maps.googleapis.com/maps/api/distancematrix/json";

function getSingaporeDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: SG_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

function getUsageWindow(date = new Date()) {
  const { year, month, day } = getSingaporeDateParts(date);
  const usageDate = new Date(Date.UTC(year, month - 1, day));
  const resetAt = new Date(Date.UTC(year, month - 1, day + 1) - (8 * 60 * 60 * 1000));

  return {
    usageDate,
    resetAt,
  };
}

function formatUsage(usage, resetAt) {
  const used = Math.min(Number(usage?.used_count || 0), DAILY_GENERATE_LIMIT);

  return {
    limit: DAILY_GENERATE_LIMIT,
    used,
    remaining: Math.max(DAILY_GENERATE_LIMIT - used, 0),
    resetAt,
  };
}

async function ensureAiAssessmentUsageTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ai_assessment_daily_usage" (
      "usage_id" SERIAL PRIMARY KEY,
      "user_id" INTEGER NOT NULL REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE,
      "usage_date" DATE NOT NULL,
      "used_count" INTEGER NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ai_assessment_daily_usage_user_id_usage_date_key"
    ON "ai_assessment_daily_usage"("user_id", "usage_date")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ai_assessment_daily_usage_usage_date_idx"
    ON "ai_assessment_daily_usage"("usage_date")
  `);
}

async function getAiAssessmentUsage(userId) {
  const parsedUserId = Number(userId);

  if (Number.isNaN(parsedUserId)) {
    throw new Error("Invalid userId");
  }

  const { usageDate, resetAt } = getUsageWindow();
  await ensureAiAssessmentUsageTable();

  const [usage] = await prisma.$queryRaw`
    SELECT used_count
    FROM "ai_assessment_daily_usage"
    WHERE user_id = ${parsedUserId}
      AND usage_date = ${usageDate}
    LIMIT 1
  `;

  return formatUsage(usage, resetAt);
}

async function assertAiAssessmentUsageAvailable(userId) {
  const usage = await getAiAssessmentUsage(userId);

  if (usage.remaining <= 0) {
    const error = new Error("Daily AI assessment limit reached. Please try again tomorrow.");
    error.statusCode = 429;
    error.usage = usage;
    throw error;
  }

  return usage;
}

async function consumeAiAssessmentUsage(userId) {
  const parsedUserId = Number(userId);

  if (Number.isNaN(parsedUserId)) {
    throw new Error("Invalid userId");
  }

  const { usageDate, resetAt } = getUsageWindow();
  await ensureAiAssessmentUsageTable();

  await prisma.$executeRaw`
    INSERT INTO "ai_assessment_daily_usage" (user_id, usage_date, used_count)
    VALUES (${parsedUserId}, ${usageDate}, 0)
    ON CONFLICT (user_id, usage_date) DO NOTHING
  `;

  const updatedRows = await prisma.$queryRaw`
    UPDATE "ai_assessment_daily_usage"
    SET used_count = used_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${parsedUserId}
      AND usage_date = ${usageDate}
      AND used_count < ${DAILY_GENERATE_LIMIT}
    RETURNING used_count
  `;

  if (updatedRows.length === 0) {
    const error = new Error("Daily AI assessment limit reached. Please try again tomorrow.");
    error.statusCode = 429;
    error.usage = await getAiAssessmentUsage(parsedUserId);
    throw error;
  }

  const [usage] = updatedRows;

  return formatUsage(usage, resetAt);
}

function createInputHash(payload) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(toJsonSafeValue(payload)))
    .digest("hex");
}

function isDecimalLike(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.s === "number" &&
    typeof value.e === "number" &&
    Array.isArray(value.d)
  );
}

function toJsonSafeValue(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, entryValue) => {
      if (typeof entryValue === "bigint") {
        return entryValue.toString();
      }

      if (
        entryValue === undefined ||
        typeof entryValue === "function" ||
        typeof entryValue === "symbol"
      ) {
        return undefined;
      }

      if (isDecimalLike(entryValue)) {
        return entryValue.toString();
      }

      return entryValue;
    })
  );
}

function normalizeSingaporePostalCode(value) {
  const digits = String(value || "").replace(/\D/g, "");

  return digits.length === 6 ? digits : null;
}

function formatSingaporePostalCode(postalCode) {
  return `Singapore ${postalCode}`;
}

function getGoogleMapsApiKey() {
  return (
    process.env.GOOGLE_MAPS_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_DISTANCE_MATRIX_API_KEY ||
    process.env.GOOGLE_MAPS_DISTANCE_API_KEY ||
    ""
  );
}

function removeTravelFields(value) {
  if (Array.isArray(value)) {
    return value
      .filter(item => {
        if (typeof item !== "string") return true;
        return !/(postal|distance|travel|commute)/i.test(item);
      })
      .map(removeTravelFields);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.entries(value).reduce((acc, [key, entryValue]) => {
    if (/(postal|distance|travel|commute)/i.test(key)) {
      return acc;
    }

    acc[key] = removeTravelFields(entryValue);
    return acc;
  }, {});
}

function buildOpenAiAssessmentPayload(payload) {
  return removeTravelFields(payload);
}

function buildTravelInput(userProfile, leftCourse, rightCourse) {
  return {
    mode: "transit",
    user_postal_code: normalizeSingaporePostalCode(userProfile?.postal_code),
    left_university_postal_code: normalizeSingaporePostalCode(
      leftCourse?.university_postal_code
    ),
    right_university_postal_code: normalizeSingaporePostalCode(
      rightCourse?.university_postal_code
    ),
  };
}

function buildTravelRoute(course, universityPostalCode, status, error = null) {
  return {
    course_id: getCourseId(course),
    course_name: course?.course_name || course?.raw?.course_name || "Unknown course",
    university_code: getCourseUniversityCode(course),
    university_postal_code: universityPostalCode,
    status,
    error,
    distance_text: null,
    distance_meters: null,
    duration_text: null,
    duration_seconds: null,
  };
}

async function getGoogleTravelComparison(travelInput, leftCourse, rightCourse) {
  const apiKey = getGoogleMapsApiKey();
  const routes = {
    left_course: buildTravelRoute(
      leftCourse,
      travelInput.left_university_postal_code,
      "PENDING"
    ),
    right_course: buildTravelRoute(
      rightCourse,
      travelInput.right_university_postal_code,
      "PENDING"
    ),
  };

  const comparison = {
    source: "Google Maps Distance Matrix API",
    mode: "transit",
    mode_label: "Public transport",
    left_course: routes.left_course,
    right_course: routes.right_course,
    unavailable_reason: null,
  };

  if (!travelInput.user_postal_code) {
    comparison.unavailable_reason = "Add your postal code in Profile to calculate travel time.";
    comparison.left_course.status = "MISSING_USER_POSTAL_CODE";
    comparison.left_course.error = comparison.unavailable_reason;
    comparison.right_course.status = "MISSING_USER_POSTAL_CODE";
    comparison.right_course.error = comparison.unavailable_reason;
    return comparison;
  }

  if (!apiKey) {
    comparison.unavailable_reason = "Google Maps API key is not configured.";
    comparison.left_course.status = "MISSING_API_KEY";
    comparison.left_course.error = comparison.unavailable_reason;
    comparison.right_course.status = "MISSING_API_KEY";
    comparison.right_course.error = comparison.unavailable_reason;
    return comparison;
  }

  const destinationEntries = [
    ["left_course", travelInput.left_university_postal_code],
    ["right_course", travelInput.right_university_postal_code],
  ].filter(([, postalCode]) => Boolean(postalCode));

  Object.entries(routes).forEach(([key, route]) => {
    if (!route.university_postal_code) {
      route.status = "MISSING_UNIVERSITY_POSTAL_CODE";
      route.error = "University postal code is missing.";
    }
  });

  if (!destinationEntries.length) {
    comparison.unavailable_reason = "University postal codes are missing.";
    return comparison;
  }

  try {
    const params = new URLSearchParams({
      origins: formatSingaporePostalCode(travelInput.user_postal_code),
      destinations: destinationEntries
        .map(([, postalCode]) => formatSingaporePostalCode(postalCode))
        .join("|"),
      mode: travelInput.mode,
      units: "metric",
      region: "sg",
      key: apiKey,
    });

    const response = await fetch(`${GOOGLE_DISTANCE_MATRIX_URL}?${params.toString()}`);
    const data = await response.json();

    if (!response.ok || data.status !== "OK") {
      const message =
        data.error_message ||
        `Google Maps returned ${data.status || response.status}.`;

      comparison.unavailable_reason = message;
      destinationEntries.forEach(([key]) => {
        routes[key].status = data.status || "GOOGLE_MAPS_ERROR";
        routes[key].error = message;
      });

      return comparison;
    }

    const elements = data.rows?.[0]?.elements || [];

    destinationEntries.forEach(([key], index) => {
      const element = elements[index] || {};
      const route = routes[key];

      route.status = element.status || "UNKNOWN";

      if (element.status !== "OK") {
        route.error = `Google Maps route status: ${route.status}.`;
        return;
      }

      route.distance_text = element.distance?.text || null;
      route.distance_meters = element.distance?.value ?? null;
      route.duration_text = element.duration?.text || null;
      route.duration_seconds = element.duration?.value ?? null;
      route.error = null;
    });

    return comparison;
  } catch (error) {
    comparison.unavailable_reason = "Unable to contact Google Maps for travel estimates.";
    destinationEntries.forEach(([key]) => {
      routes[key].status = "REQUEST_FAILED";
      routes[key].error = comparison.unavailable_reason;
    });

    return comparison;
  }
}

async function getUserProfile(userId) {
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
      full_name: true,
      citizenship: true,
      postal_code: true,
      email: true,
      academic_profile: true,
      preferences: {
        orderBy: {
          created_at: "desc",
        },
        take: 1,
      },
    },
  });
}

function getCourseUniversityCode(course) {
  return (
    course?.university_code ||
    course?.raw?.university_code ||
    course?.university?.short_name ||
    course?.raw?.university?.short_name ||
    null
  );
}

function getCourseId(course) {
  return Number(course?.course_id || course?.raw?.course_id || null);
}

async function getUniversityDataForCourses(leftCourse, rightCourse) {
  const courseIds = [getCourseId(leftCourse), getCourseId(rightCourse)].filter(Boolean);

  const explicitUniCodes = [
    getCourseUniversityCode(leftCourse),
    getCourseUniversityCode(rightCourse),
  ]
    .filter(Boolean)
    .map(code => String(code).toUpperCase());

  const courseRows = courseIds.length
    ? await prisma.course.findMany({
        where: {
          course_id: {
            in: courseIds,
          },
        },
        select: {
          course_id: true,
          university: {
            select: {
              university_name: true,
              short_name: true,
              postal_code: true,
            },
          },
        },
      })
    : [];

  const universityRows = explicitUniCodes.length
    ? await prisma.university.findMany({
        where: {
          short_name: {
            in: explicitUniCodes,
          },
        },
        select: {
          university_name: true,
          short_name: true,
          postal_code: true,
        },
      })
    : [];

  const byCourseId = new Map(
    courseRows.map(row => [String(row.course_id), row.university])
  );

  const byShortName = new Map(
    universityRows.map(row => [String(row.short_name).toUpperCase(), row])
  );

  return {
    byCourseId,
    byShortName,
  };
}

function enrichCourseWithUniversityPostalCode(course, universityData) {
  const courseId = getCourseId(course);
  const uniCode = getCourseUniversityCode(course);

  const universityFromCourseId = courseId
    ? universityData.byCourseId.get(String(courseId))
    : null;

  const universityFromCode = uniCode
    ? universityData.byShortName.get(String(uniCode).toUpperCase())
    : null;

  const university = universityFromCourseId || universityFromCode || null;

  return {
    ...course,
    university_name:
      course.university_name ||
      university?.university_name ||
      course.raw?.university_name ||
      null,
    university_code:
      course.university_code ||
      university?.short_name ||
      uniCode ||
      null,
    university_postal_code:
      course.university_postal_code ||
      university?.postal_code ||
      null,
  };
}

module.exports.generateCompareAssessment = async function generateCompareAssessment({
  userId,
  leftCourse,
  rightCourse,
  preferences = {},
  forceRefresh = false,
}) {
  const parsedUserId = Number(userId);

  if (Number.isNaN(parsedUserId)) {
    throw new Error("Invalid userId");
  }

  if (!leftCourse?.course_id || !rightCourse?.course_id) {
    throw new Error("Both leftCourse and rightCourse are required");
  }

  const userProfile = await getUserProfile(parsedUserId);

  const universityData = await getUniversityDataForCourses(leftCourse, rightCourse);

  const enrichedLeftCourse = enrichCourseWithUniversityPostalCode(
    leftCourse,
    universityData
  );

  const enrichedRightCourse = enrichCourseWithUniversityPostalCode(
    rightCourse,
    universityData
  );

  const fullPayload = {
    prompt_version: PROMPT_VERSION,
    userId: parsedUserId,
    userProfile,
    preferences,
    leftCourse: enrichedLeftCourse,
    rightCourse: enrichedRightCourse,
  };

  const travelInput = buildTravelInput(
    userProfile,
    enrichedLeftCourse,
    enrichedRightCourse
  );
  const payload = buildOpenAiAssessmentPayload(fullPayload);
  const inputHash = createInputHash({
    ...payload,
    google_travel_input: travelInput,
  });

  if (!forceRefresh) {
    const cached = await prisma.compareAiAssessment.findUnique({
      where: {
        input_hash: inputHash,
      },
    });

    if (cached) {
      return {
        cached: true,
        assessment: cached.assessment_result,
        quota: await getAiAssessmentUsage(parsedUserId),
      };
    }
  }

  await assertAiAssessmentUsageAvailable(parsedUserId);

  const googleTravel = await getGoogleTravelComparison(
    travelInput,
    enrichedLeftCourse,
    enrichedRightCourse
  );
  const prompt = buildCompareAssessmentPrompt(payload);

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    tools: [
      {
        type: "web_search_preview",
      },
    ],
    input: [
      {
        role: "system",
        content: `
You are a careful Singapore university course comparison assistant.

You may use web search only to verify missing course-specific public facts such as:
- official course curriculum
- official tuition fees by citizenship
- official programme structure

Prefer official university pages and Singapore government or MOE-related pages.
Use only supplied data and verified public facts.
Do not invent facts.
If a fact cannot be verified, mark it as unknown.
Commute estimates are calculated separately by Google Maps and must not be estimated here.
Return concise, practical advice.
        `,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "course_compare_assessment",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            summary: {
              type: "string",
            },
            left_course: {
              type: "object",
              additionalProperties: false,
              properties: {
                course_name: { type: "string" },
                best_for: { type: "string" },
                pros: { type: "array", items: { type: "string" } },
                cons: { type: "array", items: { type: "string" } },
                risks: { type: "array", items: { type: "string" } },
              },
              required: ["course_name", "best_for", "pros", "cons", "risks"],
            },
            right_course: {
              type: "object",
              additionalProperties: false,
              properties: {
                course_name: { type: "string" },
                best_for: { type: "string" },
                pros: { type: "array", items: { type: "string" } },
                cons: { type: "array", items: { type: "string" } },
                risks: { type: "array", items: { type: "string" } },
              },
              required: ["course_name", "best_for", "pros", "cons", "risks"],
            },
            side_by_side_judgement: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  factor: { type: "string" },
                  better_course: { type: "string" },
                  reason: { type: "string" },
                },
                required: ["factor", "better_course", "reason"],
              },
            },
            web_research_used: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  claim: { type: "string" },
                  source_type: { type: "string" },
                  confidence: { type: "string" },
                },
                required: ["claim", "source_type", "confidence"],
              },
            },
            final_recommendation: {
              type: "string",
            },
            missing_data_warnings: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: [
            "summary",
            "left_course",
            "right_course",
            "side_by_side_judgement",
            "web_research_used",
            "final_recommendation",
            "missing_data_warnings",
          ],
        },
      },
    },
  });

  const assessment = {
    ...JSON.parse(response.output_text),
    google_travel: googleTravel,
  };
  const savedRequestPayload = toJsonSafeValue({
    ...payload,
    google_travel_input: travelInput,
  });
  const savedAssessment = toJsonSafeValue(assessment);

  await prisma.compareAiAssessment.upsert({
    where: {
      input_hash: inputHash,
    },
    update: {
      request_payload: savedRequestPayload,
      assessment_result: savedAssessment,
    },
    create: {
      user_id: parsedUserId,
      left_course_id: Number(leftCourse.course_id),
      right_course_id: Number(rightCourse.course_id),
      input_hash: inputHash,
      request_payload: savedRequestPayload,
      assessment_result: savedAssessment,
    },
  });

  const quota = await consumeAiAssessmentUsage(parsedUserId);

  return {
    cached: false,
    assessment: savedAssessment,
    quota,
  };
};

module.exports.getAiAssessmentUsage = getAiAssessmentUsage;
