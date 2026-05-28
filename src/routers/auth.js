const express = require("express");
const router = express.Router();

const authController = require("../controller/authController");
const { requireAuth } = require("../middleware/authMiddleware");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.get("/google", authController.oauthStart);
router.get("/google/callback", authController.oauthCallback);
router.get("/microsoft", authController.oauthStart);
router.get("/microsoft/callback", authController.oauthCallback);
router.get("/outlook", authController.oauthStart);
router.get("/outlook/callback", authController.oauthCallback);
router.get("/me", requireAuth, authController.me);

module.exports = router;
