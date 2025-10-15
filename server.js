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


// ✅ WooCommerce Add-to-Cart Flow Test (Stable Version)
app.post("/run-add-to-cart-test", async (req, res) => {
  const baseUrl = "https://playwright.dev.brainbean.us";
  const results = [];

  try {
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Step 1: Homepage
    const start1 = Date.now();
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    results.push({ step: "Homepage", success: true, loadTime: Date.now() - start1 });
    console.log("✅ Home loaded");

    // Step 2: Shop Page
    const start2 = Date.now();
    await page.goto(`${baseUrl}/shop/`, { waitUntil: "domcontentloaded" });
    results.push({ step: "Shop Page", success: true, loadTime: Date.now() - start2 });
    console.log("✅ Shop page loaded");

    // Step 3: Click first product
    const productSelector = "ul.products li.product a.woocommerce-LoopProduct-link";
    await page.waitForSelector(productSelector, { timeout: 10000 });
    const firstProductHref = await page.getAttribute(productSelector, "href");
    console.log(`🛍️ Opening product: ${firstProductHref}`);
    const start3 = Date.now();
    await page.click(productSelector);
    await page.waitForLoadState("domcontentloaded");
    results.push({ step: "Product Page", success: true, url: firstProductHref, loadTime: Date.now() - start3 });

    // Step 4: Add to Cart
    const addToCartBtn = 'button.single_add_to_cart_button';
    await page.waitForSelector(addToCartBtn, { timeout: 10000 });
    console.log("🛒 Clicking Add to Cart");
    await page.click(addToCartBtn);
    await page.waitForTimeout(2500); // let AJAX run

    // Step 5: Wait for side cart
    const sideCartSelector = "#moderncart-slide-out";
    let sideCartVisible = false;
    try {
      await page.waitForSelector(sideCartSelector, { timeout: 8000 });
      sideCartVisible = true;
      console.log("✅ Side cart opened");
    } catch {
      console.warn("⚠️ Side cart did not open automatically");
    }
    results.push({ step: "Side Cart", success: sideCartVisible });

    // Step 6: Close side cart (optional)
    if (sideCartVisible) {
      const closeButton = ".moderncart-slide-out-header-close";
      try {
        await page.click(closeButton, { timeout: 4000 });
        console.log("🧩 Closed side cart");
      } catch {
        console.warn("⚠️ Could not close side cart");
      }
    }

    // Step 7: Go to Cart page safely
    const start6 = Date.now();
    console.log("➡️ Going to Cart page...");
    await page.goto(`${baseUrl}/cart/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector(".wc-proceed-to-checkout a.checkout-button", { timeout: 15000 });
    results.push({ step: "Cart Page", success: true, loadTime: Date.now() - start6 });
    console.log("✅ Cart page loaded");

    // Step 8: Proceed to Checkout
    const checkoutBtn = ".wc-proceed-to-checkout a.checkout-button";
    const start7 = Date.now();
    console.log("💳 Proceeding to Checkout...");
    await page.click(checkoutBtn);
    await page.waitForURL(/\/checkout/, { timeout: 10000 });
    await page.waitForSelector("form.checkout", { timeout: 10000 });
    results.push({ step: "Checkout Page", success: true, loadTime: Date.now() - start7 });
    console.log("✅ Checkout loaded");

    await browser.close();

    res.json({
      success: true,
      site: baseUrl,
      flow: "Add to Cart → Checkout",
      timestamp: new Date().toISOString(),
      results
    });
  } catch (err) {
    console.error("❌ Add-to-cart flow failed:", err);
    results.push({ step: "Error", success: false, error: err.message });
    res.status(500).json({ success: false, results });
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
