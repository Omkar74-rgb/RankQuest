const express = require("express");
const router = express.Router();
const { User, Task } = require("../models");
const { requireAuth } = require("../auth");
const { settleUser } = require("../settle");
const { getRankInfo } = require("../tiers");
const { oracleInsight } = require("../ai");
const asyncHandler = require("../asyncHandler");

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    await settleUser(req.user.id);
    const user = await User.findById(req.user.id);
    const rankInfo = getRankInfo(user.points);
    const activeGoals = await Task.countDocuments({ userId: user._id, type: "goal", done: false });
    const activeBucket = await Task.countDocuments({ userId: user._id, type: "bucket", done: false });

    const text = await oracleInsight({
      rank: rankInfo.tier.name,
      points: user.points,
      nextRank: rankInfo.next ? rankInfo.next.name : "max rank",
      toNext: rankInfo.next ? rankInfo.next.min - user.points : 0,
      activeGoals,
      activeBucket,
      streak: user.streak,
    });
    res.json({ text });
  })
);

module.exports = router;
