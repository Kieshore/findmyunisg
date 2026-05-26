const express = require("express");
const router = express.Router();
const interestGroupController = require("../controller/interestGroupController");
const { requireAuth } = require("../middleware/authMiddleware");

router.get("/", requireAuth, interestGroupController.getAllInterestGroups);

module.exports = router;
