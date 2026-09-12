const CLAUDE_MODEL = "claude-sonnet-5";
const GROK_MODEL = process.env.GROK_MODEL || "grok-4.3"; // xAI — see https://docs.x.ai/developers/models
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile"; // Groq — see https://console.groq.com/docs/models

// Picks a provider based on what's configured. Set AI_PROVIDER=grok, groq,
// or anthropic explicitly to force one; otherwise it auto-picks Groq if
// GROQ_API_KEY is set, else Grok if GROK_API_KEY is set, else Anthropic.
// Note: Groq (groq.com, keys start "gsk_") and Grok/xAI (x.ai, keys start
// "xai-") are different companies — easy to mix up, so this keeps them separate.
function activeProvider() {
  const explicit = (process.env.AI_PROVIDER || "").toLowerCase();
  if (["grok", "groq", "anthropic"].includes(explicit)) return explicit;
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.GROK_API_KEY) return "grok";
  return "anthropic";
}

async function callAI(system, prompt, maxTokens = 500) {
  const provider = activeProvider();
  if (provider === "groq") return callGroq(system, prompt, maxTokens);
  if (provider === "grok") return callGrok(system, prompt, maxTokens);
  return callClaude(system, prompt, maxTokens);
}

async function callGroq(system, prompt, maxTokens = 500) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!resp.ok) throw new Error(`Groq API responded with ${resp.status}`);
  const data = await resp.json();
  const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!text) throw new Error("Empty AI response");
  return text;
}

async function callClaude(system, prompt, maxTokens = 500) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) throw new Error(`Anthropic API responded with ${resp.status}`);
  const data = await resp.json();
  const block = (data.content || []).find((b) => b.type === "text");
  if (!block) throw new Error("Empty AI response");
  return block.text;
}

// xAI's Grok API uses an OpenAI-compatible chat-completions format —
// different endpoint and response shape than Anthropic's, so it needs its
// own request/response handling rather than just swapping a URL.
async function callGrok(system, prompt, maxTokens = 500) {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) throw new Error("GROK_API_KEY is not set");

  const resp = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROK_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!resp.ok) throw new Error(`xAI API responded with ${resp.status}`);
  const data = await resp.json();
  const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!text) throw new Error("Empty AI response");
  return text;
}

function parseJSON(text) {
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

function fallbackPoints(title, type) {
  const t = title.toLowerCase();
  let base = type === "daily" ? 15 : type === "goal" ? 300 : 3000;
  const big = ["trip", "travel", "japan", "world", "marathon", "startup", "business", "house", "property", "degree", "wedding", "skydiv", "abroad"];
  const med = ["learn", "certification", "course", "fitness", "weight", "save", "book", "language", "instrument", "bike", "motorcycle"];
  if (big.some((w) => t.includes(w))) base *= 2.5;
  else if (med.some((w) => t.includes(w))) base *= 1.3;
  base += Math.min(t.length * 4, 250);
  return Math.round(base / 10) * 10;
}

const SCORING_SYSTEM = `You are the scoring engine for a gamified goals app. You assign a point value to a single user-submitted task based on its effort, cost, time investment, rarity, and life-impact. Respond with ONLY valid JSON and nothing else: {"points": <integer>, "reasoning": "<one short sentence, under 16 words>", "category": "<one or two word tag>"}.

Scoring bands by task type:
- "daily": a small recurring habit (e.g. "drink 2L water", "read 20 pages"). Range 5-60.
- "goal": a medium-term personal goal (e.g. "learn guitar", "save $1000", "run a 10k"). Range 100-3000, scaled by effort/cost/time.
- "bucket": a major bucket-list / life-milestone item (e.g. "trip to Japan", "buy a house", "run a marathon", "write a book"). Range 800-15000. A cheap, common item like "buy a bike" sits low (800-1800). A major trip, degree, or life milestone like "trip to Japan" sits high (5000-15000).

Be decisive. Do not hedge or explain outside the JSON.`;

const CHAIN_SYSTEM = `You break a major goal into a milestone quest chain for a gamified app. Respond with ONLY valid JSON: {"milestones": [{"title": "<short actionable step, under 10 words>", "points": <integer>}]}. Produce 4 to 6 milestones, ordered logically from first to last. Their points should sum to roughly 60-70% of the total goal points given — the remainder is held back as a completion bonus. Do not include any text outside the JSON.`;

const ORACLE_SYSTEM = `You are "The Oracle" — a witty, faintly mystical mentor living inside a gamified goals app. Given a user's current stats, respond with ONE short paragraph (3-4 sentences, plain text, no markdown, no lists) of sharp, specific motivation or strategy. Be vivid and a little playful, never generic corporate encouragement.`;

async function scoreTask(title, type) {
  try {
    const raw = await callAI(SCORING_SYSTEM, `Type: "${type}"\nTask title: "${title}"\nAssign a point value.`);
    const parsed = parseJSON(raw);
    if (typeof parsed.points === "number") return parsed;
    throw new Error("Unexpected response shape");
  } catch (e) {
    return { points: fallbackPoints(title, type), reasoning: "Estimated locally (AI unavailable).", category: "General" };
  }
}

async function generateChain(title, totalPoints) {
  try {
    const raw = await callAI(
      CHAIN_SYSTEM,
      `Goal: "${title}"\nTotal point value: ${totalPoints}\nBreak this into a milestone quest chain.`,
      700
    );
    const parsed = parseJSON(raw);
    const milestones = (parsed.milestones || []).map((m) => ({ title: m.title, points: m.points }));
    if (!milestones.length) throw new Error("Empty chain");
    const used = milestones.reduce((a, m) => a + m.points, 0);
    return { milestones, bonus: Math.max(totalPoints - used, 0) };
  } catch (e) {
    const used = Math.round(totalPoints * 0.65);
    const step = Math.round(used / 4 / 10) * 10;
    const milestones = [
      { title: "Research what it actually takes", points: step },
      { title: "Set a budget and timeline", points: step },
      { title: "Make the first concrete move", points: step },
      { title: "Follow through to completion", points: step },
    ];
    return { milestones, bonus: totalPoints - step * 4 };
  }
}

async function oracleInsight(stats) {
  try {
    const raw = await callAI(
      ORACLE_SYSTEM,
      `Rank: ${stats.rank}\nTotal points: ${stats.points}\nPoints to next rank (${stats.nextRank}): ${stats.toNext}\nActive personal goals: ${stats.activeGoals}\nActive bucket-list items: ${stats.activeBucket}\nCurrent daily streak: ${stats.streak} days`,
      300
    );
    return raw.trim();
  } catch (e) {
    return "The Oracle is silent right now — set an ANTHROPIC_API_KEY or GROK_API_KEY on the server to hear its voice.";
  }
}

module.exports = { scoreTask, generateChain, oracleInsight };
