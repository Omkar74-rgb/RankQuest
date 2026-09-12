const mongoose = require("mongoose");

const MilestoneSchema = new mongoose.Schema(
  {
    id: String,
    title: String,
    points: Number,
    done: { type: Boolean, default: false },
  },
  { _id: false }
);

const TaskSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["daily", "goal", "bucket"], required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    points: { type: Number, required: true },
    reasoning: String,
    category: String,
    done: { type: Boolean, default: false },
    deadline: { type: Date, default: null }, // goals/bucket only (manual)
    lastResetDate: { type: String, default: null }, // daily only: "YYYY-MM-DD"
    penaltyApplied: { type: Boolean, default: false },
    missed: { type: Boolean, default: false },
    chain: { type: [MilestoneSchema], default: [] }, // bucket-list AI quest chains
    bonus: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
    timesCompleted: { type: Number, default: 0 }, // lifetime completions (daily quests repeat)
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, maxlength: 60 },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    points: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    lastActiveDate: { type: String, default: null },
    lastCompletionDate: { type: String, default: null },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

const User = mongoose.model("User", UserSchema);
const Task = mongoose.model("Task", TaskSchema);

module.exports = { User, Task };
