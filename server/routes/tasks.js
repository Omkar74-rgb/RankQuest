const express = require("express");
const router = express.Router();
const { Task, User } = require("../models");
const { requireAuth } = require("../auth");
const { settleUser, addPoints } = require("../settle");
const { getRankInfo } = require("../tiers");
const { scoreTask, generateChain } = require("../ai");
const asyncHandler = require("../asyncHandler");

router.use(requireAuth);

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function serializeTask(t) {
  return {
    id: t._id,
    type: t.type,
    title: t.title,
    points: t.points,
    reasoning: t.reasoning,
    category: t.category,
    done: t.done,
    deadline: t.deadline,
    missed: t.missed,
    chain: t.chain && t.chain.length ? t.chain.map((m) => ({ id: m.id, title: m.title, points: m.points, done: m.done })) : null,
    bonus: t.bonus,
    completedAt: t.completedAt,
    timesCompleted: t.timesCompleted,
    createdAt: t.createdAt,
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    await settleUser(req.user.id);
    const rows = await Task.find({ userId: req.user.id }).sort({ createdAt: 1 });
    res.json(rows.map(serializeTask));
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { type, title, deadline } = req.body || {};
    if (!["daily", "goal", "bucket"].includes(type)) {
      return res.status(400).json({ error: "type must be 'daily', 'goal', or 'bucket'" });
    }
    if (!title || !title.trim()) return res.status(400).json({ error: "Title is required" });
    if (title.trim().length > 200) return res.status(400).json({ error: "Title is too long" });
    if (type !== "daily") {
      if (!deadline) return res.status(400).json({ error: "Goals and bucket-list items need a deadline" });
      if (isNaN(new Date(deadline).getTime())) return res.status(400).json({ error: "Invalid deadline" });
    }

    const scored = await scoreTask(title.trim(), type);
    const today = new Date().toISOString().slice(0, 10);

    const task = await Task.create({
      userId: req.user.id,
      type,
      title: title.trim(),
      points: scored.points,
      reasoning: scored.reasoning || null,
      category: scored.category || null,
      deadline: type === "daily" ? null : new Date(deadline),
      lastResetDate: type === "daily" ? today : null,
    });

    res.json(serializeTask(task));
  })
);

router.post(
  "/:id/complete",
  asyncHandler(async (req, res) => {
    await settleUser(req.user.id);
    const task = await Task.findOne({ _id: req.params.id, userId: req.user.id });
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (task.done) return res.status(400).json({ error: "Already completed" });

    if (task.type === "bucket" && task.chain && task.chain.length) {
      if (!task.chain.every((m) => m.done)) return res.status(400).json({ error: "Finish all milestones first" });
      await addPoints(req.user.id, task.bonus);
    } else {
      await addPoints(req.user.id, task.points);
    }

    task.done = true;
    task.completedAt = new Date();
    task.timesCompleted = (task.timesCompleted || 0) + 1;
    await task.save();

    if (task.type === "daily") {
      const today = new Date().toISOString().slice(0, 10);
      const user = await User.findById(req.user.id);
      user.streak = user.lastCompletionDate === today ? user.streak : user.streak + 1;
      user.lastCompletionDate = today;
      await user.save();
    }

    const user = await User.findById(req.user.id);
    res.json({
      task: serializeTask(task),
      points: user.points,
      rank: getRankInfo(user.points).tier.name,
    });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await Task.deleteOne({ _id: req.params.id, userId: req.user.id });
    if (!result.deletedCount) return res.status(404).json({ error: "Task not found" });
    res.json({ ok: true });
  })
);

router.post(
  "/:id/chain",
  asyncHandler(async (req, res) => {
    const task = await Task.findOne({ _id: req.params.id, userId: req.user.id });
    if (!task || task.type !== "bucket") return res.status(404).json({ error: "Bucket-list item not found" });
    if (task.chain && task.chain.length) return res.status(400).json({ error: "Chain already generated" });

    const { milestones, bonus } = await generateChain(task.title, task.points);
    task.chain = milestones.map((m) => ({ id: uid(), title: m.title, points: m.points, done: false }));
    task.bonus = bonus;
    await task.save();
    res.json(serializeTask(task));
  })
);

router.post(
  "/:id/chain/:milestoneId/complete",
  asyncHandler(async (req, res) => {
    const task = await Task.findOne({ _id: req.params.id, userId: req.user.id });
    if (!task || !task.chain || !task.chain.length) return res.status(404).json({ error: "Not found" });
    const m = task.chain.find((x) => x.id === req.params.milestoneId);
    if (!m || m.done) return res.status(400).json({ error: "Milestone not found or already done" });
    m.done = true;
    task.markModified("chain");
    await task.save();
    await addPoints(req.user.id, m.points);
    const user = await User.findById(req.user.id);
    res.json({
      task: serializeTask(task),
      points: user.points,
    });
  })
);

module.exports = router;
