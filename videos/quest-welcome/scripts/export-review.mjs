import{chromium}from'/Users/santiagosonzini/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import{writeFile}from'node:fs/promises';import assert from'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});const errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://127.0.0.1:4186/index.html');await page.waitForFunction(()=>window.sceneReady);
const results={frames:[],deterministic:false,errors};
for(const[name,time]of[['01-bienvenida',1],['02-tunel',10],['03-convergencia',19.5],['04-logo',25]]){
 await page.evaluate(t=>window.experience.renderAt(t),time);await page.screenshot({path:`exports/${name}.png`});results.frames.push({name,...await page.evaluate(()=>window.experience.info())});
}
results.deterministic=await page.evaluate(()=>{const e=window.experience;e.renderAt(10);const a=e.renderer.domElement.toDataURL();e.renderAt(25);e.renderAt(1);e.renderAt(10);return a===e.renderer.domElement.toDataURL();});assert.ok(results.deterministic);
results.minimumFilamentDistance=await page.evaluate(()=>{let min=Infinity;for(let t=4.5;t<=21;t+=.5){window.experience.renderAt(t);for(const m of window.experience.scene.children){if(!m.visible||!m.geometry?.attributes.pathU)continue;const p=m.geometry.attributes.position.array;for(let i=0;i<p.length;i+=3)min=Math.min(min,Math.hypot(p[i],p[i+1],p[i+2]));}}return min;});assert.ok(results.minimumFilamentDistance>1.4);
await page.setViewportSize({width:3840,height:2160});await page.evaluate(()=>{document.documentElement.style.width='3840px';document.documentElement.style.height='2160px';document.body.style.width='3840px';document.body.style.height='2160px';document.getElementById('root').style.width='3840px';document.getElementById('root').style.height='2160px';window.experience.resize(3840,2160);window.experience.renderAt(25);});
await page.screenshot({path:'exports/logo-final-4k.png'});await page.evaluate(()=>window.experience.setView({detail:true}));await page.screenshot({path:'exports/vidrio-detalle-4k.png'});
await page.setViewportSize({width:3840,height:1080});await page.evaluate(()=>{document.getElementById('root').style.height='1080px';document.body.style.height='1080px';document.documentElement.style.height='1080px';window.experience.resize(3840,1080);window.experience.setView({detail:false,stereo:true});window.experience.renderAt(10);});
await page.screenshot({path:'exports/tunel-estereo-sbs.png'});await page.evaluate(()=>window.experience.renderAt(25));await page.screenshot({path:'exports/logo-estereo-sbs.png'});
await page.setViewportSize({width:1440,height:1100});await page.goto('http://127.0.0.1:4186/review.html');await page.waitForFunction(()=>window.sceneReady);
await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.review.state().at),0);
await page.locator('#start').click();await page.waitForTimeout(300);assert.ok(await page.evaluate(()=>window.review.state().at>3));
await page.locator('#pause').click();const paused=await page.evaluate(()=>window.review.state().at);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.review.state().at),paused);
await page.locator('#lobby').click();assert.equal(await page.evaluate(()=>window.review.state().at),0);
await page.locator('#detail').click();assert.ok(await page.evaluate(()=>window.experience.info().view.detail));
await page.locator('#front').click();assert.equal(await page.evaluate(()=>window.experience.info().view.detail),false);
await page.locator('#stereo').click();assert.ok(await page.evaluate(()=>window.experience.info().view.stereo));await page.locator('#stereo').click();
await page.screenshot({path:'exports/review-desktop.png',fullPage:true});
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'exports/review-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
results.controls='PASS: lobby stays idle; start, pause, return, detail, frontal, stereo; no horizontal overflow at 390px';
await writeFile('exports/verification.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));assert.equal(errors.length,0);
await browser.close();
