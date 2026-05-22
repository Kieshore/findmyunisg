const express = require("express");
const router = express.Router();

const authController = require("../controller/authController");
const { requireAuth } = require("../middleware/authMiddleware");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.get("/me", requireAuth, authController.me);

module.exports = router;