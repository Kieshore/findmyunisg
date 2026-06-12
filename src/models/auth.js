const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production", //keep false for localhost
  maxAge: 60 * 60 * 1000,
};

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 30 * 60 * 1000;
const OAUTH_STATE_COOKIE = "oauth_state";
const OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 10 * 60 * 1000,
};

const OAUTH_PROVIDERS = {
  google: {
    idColumn: "google_id",
    clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID",
    clientSecretEnv: "GOOGLE_OAUTH_CLIENT_SECRET",
    redirectUriEnv: "GOOGLE_OAUTH_REDIRECT_URI",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
    scope: "openid email profile",
  },
  microsoft: {
    idColumn: "microsoft_id",
    clientIdEnv: "MICROSOFT_OAUTH_CLIENT_ID",
    clientSecretEnv: "MICROSOFT_OAUTH_CLIENT_SECRET",
    redirectUriEnv: "MICROSOFT_OAUTH_REDIRECT_URI",
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    userInfoUrl: "https://graph.microsoft.com/oidc/userinfo",
    scope: "openid email profile",
  },
};

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function sanitizeUser(user) {
  return {
    user_id: user.user_id,
    first_name: user.first_name,
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
      expiresIn: "1h",
    }
  );
}

function getOAuthProvider(provider) {
  const config = OAUTH_PROVIDERS[provider];

  if (!config) {
    const error = new Error("Unsupported OAuth provider");
    error.statusCode = 400;
    throw error;
  }

  return config;
}

function getOAuthEnv(config) {
  const clientId = process.env[config.clientIdEnv];
  const clientSecret = process.env[config.clientSecretEnv];

  if (!clientId || !clientSecret) {
    const error = new Error("OAuth provider is not configured");
    error.statusCode = 500;
    throw error;
  }

  return {
    clientId,
    clientSecret,
  };
}

function getBaseUrl(req) {
  return process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
}

function getRedirectUri(provider, config, req) {
  return process.env[config.redirectUriEnv] || `${getBaseUrl(req)}/auth/${provider}/callback`;
}

function createOAuthState(provider) {
  return `${provider}.${crypto.randomBytes(32).toString("base64url")}`;
}

function assertOAuthState(provider, returnedState, cookieState) {
  if (!returnedState || !cookieState || returnedState !== cookieState) {
    const error = new Error("Invalid OAuth session. Please try again.");
    error.statusCode = 400;
    throw error;
  }

  if (!cookieState.startsWith(`${provider}.`)) {
    const error = new Error("OAuth provider mismatch. Please try again.");
    error.statusCode = 400;
    throw error;
  }
}

async function ensureOAuthUserColumns() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "google_id" TEXT,
      ADD COLUMN IF NOT EXISTS "microsoft_id" TEXT,
      ADD COLUMN IF NOT EXISTS "last_login_provider" TEXT
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "users_google_id_key"
    ON "users"("google_id")
    WHERE "google_id" IS NOT NULL
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "users_microsoft_id_key"
    ON "users"("microsoft_id")
    WHERE "microsoft_id" IS NOT NULL
  `);
}

async function fetchJsonOrThrow(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const error = new Error(json.error_description || json.error || "OAuth request failed");
    error.statusCode = 502;
    throw error;
  }

  return json;
}

function normalizeOAuthProfile(provider, profile) {
  const email = normalizeEmail(profile.email || profile.preferred_username || profile.upn);
  const providerId = profile.sub;
  const firstName =
    profile.given_name ||
    profile.name?.split(" ")[0] ||
    email?.split("@")[0] ||
    "User";

  if (!providerId || !email) {
    const error = new Error("OAuth profile is missing required identity fields");
    error.statusCode = 400;
    throw error;
  }

  if (provider === "google" && profile.email_verified !== true) {
    const error = new Error("Google account email is not verified");
    error.statusCode = 400;
    throw error;
  }

  return {
    providerId,
    email,
    firstName,
  };
}

async function findUserByProviderId(idColumn, providerId) {
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT user_id, first_name, full_name, email, citizenship, postal_code
      FROM "users"
      WHERE "${idColumn}" = $1
      LIMIT 1
    `,
    providerId
  );

  return rows[0] || null;
}

