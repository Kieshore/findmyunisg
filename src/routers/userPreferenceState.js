const express = require("express");
const router = express.Router();

const userPreferenceStateController = require("../controller/userPreferenceStateController");
const { requireAuth } = require("../middleware/authMiddleware");

router.get("/interests", requireAuth, userPreferenceStateController.getInterestPreference);
router.put("/interests", requireAuth, userPreferenceStateController.updateInterestPreference);

router.get("/course-finder", requireAuth, userPreferenceStateController.getFinderPreference);
router.put("/course-finder", requireAuth, userPreferenceStateController.updateFinderPreference);

module.exports = router;