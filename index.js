// index.js
const express = require("express");
const fetch = require("node-fetch"); // v2

const app = express();
const PORT = process.env.PORT || 8080;

// ======================================================
// 1) NASA API KEY
// ======================================================
const NASA_API_KEY = process.env.NASA_API_KEY || "DEMO_KEY";

if (NASA_API_KEY === "DEMO_KEY") {
  console.warn(
    "[APOD] WARNING: Using DEMO_KEY. You will hit rate limits very quickly."
  );
} else {
  console.log("[APOD] Using NASA_API_KEY from environment (looks good ✅)");
}

// ======================================================
// 2) Static files (front-end)
// ======================================================
app.use(express.static("public"));

// ======================================================
// 3) Simple in-memory cache for APOD
//    - key: "today" or "YYYY-MM-DD"
//    - value: { data, fetchedAt }
// ======================================================
const apodCache = new Map();
// Change TTL here if quiseres (ms)
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

async function fetchApod(date) {
  if (!NASA_API_KEY) {
    throw new Error("NASA_API_KEY is not set");
  }

  const cacheKey = date || "today";
  const now = Date.now();

  // Try cache first
  const cached = apodCache.get(cacheKey);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    console.log("[APOD] Returning cached result for", cacheKey);
    return cached.data;
  }

  const params = new URLSearchParams({ api_key: NASA_API_KEY });
  if (date) {
    params.set("date", date); // YYYY-MM-DD
  }

  const url = `https://api.nasa.gov/planetary/apod?${params.toString()}`;
  console.log("[APOD] Calling NASA for", cacheKey);

  const res = await fetch(url);
  const text = await res.text();

  if (!res.ok) {
    console.error("[APOD] NASA error:", res.status, text);
    // Repassa o erro como JSON para o caller
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text };
    }
    const err = new Error("NASA APOD error");
    err.status = res.status;
    err.payload = payload;
    throw err;
  }

  const json = JSON.parse(text);
  apodCache.set(cacheKey, { data: json, fetchedAt: now });
  return json;
}

// ======================================================
// 4) API endpoints
// ======================================================

// GET /space/apod/today
app.get("/space/apod/today", async (req, res) => {
  try {
    const apod = await fetchApod();
    res.json(apod);
  } catch (err) {
    console.error("[APOD] /today failed:", err);
    res
      .status(err.status || 500)
      .json(err.payload || { error: "Internal server error" });
  }
});

// GET /space/apod/date?date=YYYY-MM-DD
app.get("/space/apod/date", async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: "Missing 'date' query parameter" });
  }

  // Very basic validation (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res
      .status(400)
      .json({ error: "Invalid date format. Use YYYY-MM-DD." });
  }

  try {
    const apod = await fetchApod(date);
    res.json(apod);
  } catch (err) {
    console.error("[APOD] /date failed:", err);
    res
      .status(err.status || 500)
      .json(err.payload || { error: "Internal server error" });
  }
});

// Health check (Cloud Run friendly)
app.get("/healthz", (req, res) => {
  res.json({ status: "ok" });
});

// DEBUG endpoint – usa só para testes, remove depois se quiseres
app.get("/debug/apod-key", (req, res) => {
  const key = NASA_API_KEY || "DEMO_KEY";
  const isDemo = key === "DEMO_KEY";

  res.json({
    usingDemoKey: isDemo,
    source: isDemo ? "fallback DEMO_KEY" : "env var NASA_API_KEY",
    keyPreview: isDemo ? "DEMO_KEY" : key.slice(0, 4) + "***",
  });
});

// ======================================================
// 5) Start server
// ======================================================
app.listen(PORT, () => {
  console.log(`🚀 APOD server listening on port ${PORT}`);
});
