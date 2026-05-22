const userPreferenceStateModel = require("../models/userPreferenceState");

module.exports.getInterestPreference = async function getInterestPreference(req, res) {
  try {
    const result = await userPreferenceStateModel.getInterestPreference(req.userId);

    return res.status(200).json({
      message: "Interest preference retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error retrieving interest preference:", error);

    return res.status(500).json({
      message: "Failed to retrieve interest preference",
      error: error.message,
    });
  }
};

module.exports.updateInterestPreference = async function updateInterestPreference(req, res) {
  try {
    const result = await userPreferenceStateModel.upsertInterestPreference(
      req.userId,
      req.body
    );

    return res.status(200).json({
      message: "Interest preference saved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error saving interest preference:", error);

    return res.status(500).json({
      message: "Failed to save interest preference",
      error: error.message,
    });
  }
};

module.exports.getFinderPreference = async function getFinderPreference(req, res) {
  try {
    const result = await userPreferenceStateModel.getFinderPreference(req.userId);

    return res.status(200).json({
      message: "Course finder preference retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error retrieving course finder preference:", error);

    return res.status(500).json({
      message: "Failed to retrieve course finder preference",
      error: error.message,
    });
  }
};

module.exports.updateFinderPreference = async function updateFinderPreference(req, res) {
  try {
    const result = await userPreferenceStateModel.upsertFinderPreference(
      req.userId,
      req.body
    );

    return res.status(200).json({
      message: "Course finder preference saved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error saving course finder preference:", error);

    return res.status(500).json({
      message: "Failed to save course finder preference",
      error: error.message,
    });
  }
};