const express = require("express");
const router = express.Router();

const userProfileController = require("../controller/userProfileController");
const { requireAuth } = require("../middleware/authMiddleware");

router.get("/me/academic-profile", requireAuth, userProfileController.getMyAcademicProfile);
router.post("/me/academic-profile", requireAuth, userProfileController.saveMyAcademicProfile);
router.put("/me/academic-profile", requireAuth, userProfileController.saveMyAcademicProfile);

router.get("/:userId/profile", userProfileController.getUserProfile);

module.exports = router;