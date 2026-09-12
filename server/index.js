require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { connectDB } = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", require("./routes/auth"));
app.use("/api/tasks", require("./routes/tasks"));
app.use("/api/oracle", require("./routes/oracle"));
app.use("/api/admin", require("./routes/admin"));
app.get("/api/tiers", (req, res) => res.json(require("./tiers").TIERS));

// Serve the frontend
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
  res.sendFile(path.join(publicDir, "index.html"));
});

// Basic error handler so a thrown/rejected error in a route becomes a clean
// JSON response instead of crashing the process or hanging the request.
app.use((err, req, res, next) => {
  if (err && err.name === "CastError") {
    return res.status(400).json({ error: "Invalid ID" });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server" });
});

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`RankQuest server running on http://localhost:${PORT}`);
      if (!process.env.ANTHROPIC_API_KEY && !process.env.GROK_API_KEY) {
        console.log("Note: no ANTHROPIC_API_KEY or GROK_API_KEY set — AI scoring will use local fallback estimates.");
      } else {
        const provider = (process.env.AI_PROVIDER || (process.env.GROK_API_KEY ? "grok" : "anthropic")).toLowerCase();
        console.log(`Using ${provider === "grok" ? "Grok" : "Claude"} for AI scoring.`);
      }
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
