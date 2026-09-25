// Hardware acceptance: expects Q01 with this APK, configured and connected to the local controller.
// Does not provision devices or change content. Leaves Q01 READY after a complete pass.
import fs from 'node:fs/promises';
import path from 'node:path';
import{execFile}from'node:child_process';import{promisify}from'node:util';
const run=promisify(execFile),base='http://127.0.0.1:8787',serial=process.env.QUEST_SERIAL;
if(!serial)throw Error('Set QUEST_SERIAL to the authorized device');
const output=path.resolve('app/quest/Builds/welcome-review');
async function state(){return(await(await fetch(base+'/api/state')).json());}
async function action(action){const r=await fetch(base+'/api/action',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,ids:['Q01']})});const s=await r.json();if(!r.ok)throw Error(`${action}: ${s.error}`);return s;}
async function until(predicate,timeout=45000){const end=Date.now()+timeout;while(Date.now()<end){const s=await state(),d=s.devices.find(d=>d.id==='Q01');if(d.observed?.error)throw Error(d.observed.error);if(predicate(s,d))return s;await delay(250);}throw Error('Device acceptance timed out');}
function delay(ms){return new Promise(r=>setTimeout(r,ms));}
async function capture(name){const{stdout}=await run('adb',['-s',serial,'exec-out','screencap','-p'],{encoding:'buffer',maxBuffer:20*1024*1024});await fs.writeFile(path.join(output,name+'.png'),stdout);}
await until((s,d)=>d.online&&d.observed?.appVersion==='quest-0.3.1',25000);
await action('LOBBY');await action('DISTRIBUTE');await until((s,d)=>d.observed?.contentStatus==='READY');
await action('PREPARE');await until((s,d)=>s.desired.phase==='READY'&&d.observed?.playback==='READY');
console.log('PASS: final APK; SHA verified; decoder and first frame preloaded');
await action('PLAY');await until((s,d)=>d.observed?.playback==='PLAYING'&&d.observed.positionMs>=3000);
await action('PAUSE');await until((s,d)=>d.observed?.playback==='PAUSED');
const paused=(await state()).devices[0].observed.positionMs;await delay(1500);
if(Math.abs((await state()).devices[0].observed.positionMs-paused)>20)throw Error('Paused show clock moved');
console.log('PASS: pause freezes the welcome');
await action('RESUME');await until((s,d)=>d.observed?.playback==='PLAYING'&&d.observed.positionMs>=17000);
await capture('final-quest-bienvenido');
await until((s,d)=>d.observed?.playback==='PLAYING'&&d.observed.positionMs>=23000);
await capture('final-quest-video');
console.log('PASS: resumed welcome reaches the prepared video');
await action('PAUSE');await until((s,d)=>d.observed?.playback==='PAUSED');await action('RESUME');
await until((s,d)=>d.observed?.playback==='PLAYING'&&d.observed.positionMs>=28000);
console.log('PASS: video resume uses show time minus 19 seconds');
await action('LOBBY');await until((s,d)=>d.observed?.playback==='LOBBY');
await action('PREPARE');const ready=await until((s,d)=>s.desired.phase==='READY'&&d.observed?.playback==='READY');
await fs.writeFile(path.join(output,'final-device-state.json'),JSON.stringify(ready,null,2));
await run('adb',['-s',serial,'pull','/sdcard/Android/data/com.otrorayo.quest/files/quest-events.jsonl',path.join(output,'final-quest-events.jsonl')]);
console.log('PASS: returned to black and prepared again; ready for manual PLAY');
