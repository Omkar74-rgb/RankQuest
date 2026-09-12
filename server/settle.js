const { User, Task } = require("./models");
const { randomPenalty } = require("./tiers");

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function addPoints(userId, amount) {
  await User.updateOne({ _id: userId }, { $inc: { points: amount } });
}

async function deductPoints(userId, amount) {
  const user = await User.findById(userId);
  if (!user) return;
  user.points = Math.max(0, user.points - amount);
  await user.save();
}

// Applies daily-quest day-rollover penalties/resets, streak bookkeeping,
// and manual-deadline penalties for goals/bucket-list items.
// Called at the top of every request that reads or changes a user's tasks/points,
// so the effect is always current without needing a background cron job.
async function settleUser(userId) {
  const today = todayStr();
  const user = await User.findById(userId);
  if (!user) return;

  // --- Daily quests: penalize an unfinished quest from a past day, then reset it ---
  const dailies = await Task.find({ userId, type: "daily" });
  for (const q of dailies) {
    const lastReset = q.lastResetDate || today;
    if (lastReset !== today) {
      if (!q.done) {
        await deductPoints(userId, randomPenalty(q.points));
      }
      q.done = false;
      q.lastResetDate = today;
      await q.save();
    }
  }

  // --- Streak bookkeeping (once per new day) ---
  if (user.lastActiveDate !== today) {
    const streakContinues = user.lastCompletionDate === yesterdayStr();
    user.streak = user.lastCompletionDate ? (streakContinues ? user.streak : 0) : user.streak;
    user.lastActiveDate = today;
    await user.save();
  }

  // --- Goals & bucket-list items: manual deadline penalty (one-time) ---
  const now = new Date();
  const overdue = await Task.find({
    userId,
    type: { $in: ["goal", "bucket"] },
    done: false,
    penaltyApplied: false,
    deadline: { $ne: null, $lt: now },
  });
  for (const t of overdue) {
    await deductPoints(userId, randomPenalty(t.points));
    t.penaltyApplied = true;
    t.missed = true;
    await t.save();
  }
}

module.exports = { settleUser, addPoints, deductPoints, todayStr };
