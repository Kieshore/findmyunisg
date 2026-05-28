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

function getOAuthProviderFromRequest(req) {
  const provider =
    req.params.provider ||
    req.path.split("/").filter(Boolean)[0];

  return provider === "outlook" ? "microsoft" : provider;
}

function redirectOAuthError(res, message) {
  return res.redirect(`/login.html?authError=${encodeURIComponent(message)}`);
}

module.exports.oauthStart = async function oauthStart(req, res) {
  try {
    const provider = getOAuthProviderFromRequest(req);
    const result = authModel.createOAuthAuthorization(provider, req);

    res.cookie(
      authModel.OAUTH_STATE_COOKIE,
      result.state,
      authModel.OAUTH_COOKIE_OPTIONS
    );

    return res.redirect(result.url);
  } catch (error) {
    console.error("Error starting OAuth login:", error);
    return redirectOAuthError(res, error.message || "Unable to start OAuth login");
  }
};

module.exports.oauthCallback = async function oauthCallback(req, res) {
  try {
    if (req.query.error) {
      return redirectOAuthError(
        res,
        req.query.error_description || "OAuth login was cancelled or denied"
      );
    }

    const provider = getOAuthProviderFromRequest(req);
    const user = await authModel.completeOAuthLogin({
      provider,
      code: req.query.code,
      state: req.query.state,
      cookieState: req.cookies?.[authModel.OAUTH_STATE_COOKIE],
      req,
    });
    const token = authModel.createToken(user);

    res.clearCookie(authModel.OAUTH_STATE_COOKIE, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    res.cookie("auth_token", token, authModel.COOKIE_OPTIONS);

    return res.redirect("/course-finder.html");
  } catch (error) {
    console.error("Error completing OAuth login:", error);
    res.clearCookie(authModel.OAUTH_STATE_COOKIE, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return redirectOAuthError(res, error.message || "OAuth login failed");
  }
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
