const express = require("express");
const router = express.Router();
const admissionsScoreUpdateController = require("../controller/courseAdmissionScoreUpdate70rp");
const { requireAuth } = require("../middleware/authMiddleware");

router.post("/", requireAuth, admissionsScoreUpdateController.updateAdmissionsScoresFromGrades);

module.exports = router;
