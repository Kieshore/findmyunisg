const express = require("express");
const router = express.Router();

const compareAiAssessmentController = require("../controller/compareAiAssessmentController");

router.post("/", compareAiAssessmentController.generateCompareAssessment);

module.exports = router;