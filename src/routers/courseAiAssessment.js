const express = require("express");
const router = express.Router();

const compareAiAssessmentController = require("../controller/compareAiAssessmentController");
const { requireAuth } = require("../middleware/authMiddleware");

router.use(requireAuth);

router.get("/usage", compareAiAssessmentController.getUsage);
router.post("/", compareAiAssessmentController.generateCompareAssessment);

module.exports = router;
