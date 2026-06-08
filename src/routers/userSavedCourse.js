const express = require("express");
const router = express.Router();

const userSavedCourseController = require("../controller/userSavedCourseController");
const { requireAuth } = require("../middleware/authMiddleware");

router.get("/", requireAuth, userSavedCourseController.listSavedCourses);
router.post("/:courseId", requireAuth, userSavedCourseController.saveCourse);
router.delete("/:courseId", requireAuth, userSavedCourseController.removeCourse);

module.exports = router;
