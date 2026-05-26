const express = require("express");
const router = express.Router();
const courseRecommendationController = require("../controller/courseRecommendationIGP");
const { requireAuth } = require("../middleware/authMiddleware");

router.use(requireAuth);

router.post("/update-tenth-percentile-rp", courseRecommendationController.updateTenthPercentileRp);
router.get("/eligible-courses", courseRecommendationController.getEligibleCoursesForUser);

module.exports = router;
