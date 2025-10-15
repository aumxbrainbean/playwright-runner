const express = require("express");
const { chromium } = require("playwright");
const fs = require("fs");

const app = express();
app.use(express.json());

// ✅ Health check route
app.get("/", (req, res) => {
  res.send("✅ Playwright Runner for playwright.dev.brainbean.us is live!");
});

// ✅ Full test flow for https://playwright.dev.brainbean.us/
app.post("/run-brainbean-test", async (req, res) => {
  const baseUrl = "https://playwright.dev.brainbean.us";
  const pages = ["/", "/shop/", "/about/", "/contact/"];
  const results = [];

  try {
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const context = await browser.newContext();

    for (const path of pages) {
      const page = await context.newPage();
      const fullUrl = `${baseUrl}${path}`;
      const start = Date.now();

      let success = true;
      let error = null;
      let screenshot = null;
      let loadTime = 0;
      let status = 0;

      console.log(`🔎 Visiting ${fullUrl}`);

      try {
        let response = await page.goto(fullUrl, {
          waitUntil: "domcontentloaded",
          timeout: 60000
        });

        loadTime = Date.now() - start;
        status = response ? response.status() : 0;

        // Check for HTTP error codes
        if (status >= 400) {
          success = false;
          error = `HTTP ${status}`;
        } else {
          // Check for "soft 404" (content says 404 but HTTP = 200)
          const pageTitle = (await page.title()) || "";
          const bodyText = await page.textContent("body");

          if (
            pageTitle.match(/404|not found/i) ||
            bodyText.match(/404|page not found/i)
          ) {
            success = false;
            error = "Soft 404 detected in page content";
          }
        }

        // Take screenshot only if failed
        if (!success) {
          screenshot = await page.screenshot({ encoding: "base64" });
          console.warn(`⚠️ ${fullUrl} flagged as failure: ${error}`);
        } else {
          console.log(`✅ ${fullUrl} OK in ${loadTime}ms (status ${status})`);
        }

        results.push({ url: fullUrl, success, status, error, loadTime, screenshot });
      } catch (err) {
        console.error(`❌ Navigation failed for ${fullUrl}:`, err.message);
        success = false;
        error = err.message;
        screenshot = await page.screenshot({ encoding: "base64" });
        loadTime = Date.now() - start;
        results.push({ url: fullUrl, success, error, loadTime, screenshot });
      }

      await page.close();
    }

    await browser.close();

    res.json({
      success: true,
      site: baseUrl,
      testedPages: pages.length,
      timestamp: new Date().toISOString(),
      results
    });
  } catch (err) {
    console.error("Runner error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ✅ Generic site audit route (optional for any site)
app.post("/run-site-audit", async (req, res) => {
  const baseUrl = req.body.url || "https://playwright.dev.brainbean.us";
  const pagesToTest = req.body.pages || ["/", "/shop/", "/about/", "/contact/"];
  const results = [];

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const context = await browser.newContext();

  for (const pagePath of pagesToTest) {
    const page = await context.newPage();
    const fullUrl = `${baseUrl.replace(/\/$/, "")}${pagePath}`;
    const start = Date.now();
    let loadTime = 0;
    let screenshot = null;
    let success = true;
    let error = null;

    console.log(`🔎 Auditing ${fullUrl}`);

    try {
      page.on("console", msg => {
        if (msg.type() === "error") console.log(`JS Error on ${fullUrl}:`, msg.text());
      });

      await page.goto(fullUrl, { waitUntil: "networkidle", timeout: 60000 });
      loadTime = Date.now() - start;
      console.log(`✅ Loaded ${fullUrl} in ${loadTime}ms`);
      results.push({ page: fullUrl, success, loadTime });
    } catch (err) {
      console.error(`❌ Error on ${fullUrl}: ${err.message}`);
      loadTime = Date.now() - start;
      screenshot = await page.screenshot({ encoding: "base64" });
      success = false;
      error = err.message;
      results.push({ page: fullUrl, success, error, loadTime, screenshot });
    }

    await page.close();
  }

  await browser.close();

  const report = {
    baseUrl,
    timestamp: new Date().toISOString(),
    pagesTested: pagesToTest.length,
    results
  };

  try {
    fs.writeFileSync(`report-${Date.now()}.json`, JSON.stringify(report, null, 2));
  } catch (err) {
    console.warn("⚠️ Could not save report:", err.message);
  }

  res.json(report);
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
