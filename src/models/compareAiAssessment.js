const crypto = require("crypto");
const prisma = require("../lib/prisma");
const openai = require("../lib/openai");
const { buildCompareAssessmentPrompt } = require("../utils/compareAssessmentPrompt");

const PROMPT_VERSION = "compare_assessment_v3_postal_uas70_intake";
const DAILY_GENERATE_LIMIT = 3;
const SG_TIMEZONE = "Asia/Singapore";

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
    .update(JSON.stringify(payload))
    .digest("hex");
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

  const payload = {
    prompt_version: PROMPT_VERSION,
    userId: parsedUserId,
    userProfile,
    preferences,
    leftCourse: enrichedLeftCourse,
    rightCourse: enrichedRightCourse,
  };

  const inputHash = createInputHash(payload);

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

  const quota = await consumeAiAssessmentUsage(parsedUserId);
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

Do not use web search to find campus postal codes when university_postal_code is already supplied.
Use the supplied user postal code and university postal codes for distance/travel comparison on Google Maps.
Return the distance from the user postal code and university postal codes as well as the time taken to travel using public transport.

Prefer official university pages and Singapore government or MOE-related pages.
Use only supplied data and verified public facts.
Do not invent facts.
If a fact cannot be verified, mark it as unknown.
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

  const assessment = JSON.parse(response.output_text);

  await prisma.compareAiAssessment.upsert({
    where: {
      input_hash: inputHash,
    },
    update: {
      request_payload: payload,
      assessment_result: assessment,
    },
    create: {
      user_id: parsedUserId,
      left_course_id: Number(leftCourse.course_id),
      right_course_id: Number(rightCourse.course_id),
      input_hash: inputHash,
      request_payload: payload,
      assessment_result: assessment,
    },
  });

  return {
    cached: false,
    assessment,
    quota,
  };
};

module.exports.getAiAssessmentUsage = getAiAssessmentUsage;
