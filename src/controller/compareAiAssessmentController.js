const compareAiAssessmentModel = require("../models/compareAiAssessment");

module.exports.generateCompareAssessment =
  async function generateCompareAssessment(req, res) {
    try {
      const result = await compareAiAssessmentModel.generateCompareAssessment({
        userId: req.userId,
        leftCourse: req.body.leftCourse,
        rightCourse: req.body.rightCourse,
        preferences: req.body.preferences || {},
        forceRefresh: req.body.forceRefresh === true,
      });

      return res.status(200).json({
        message: "AI comparison assessment generated successfully",
        data: result,
      });
    } catch (error) {
      console.error("Error generating AI comparison assessment:", error);

      return res.status(error.statusCode || 500).json({
        message: "Failed to generate AI comparison assessment",
        error: error.message,
        data: error.usage ? { quota: error.usage } : undefined,
      });
    }
  };

module.exports.getUsage = async function getUsage(req, res) {
  try {
    const quota = await compareAiAssessmentModel.getAiAssessmentUsage(req.userId);

    return res.status(200).json({
      message: "AI assessment usage retrieved successfully",
      data: {
        quota,
      },
    });
  } catch (error) {
    console.error("Error retrieving AI assessment usage:", error);

    return res.status(500).json({
      message: "Failed to retrieve AI assessment usage",
      error: error.message,
    });
  }
};

module.exports.getCachedAssessment = async function getCachedAssessment(req, res) {
  try {
    const assessment = await compareAiAssessmentModel.getCachedCompareAssessment({
      userId: req.userId,
      leftCourseId: req.body.leftCourseId,
      rightCourseId: req.body.rightCourseId,
    });

    return res.status(200).json({
      message: assessment
        ? "Cached AI assessment retrieved successfully"
        : "No cached AI assessment found",
      data: {
        assessment,
      },
    });
  } catch (error) {
    console.error("Error retrieving cached AI comparison assessment:", error);

    return res.status(500).json({
      message: "Failed to retrieve cached AI comparison assessment",
      error: error.message,
    });
  }
};
