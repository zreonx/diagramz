const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000/app', { waitUntil: 'networkidle2' });
    console.log('Page loaded, title:', await page.title());

    // Wait for canvas
    await page.waitForSelector('svg', { timeout: 10000 });

    // Check toolbar grip
    const grip = await page.$('[title="Drag to reposition toolbar"]');
    console.log('Toolbar Grip handle found:', !!grip);

    // Test dragging toolbar
    if (grip) {
      const box = await grip.boundingBox();
      if (box) {
        await page.mouse.move(box.x + 5, box.y + 5);
        await page.mouse.down();
        await page.mouse.move(box.x - 120, box.y - 80);
        await page.mouse.up();
        console.log('Toolbar repositioned');
      }
    }

    // Select Rectangle tool
    const rectBtn = await page.$('button[title*="Rectangle"]');
    if (rectBtn) {
      await rectBtn.click();
      console.log('Rectangle tool selected');

      // Drag to draw a rectangle
      await page.mouse.move(450, 320);
      await page.mouse.down();
      await page.mouse.move(720, 500);
      await page.mouse.up();
      console.log('Rubberband shape drawn');
    }

    // Press ? for keyboard shortcuts dialog
    await page.keyboard.press('?');
    await new Promise((r) => setTimeout(r, 600));

    const dialog = await page.$('[role="dialog"]');
    console.log('Shortcuts modal opened:', !!dialog);

    const screenshotPath = 'C:/Users/Zorenl/.gemini/antigravity-cli/brain/768a6ff1-a73e-4925-b3c5-1a925c09fb1f/verified-shortcuts-and-drag.png';
    await page.screenshot({ path: screenshotPath });
    console.log('Saved screenshot to:', screenshotPath);

    await browser.close();
  } catch (err) {
    console.error('Error during test:', err);
    process.exit(1);
  }
})();
