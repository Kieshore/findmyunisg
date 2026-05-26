const userProfileModel = require("../models/userProfile");

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
