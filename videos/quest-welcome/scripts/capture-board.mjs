import{chromium}from'/Users/santiagosonzini/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:2});await page.goto('http://127.0.0.1:4186/storyboard.html');await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:'exports/storyboard-4k.png'});await browser.close();
