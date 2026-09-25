import {chromium} from '/Users/santiagosonzini/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--disable-web-security']});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
page.on('pageerror',e=>console.log('PAGEERROR',e.message));page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text());});
await page.goto('http://127.0.0.1:4186/index.html');await page.waitForFunction(()=>window.sceneReady,{timeout:30000});
for(const [name,time] of [['01-bienvenida',1],['02-tunel',10],['03-convergencia',19.5],['04-logo',25]]){
 await page.evaluate(t=>window.experience.renderAt(t),time);await page.screenshot({path:`exports/${name}.png`});console.log(name,await page.evaluate(()=>window.experience.info()));
}
await page.evaluate(()=>{window.experience.renderAt(25);window.experience.setView({detail:true});});await page.screenshot({path:'exports/detail-test.png'});
await browser.close();
