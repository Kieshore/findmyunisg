const express = require("express");
const router = express.Router();
const admissionsScoreUpdateController = require("../controller/courseAdmissionScoreUpdate70rp");
const { requireAuth, requireAdmin } = require("../middleware/authMiddleware");

router.post("/", requireAuth, requireAdmin, admissionsScoreUpdateController.updateAdmissionsScoresFromGrades);

module.exports = router;
