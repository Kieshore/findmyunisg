const jwt = require("jsonwebtoken");

function parseEnvList(value) {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function requireAuth(req, res, next) {
  try {
    const token =
      req.cookies?.auth_token ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    req.userId = decoded.userId;
    req.user = decoded;

    return next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired session",
    });
  }
}

function requireAdmin(req, res, next) {
  const adminEmails = parseEnvList(process.env.ADMIN_EMAILS)
    .map(email => email.toLowerCase());
  const adminUserIds = parseEnvList(process.env.ADMIN_USER_IDS);
  const userEmail = String(req.user?.email || "").toLowerCase();
  const userId = String(req.userId || "");

  const isAdmin =
    (userEmail && adminEmails.includes(userEmail)) ||
    (userId && adminUserIds.includes(userId));

  if (!isAdmin) {
    return res.status(403).json({
      message: "Admin access required",
    });
  }

  return next();
}

module.exports = {
  requireAuth,
  requireAdmin,
};
