const express = require("express");
const router = express.Router();
const courseRecommendationController = require("../controller/courseRecommendationIGP");
const { requireAuth, requireAdmin } = require("../middleware/authMiddleware");

router.use(requireAuth);

router.post("/update-tenth-percentile-rp", requireAdmin, courseRecommendationController.updateTenthPercentileRp);
router.get("/eligible-courses", courseRecommendationController.getEligibleCoursesForUser);

module.exports = router;
