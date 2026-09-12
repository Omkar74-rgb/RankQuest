// Rank ladder — deliberately steep so climbing feels earned.
const TIERS = [
  { name: "Unranked", min: 0, color: "#8A8A82" },
  { name: "Bronze", min: 150, color: "#A05A2C" },
  { name: "Silver", min: 500, color: "#6B7280" },
  { name: "Gold", min: 1200, color: "#B8860B" },
  { name: "Platinum", min: 2800, color: "#0E7C86" },
  { name: "Diamond", min: 6000, color: "#2A5CAA" },
  { name: "Master", min: 12000, color: "#6B3FA0" },
  { name: "Grandmaster", min: 25000, color: "#9B2C6F" },
  { name: "Legend", min: 50000, color: "#B0201E" },
  { name: "Mythic", min: 100000, color: "#17181C" },
];

function getRankInfo(points) {
  let idx = 0;
  for (let i = 0; i < TIERS.length; i++) if (points >= TIERS[i].min) idx = i;
  const tier = TIERS[idx];
  const next = TIERS[idx + 1] || null;
  const span = next ? next.min - tier.min : 1;
  const progress = next ? Math.min(100, ((points - tier.min) / span) * 100) : 100;
  return { tier, next, progress, idx };
}

// Missed-deadline penalty: random 10%-50% of the task's own point value.
function randomPenalty(points) {
  const pct = 0.1 + Math.random() * 0.4;
  return Math.round(points * pct);
}

module.exports = { TIERS, getRankInfo, randomPenalty };
