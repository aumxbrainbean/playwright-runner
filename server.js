const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json());

app.get("/", (req, res) => res.send("✅ Playwright Runner is live!"));

app.post("/run-test", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "Missing 'url' in request body" });

    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(url);

    const title = await page.title();
    const screenshot = await page.screenshot({ encoding: "base64" });

    await browser.close();

    res.json({
      success: true,
      title,
      screenshot: `data:image/png;base64,${screenshot}`
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
