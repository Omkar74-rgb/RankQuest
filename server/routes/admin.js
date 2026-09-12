const express = require("express");
const router = express.Router();
const { User, Task } = require("../models");
const { requireAuth, requireAdmin } = require("../auth");
const { getRankInfo } = require("../tiers");
const asyncHandler = require("../asyncHandler");

router.use(requireAuth, requireAdmin);

router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const users = await User.find({}).sort({ points: -1 });

    const result = await Promise.all(
      users.map(async (u) => {
        const counts = await Task.aggregate([
          { $match: { userId: u._id } },
          { $group: { _id: "$type", total: { $sum: 1 }, done: { $sum: { $cond: ["$done", 1, 0] } } } },
        ]);
        return {
          id: u._id,
          username: u.username,
          role: u.role,
          points: u.points,
          streak: u.streak,
          createdAt: u.createdAt,
          rank: getRankInfo(u.points).tier.name,
          taskCounts: counts.map((c) => ({ type: c._id, total: c.total, done: c.done })),
        };
      })
    );

    res.json(result);
  })
);

router.get(
  "/users/:id/tasks",
  asyncHandler(async (req, res) => {
    const rows = await Task.find({ userId: req.params.id }).sort({ createdAt: -1 });
    res.json(
      rows.map((row) => ({
        id: row._id,
        type: row.type,
        title: row.title,
        points: row.points,
        done: row.done,
        deadline: row.deadline,
        missed: row.missed,
        createdAt: row.createdAt,
      }))
    );
  })
);

module.exports = router;
