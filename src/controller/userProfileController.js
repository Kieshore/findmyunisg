const userProfileModel = require("../models/userProfile");
const authModel = require("../models/auth");

module.exports.getUserProfile = async function getUserProfile(req, res) {
  try {
    const result = await userProfileModel.getUserProfile(req.userId);

    if (!result) {
      return res.status(404).json({ message: "User profile not found" });
    }

    return res.status(200).json({
      message: "User profile retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error retrieving user profile:", error);

    return res.status(500).json({
      message: "Failed to retrieve user profile",
      error: error.message,
    });
  }
};

module.exports.getMyAcademicProfile = async function getMyAcademicProfile(req, res) {
  try {
    const profile = await userProfileModel.getMyAcademicProfile(req.userId);

    return res.status(200).json({
      message: "Academic profile retrieved successfully",
      data: profile,
    });
  } catch (error) {
    console.error("Error retrieving academic profile:", error);

    return res.status(500).json({
      message: "Failed to retrieve academic profile",
      error: error.message,
    });
  }
};

module.exports.updateMyProfile = async function updateMyProfile(req, res) {
  try {
    const profile = await userProfileModel.updateMyProfile(req.userId, req.body);

    return res.status(200).json({
      message: "Profile saved successfully",
      data: profile,
    });
  } catch (error) {
    console.error("Error saving profile:", error);

    return res.status(400).json({
      message: error.message || "Failed to save profile",
      error: error.message,
    });
  }
};

module.exports.saveMyAcademicProfile = async function saveMyAcademicProfile(req, res) {
  try {
    const profile = await userProfileModel.saveMyAcademicProfile(
      req.userId,
      req.body
    );

    return res.status(200).json({
      message: "Academic profile saved successfully",
      data: profile,
    });
  } catch (error) {
    console.error("Error saving academic profile:", error);

    return res.status(400).json({
      message: error.message || "Failed to save academic profile",
      error: error.message,
    });
  }
};

module.exports.deleteMyAccount = async function deleteMyAccount(req, res) {
  try {
    await userProfileModel.deleteMyAccount(req.userId);

    res.clearCookie("auth_token", {
      httpOnly: true,
      sameSite: "lax",
      secure: authModel.COOKIE_OPTIONS.secure,
    });

    return res.status(200).json({
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting account:", error);

    return res.status(400).json({
      message: error.message || "Failed to delete account",
      error: error.message,
    });
  }
};
