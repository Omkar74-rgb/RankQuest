const express = require("express");
const router = express.Router();
const { User } = require("../models");
const { generateToken, requireAuth } = require("../auth");
const { settleUser } = require("../settle");
const { getRankInfo } = require("../tiers");
const asyncHandler = require("../asyncHandler");

// Uncomment to enable password hashing (see notes below):
// const bcrypt = require("bcryptjs");

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !username.trim() || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    const clean = username.trim();
    const existing = await User.findOne({ username: clean });
    if (existing) return res.status(409).json({ error: "Username already taken" });

    // Storing the password as plain text, as requested — NOT recommended for real production use.
    const passwordToStore = password;

    // --- To store passwords securely instead, uncomment the two lines below ---
    // (also uncomment `const bcrypt = require("bcryptjs");` near the top of this file)
    // and then change `passwordToStore` just above to `hashedPassword`:
    //
    // const hashedPassword = bcrypt.hashSync(password, 10);

    // First person to ever register becomes the admin, so there's an admin
    // account without touching the database by hand. Everyone after is a normal user.
    const isFirstUser = (await User.countDocuments({})) === 0;
    const role = isFirstUser ? "admin" : "user";

    const user = await User.create({ username: clean, password: passwordToStore, role });

    const token = generateToken({ id: user._id.toString(), username: user.username, role: user.role });
    res.json({ token, user: { id: user._id, username: user.username, role: user.role, points: user.points } });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "Username and password are required" });

    const user = await User.findOne({ username: username.trim() });
    if (!user) return res.status(401).json({ error: "Invalid username or password" });

    // Plain-text comparison, as requested — NOT recommended for real production use.
    const passwordMatches = password === user.password;

    // --- To verify a hashed password instead, uncomment the line below ---
    // (also uncomment `const bcrypt = require("bcryptjs");` near the top of this file)
    // and then change `passwordMatches` just above to `hashedMatches`:
    //
    // const hashedMatches = bcrypt.compareSync(password, user.password);

    if (!passwordMatches) return res.status(401).json({ error: "Invalid username or password" });

    const token = generateToken({ id: user._id.toString(), username: user.username, role: user.role });
    res.json({ token, user: { id: user._id, username: user.username, role: user.role, points: user.points } });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    await settleUser(req.user.id);
    const user = await User.findById(req.user.id).select("username role points streak");
    if (!user) return res.status(404).json({ error: "User not found" });
    const rankInfo = getRankInfo(user.points);
    res.json({
      id: user._id,
      username: user.username,
      role: user.role,
      points: user.points,
      streak: user.streak,
      rank: rankInfo.tier,
      next: rankInfo.next,
      progress: rankInfo.progress,
    });
  })
);

module.exports = router;
