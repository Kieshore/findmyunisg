const compareAiAssessmentModel = require("../models/compareAiAssessment");

module.exports.generateCompareAssessment =
  async function generateCompareAssessment(req, res) {
    try {
      const result = await compareAiAssessmentModel.generateCompareAssessment({
        userId: req.body.userId,
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

      return res.status(500).json({
        message: "Failed to generate AI comparison assessment",
        error: error.message,
      });
    }
  };