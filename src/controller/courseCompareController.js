const courseCompareModel = require("../models/courseCompare");

module.exports.getComparableCoursesForUser =
  async function getComparableCoursesForUser(req, res) {
    try {
      const result = await courseCompareModel.getComparableCoursesForUser({
        ...req.query,
        userId: req.userId,
      });

      return res.status(200).json({
        message: "Comparable courses retrieved successfully",
        data: result,
      });
    } catch (error) {
      console.error("Error retrieving comparable courses:", error);

      return res.status(500).json({
        message: "Failed to retrieve comparable courses",
        error: error.message,
      });
    }
  };
