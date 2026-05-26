const express = require("express");
const router = express.Router();
const gesController = require("../controller/getUniData");
const { requireAuth } = require("../middleware/authMiddleware");

router.post("/sync", requireAuth, gesController.syncGESOutcomes);

module.exports = router;
