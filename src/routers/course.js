const express = require("express");
const router = express.Router();

const courseController = require("../controller/courseController");
const { requireAuth } = require("../middleware/authMiddleware");

router.get("/", requireAuth, courseController.getAllCourses);

module.exports = router;
