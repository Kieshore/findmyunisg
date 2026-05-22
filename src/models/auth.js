const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: false, // keep false for localhost. Set true only when using HTTPS.
  maxAge: 24 * 60 * 60 * 1000,
};

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

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (!user || !user.password_hash) {
    throw new Error("Invalid email or password");
  }

  const isValidPassword = await bcrypt.compare(password, user.password_hash);

  if (!isValidPassword) {
    throw new Error("Invalid email or password");
  }

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
      full_name: true,
      email: true,
      citizenship: true,
      postal_code: true,
      academic_profiles: {
        orderBy: {
          created_at: "desc",
        },
        take: 1,
      },
      preferences: {
        orderBy: {
          created_at: "desc",
        },
        take: 1,
      },
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