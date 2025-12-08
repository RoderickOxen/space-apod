const express = require("express");
const fetch = require("node-fetch"); // v2

const app = express();
const PORT = process.env.PORT || 8787;

// Put your own key here or export NASA_API_KEY in the shell
const NASA_API_KEY = process.env.NASA_API_KEY || "DEMO_KEY";

// Serve static files (your website) from ./public
app.use(express.static("public"));

/**
 * Helper to call NASA APOD.
 * If `date` is provided, it must be "YYYY-MM-DD".
 * If `date` is undefined, NASA returns today's APOD.
 *
 * For images:
 *   {
 *     date, title, explanation, mediaType: "image",
 *     imageUrl, hdImageUrl, gifUrl?, copyright, source
 *   }
 *
 * For videos:
 *   {
 *     date, title, explanation, mediaType: "video",
 *     mediaUrl, copyright, source
 *   }
 */
async function fetchApod(date) {
  const params = new URLSearchParams({ api_key: NASA_API_KEY });

  if (date) {
    params.set("date", date); // YYYY-MM-DD
  }

  const url = `https://api.nasa.gov/planetary/apod?${params.toString()}`;

  const res = await fetch(url);
  const text = await res.text();

  if (!res.ok) {
    const err = new Error(
      `NASA APOD error: ${res.status} ${text.slice(0, 200)}`
    );
    err.statusCode = res.status;
    throw err;
  }

  const data = JSON.parse(text);
  const mediaType = data.media_type || "image";

  const base = {
    date: data.date,
    title: data.title,
    explanation: data.explanation,
    copyright: data.copyright || null,
    mediaType, // "image" or "video"
    source: "nasa-apod"
  };

  if (mediaType === "image") {
    // Prefer HD image, but avoid GIFs as background
    let hdUrl = data.hdurl || data.url;
    let gifUrl = null;

    if (hdUrl && hdUrl.toLowerCase().endsWith(".gif")) {
      // Keep gif separately, but don't use it as background image
      gifUrl = hdUrl;
      hdUrl = data.url;
    }

    return {
      ...base,
      imageUrl: data.url,
      hdImageUrl: hdUrl,
      gifUrl
    };
  }

  // For video or any other unexpected type, return the URL as mediaUrl.
  return {
    ...base,
    mediaUrl: data.url
  };
}

// --- Endpoints ---

// Picture of the day (today)
app.get("/space/apod/today", async (req, res) => {
  try {
    const apod = await fetchApod(); // no date = today
    res.json(apod);
  } catch (err) {
    console.error("Error in /space/apod/today:", err.message);
    res.status(502).json({ error: "Failed to fetch APOD for today" });
  }
});

// Picture for a specific date ?date=YYYY-MM-DD
app.get("/space/apod/date", async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({
      error: "Missing required query parameter 'date' (YYYY-MM-DD)"
    });
  }

  try {
    const apod = await fetchApod(date);
    res.json(apod);
  } catch (err) {
    console.error("Error in /space/apod/date:", err.message);

    // NASA returns 400 for invalid/out-of-range dates
    if (err.statusCode === 400) {
      return res.status(400).json({
        error:
          "No APOD available for this date. APOD images start at 1995-06-16."
      });
    }

    res.status(502).json({ error: "Failed to fetch APOD for given date" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log("   - Website:             http://localhost:%d/", PORT);
  console.log(
    "   - APOD today:          http://localhost:%d/space/apod/today",
    PORT
  );
  console.log(
    "   - APOD for a date:     http://localhost:%d/space/apod/date?date=2020-07-14",
    PORT
  );
});
