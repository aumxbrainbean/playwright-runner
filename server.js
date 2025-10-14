const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("✅ Playwright Runner is live!");
});

// Optional GET info route
app.get("/status", (req, res) => {
  res.json({
    status: "ok",
    version: "1.56.0",
    timestamp: new Date().toISOString()
  });
});

// Main POST route for running Playwright tests
app.post("/run-test", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res
        .status(400)
        .json({ success: false, error: "Missing 'url' in request body" });
    }

    // Launch browser safely for cloud environments
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    const title = await page.title();
    const screenshot = await page.screenshot({ encoding: "base64" });

    await browser.close();

    res.json({
      success: true,
      title,
      screenshot: `data:image/png;base64,${screenshot}`,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Render provides PORT automatically (e.g., 10000)
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
