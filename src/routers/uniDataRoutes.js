const express = require("express");
const router = express.Router();
const gesController = require("../controller/getUniData");
const { requireAuth, requireAdmin } = require("../middleware/authMiddleware");

router.post("/sync", requireAuth, requireAdmin, gesController.syncGESOutcomes);

module.exports = router;
