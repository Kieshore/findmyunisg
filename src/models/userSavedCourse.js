const prisma = require("../lib/prisma");

let ensureTablePromise = null;

function parseId(value, label) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}`);
  }

  return parsed;
}

function ensureSavedCoursesTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "user_saved_courses" (
          "saved_course_id" SERIAL NOT NULL,
          "user_id" INTEGER NOT NULL,
          "course_id" INTEGER NOT NULL,
          "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "user_saved_courses_pkey" PRIMARY KEY ("saved_course_id")
        )
      `);

      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "user_saved_courses_user_id_course_id_key"
        ON "user_saved_courses"("user_id", "course_id")
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "user_saved_courses_user_id_idx"
        ON "user_saved_courses"("user_id")
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "user_saved_courses_course_id_idx"
        ON "user_saved_courses"("course_id")
      `);
    })();
  }

  return ensureTablePromise;
}

module.exports.listSavedCourseIds = async function listSavedCourseIds(userId) {
  const parsedUserId = parseId(userId, "userId");

  await ensureSavedCoursesTable();

  const rows = await prisma.$queryRaw`
    SELECT course_id
    FROM user_saved_courses
    WHERE user_id = ${parsedUserId}
    ORDER BY saved_at DESC
  `;

  return rows.map(row => Number(row.course_id));
};

module.exports.saveCourse = async function saveCourse(userId, courseId) {
  const parsedUserId = parseId(userId, "userId");
  const parsedCourseId = parseId(courseId, "courseId");

  await ensureSavedCoursesTable();

  const courseRows = await prisma.$queryRaw`
    SELECT course_id
    FROM courses
    WHERE course_id = ${parsedCourseId}
    LIMIT 1
  `;

  if (!courseRows.length) {
    const error = new Error("Course not found");
    error.statusCode = 404;
    throw error;
  }

  await prisma.$executeRaw`
    INSERT INTO user_saved_courses (user_id, course_id)
    VALUES (${parsedUserId}, ${parsedCourseId})
    ON CONFLICT (user_id, course_id) DO NOTHING
  `;

  return module.exports.listSavedCourseIds(parsedUserId);
};

module.exports.removeCourse = async function removeCourse(userId, courseId) {
  const parsedUserId = parseId(userId, "userId");
  const parsedCourseId = parseId(courseId, "courseId");

  await ensureSavedCoursesTable();

  await prisma.$executeRaw`
    DELETE FROM user_saved_courses
    WHERE user_id = ${parsedUserId}
      AND course_id = ${parsedCourseId}
  `;

  return module.exports.listSavedCourseIds(parsedUserId);
};
