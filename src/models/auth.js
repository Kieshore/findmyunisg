const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: false, // keep false for localhost. Set true only when using HTTPS.
  maxAge: 24 * 60 * 60 * 1000,
};

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 30 * 60 * 1000;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function sanitizeUser(user) {
  return {
    user_id: user.user_id,
    first_name: user.first_name,
    full_name: user.full_name,
    email: user.email,
    citizenship: user.citizenship,
    postal_code: user.postal_code,
  };
}

function createToken(user) {
  return jwt.sign(
    {
      userId: user.user_id,
      email: user.email,
    },
    process.env.JWT_SECRET_KEY,
    {
      expiresIn: "24h",
    }
  );
}

function buildLockError(lockedUntil) {
  const error = new Error("Too many login attempts. Please try again in 30 minutes.");
  error.statusCode = 429;
  error.lockedUntil = lockedUntil;
  error.remainingAttempts = 0;
  error.maxAttempts = MAX_LOGIN_ATTEMPTS;
  return error;
}

function buildInvalidLoginError(remainingAttempts) {
  const error = new Error("Invalid email or password");
  error.remainingAttempts = remainingAttempts;
  error.maxAttempts = MAX_LOGIN_ATTEMPTS;
  return error;
}

async function ensureLoginAttemptTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "login_attempt_locks" (
      "lock_id" SERIAL PRIMARY KEY,
      "email" TEXT NOT NULL UNIQUE,
      "failed_count" INTEGER NOT NULL DEFAULT 0,
      "locked_until" TIMESTAMP(3),
      "last_failed_at" TIMESTAMP(3),
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getLoginAttemptLock(email) {
  await ensureLoginAttemptTable();

  const [lock] = await prisma.$queryRaw`
    SELECT failed_count, locked_until
    FROM "login_attempt_locks"
    WHERE email = ${email}
    LIMIT 1
  `;

  return lock || null;
}

async function assertLoginNotLocked(email) {
  const lock = await getLoginAttemptLock(email);

  if (lock?.locked_until && new Date(lock.locked_until) > new Date()) {
    throw buildLockError(lock.locked_until);
  }
}

async function recordFailedLogin(email) {
  const now = new Date();
  const lock = await getLoginAttemptLock(email);
  const currentCount = lock?.locked_until && new Date(lock.locked_until) <= now
    ? 0
    : Number(lock?.failed_count || 0);
  const failedCount = currentCount + 1;
  const lockedUntil = failedCount >= MAX_LOGIN_ATTEMPTS
    ? new Date(now.getTime() + LOGIN_LOCK_MS)
    : null;

  await prisma.$executeRaw`
    INSERT INTO "login_attempt_locks" (email, failed_count, locked_until, last_failed_at)
    VALUES (${email}, ${failedCount}, ${lockedUntil}, ${now})
    ON CONFLICT (email) DO UPDATE
    SET failed_count = ${failedCount},
        locked_until = ${lockedUntil},
        last_failed_at = ${now},
        updated_at = CURRENT_TIMESTAMP
  `;

  if (lockedUntil) {
    throw buildLockError(lockedUntil);
  }

  return {
    failedCount,
    remainingAttempts: Math.max(MAX_LOGIN_ATTEMPTS - failedCount, 0),
  };
}

async function clearFailedLogins(email) {
  await ensureLoginAttemptTable();

  await prisma.$executeRaw`
    DELETE FROM "login_attempt_locks"
    WHERE email = ${email}
  `;
}

async function registerUser({ first_name, full_name, email, password, citizenship, postal_code }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    throw new Error("Email and password are required");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (existingUser) {
    throw new Error("User already exists");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      first_name: first_name || null,
      full_name: full_name || null,
      email: normalizedEmail,
      password_hash: passwordHash,
      citizenship: citizenship || null,
      postal_code: postal_code || null,
    },
  });

  return user;
}

async function loginUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    throw new Error("Email and password are required");
  }

  await assertLoginNotLocked(normalizedEmail);

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (!user || !user.password_hash) {
    const attempt = await recordFailedLogin(normalizedEmail);
    throw buildInvalidLoginError(attempt.remainingAttempts);
  }

  const isValidPassword = await bcrypt.compare(password, user.password_hash);

  if (!isValidPassword) {
    const attempt = await recordFailedLogin(normalizedEmail);
    throw buildInvalidLoginError(attempt.remainingAttempts);
  }

  await clearFailedLogins(normalizedEmail);

  return user;
}

async function getCurrentUser(userId) {
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
      full_name: true,
      first_name: true,
      email: true,
      citizenship: true,
      postal_code: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

module.exports = {
  COOKIE_OPTIONS,
  sanitizeUser,
  createToken,
  registerUser,
  loginUser,
  getCurrentUser,
};
