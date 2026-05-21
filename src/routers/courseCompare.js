const express = require("express");
const router = express.Router();

const courseCompareController = require("../controller/courseCompareController");

router.get("/", courseCompareController.getComparableCoursesForUser);

module.exports = router;