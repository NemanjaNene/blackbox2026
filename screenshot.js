const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('Navigating to Wix Studio...');
  await page.goto('https://www.wix.com/studio', { waitUntil: 'networkidle', timeout: 60000 });

  // Wait for page to fully render
  await page.waitForTimeout(3000);

  // Take full page screenshot
  await page.screenshot({ path: 'assets/wix-full.png', fullPage: true });
  console.log('Full page screenshot saved.');

  // Take viewport screenshots scrolling down
  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  const viewportH = 900;
  let i = 0;

  for (let y = 0; y < totalHeight; y += viewportH * 0.8) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `assets/wix-section-${i}.png` });
    console.log(`Screenshot ${i} at scroll ${y}px`);
    i++;
    if (i > 20) break;
  }

  await browser.close();
  console.log('Done!');
})();