async function findUserForOAuthEmail(email) {
  const rows = await prisma.$queryRaw`
    SELECT user_id, first_name, full_name, email, citizenship, postal_code, google_id, microsoft_id
    FROM "users"
    WHERE email = ${email}
    LIMIT 1
  `;

  return rows[0] || null;
}

async function linkOAuthProviderToUser(userId, provider, idColumn, providerId, profile) {
  const rows = await prisma.$queryRawUnsafe(
    `
      UPDATE "users"
      SET "${idColumn}" = $1,
          first_name = COALESCE(first_name, $2),
          last_login_provider = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $4
      RETURNING user_id, first_name, full_name, email, citizenship, postal_code
    `,
    providerId,
    profile.firstName,
    provider,
    userId
  );

  return rows[0];
}

async function createOAuthUser(provider, idColumn, providerId, profile) {
  const rows = await prisma.$queryRawUnsafe(
    `
      INSERT INTO "users" (first_name, full_name, email, "${idColumn}", last_login_provider)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING user_id, first_name, full_name, email, citizenship, postal_code
    `,
    profile.firstName,
    null,
    profile.email,
    providerId,
    provider
  );

  return rows[0];
}

async function upsertOAuthUser(provider, profile) {
  const config = getOAuthProvider(provider);

  await ensureOAuthUserColumns();

  const byProvider = await findUserByProviderId(config.idColumn, profile.providerId);

  if (byProvider) {
    await clearFailedLogins(byProvider.email);
    return linkOAuthProviderToUser(
      byProvider.user_id,
      provider,
      config.idColumn,
      profile.providerId,
      profile
    );
  }

  const byEmail = await findUserForOAuthEmail(profile.email);

  if (byEmail) {
    const existingProviderId = byEmail[config.idColumn];

    if (existingProviderId && existingProviderId !== profile.providerId) {
      const error = new Error("This email is already linked to another OAuth account");
      error.statusCode = 409;
      throw error;
    }

    await clearFailedLogins(profile.email);
    return linkOAuthProviderToUser(
      byEmail.user_id,
      provider,
      config.idColumn,
      profile.providerId,
      profile
    );
  }

  await clearFailedLogins(profile.email);
  return createOAuthUser(provider, config.idColumn, profile.providerId, profile);
}

function createOAuthAuthorization(provider, req) {
  const config = getOAuthProvider(provider);
  const { clientId } = getOAuthEnv(config);
  const redirectUri = getRedirectUri(provider, config, req);
  const state = createOAuthState(provider);
  const url = new URL(config.authorizeUrl);

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");

  return {
    url: url.toString(),
    state,
  };
}

async function completeOAuthLogin({ provider, code, state, cookieState, req }) {
  const config = getOAuthProvider(provider);
  const { clientId, clientSecret } = getOAuthEnv(config);

  if (!code) {
    const error = new Error("OAuth callback did not include an authorization code");
    error.statusCode = 400;
    throw error;
  }

  assertOAuthState(provider, state, cookieState);

  const tokenBody = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: getRedirectUri(provider, config, req),
    grant_type: "authorization_code",
  });

  const token = await fetchJsonOrThrow(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: tokenBody.toString(),
  });

  const profile = await fetchJsonOrThrow(config.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
    },
  });

  return upsertOAuthUser(provider, normalizeOAuthProfile(provider, profile));
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

async function registerUser({ first_name, email, password, citizenship, postal_code }) {
  const normalizedEmail = normalizeEmail(email);
  const firstName = String(first_name || "").trim();

  if (!firstName || !normalizedEmail || !password) {
    throw new Error("First name, email and password are required");
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
      first_name: firstName,
      full_name: null,
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
  OAUTH_STATE_COOKIE,
  OAUTH_COOKIE_OPTIONS,
  sanitizeUser,
  createToken,
  createOAuthAuthorization,
  completeOAuthLogin,
  registerUser,
  loginUser,
  getCurrentUser,
};
