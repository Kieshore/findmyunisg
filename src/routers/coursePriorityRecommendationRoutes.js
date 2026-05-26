const express = require("express");
const router = express.Router();
const coursePriorityRecommendationController = require("../controller/coursePriorityRecommendationController");
const { requireAuth } = require("../middleware/authMiddleware");

router.get(
  "/eligible-ranked-courses",
  requireAuth,
  coursePriorityRecommendationController.getRankedEligibleCoursesForUser
);

module.exports = router;
