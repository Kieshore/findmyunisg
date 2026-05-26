const authModel = require("../models/auth");

module.exports.register = async function register(req, res) {
  try {
    const user = await authModel.registerUser(req.body);
    const token = authModel.createToken(user);

    res.cookie("auth_token", token, authModel.COOKIE_OPTIONS);

    return res.status(201).json({
      message: "Registered successfully",
      user: authModel.sanitizeUser(user),
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message || "Registration failed",
    });
  }
};

module.exports.login = async function login(req, res) {
  try {
    const user = await authModel.loginUser(req.body);
    const token = authModel.createToken(user);

    res.cookie("auth_token", token, authModel.COOKIE_OPTIONS);

    return res.status(200).json({
      message: "Logged in successfully",
      user: authModel.sanitizeUser(user),
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      message: error.message || "Login failed",
      data: error.lockedUntil
        ? {
            lockedUntil: error.lockedUntil,
            remainingAttempts: error.remainingAttempts,
            maxAttempts: error.maxAttempts,
          }
        : error.remainingAttempts !== undefined
          ? {
              remainingAttempts: error.remainingAttempts,
              maxAttempts: error.maxAttempts,
            }
          : undefined,
    });
  }
};

module.exports.logout = async function logout(req, res) {
  res.clearCookie("auth_token", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
  });

  return res.status(200).json({
    message: "Logged out successfully",
  });
};

module.exports.me = async function me(req, res) {
  try {
    const user = await authModel.getCurrentUser(req.userId);

    return res.status(200).json({
      message: "Current user retrieved successfully",
      user,
    });
  } catch (error) {
    console.error("Error fetching current user:", error);

    return res.status(401).json({
      message: "Invalid session",
      error: error.message,
    });
  }
};
