const express = require("express");
const router = express.Router();

const courseCompareController = require("../controller/courseCompareController");
const { requireAuth } = require("../middleware/authMiddleware");

router.get("/", requireAuth, courseCompareController.getComparableCoursesForUser);

module.exports = router;
