#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { access, chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_ID = 'com.otrorayo.quest';
const FILES = `/sdcard/Android/data/${APP_ID}/files`;
const ACTIVITY = `${APP_ID}/com.unity3d.player.UnityPlayerGameActivity`;

export function validateConfig(id, serverUrl, token) {
  if (!/^Q(0[1-9]|10)$/.test(id || '')) throw new Error('Usá un ID entre Q01 y Q10.');
  let url;
  try { url = new URL(serverUrl); } catch { throw new Error('Indicá --server http://IP-DE-LA-MAC:8787'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/')
    throw new Error('La dirección debe ser http(s)://IP:puerto, sin rutas ni credenciales.');
  if (['localhost', '127.0.0.1', '[::1]', '0.0.0.0', '[::]'].includes(url.hostname))
    throw new Error('Usá la IP de red de la Mac; localhost dentro del Quest es el propio visor.');
  if (typeof token !== 'string' || token.trim().length < 16 || /[\r\n]/.test(token.trim()))
    throw new Error('Token local ausente o inválido. Iniciá primero el controlador con npm start.');
  return { id, serverUrl: url.origin, token: token.trim() };
}
async function exists(file) { try { await access(file); return true; } catch { return false; } }
async function executable(file) { try { await access(file, constants.X_OK); return true; } catch { return false; } }
async function unityEditors() {
  const base = '/Applications/Unity/Hub/Editor';
  let entries = []; try { entries = await readdir(base); } catch { }
  return entries.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    .map(v => path.join(base, v, 'Unity.app/Contents/MacOS/Unity'));
}
async function findUnity() {
  const choices = [process.env.UNITY_EDITOR, '/Applications/Unity/Hub/Editor/6000.0.65f1/Unity.app/Contents/MacOS/Unity', ...await unityEditors(), '/Applications/Unity/Unity.app/Contents/MacOS/Unity'].filter(Boolean);
  for (const file of choices) if (await executable(file)) return file;
  return null;
}
function unityEditorRoot(unity) {
  return path.resolve(path.dirname(unity), '../../..');
}
async function findAdb() {
  const editors = await unityEditors();
  const choices = [process.env.ADB, ...String(process.env.PATH || '').split(path.delimiter).map(p => path.join(p, 'adb')),
    path.join(os.homedir(), 'Library/Android/sdk/platform-tools/adb'),
    ...editors.map(p => path.join(unityEditorRoot(p), 'PlaybackEngines/AndroidPlayer/SDK/platform-tools/adb'))].filter(Boolean);
  const unity = await findUnity();
  if (unity) choices.push(path.join(unityEditorRoot(unity), 'PlaybackEngines/AndroidPlayer/SDK/platform-tools/adb'));
  for (const file of choices) if (await executable(file)) return file;
  return null;
}
function run(binary, args, { capture = false, cwd = ROOT } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit', shell: false });
    let output = '', error = '';
    if (capture) { child.stdout.on('data', chunk => output += chunk); child.stderr.on('data', chunk => error += chunk); }
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(`${path.basename(binary)} terminó con código ${code}${error ? ': ' + error.trim() : ''}`)));
  });
}
export function parseDevices(output) {
  return output.split(/\r?\n/).filter(x => x && !x.startsWith('List of devices') && !x.startsWith('*')).map(line => {
    const [serial, state] = line.trim().split(/\s+/); return { serial, state };
  });
}
async function getDevice(adb, serial) {
  const devices = parseDevices(await run(adb, ['devices'], { capture: true }));
  if (serial) {
    if (!devices.some(d => d.serial === serial && d.state === 'device')) throw new Error('El visor indicado no está conectado y autorizado. Revisá el permiso USB dentro del Quest.');
    return serial;
  }
  const online = devices.filter(d => d.state === 'device');
  if (online.length !== 1) throw new Error(online.length > 1 ? 'Hay varios visores. Elegí uno con --serial NUMERO (ver doctor).' : 'No hay un visor autorizado. Conectalo por USB, activá modo desarrollador y aceptá la depuración dentro del Quest.');
  return online[0].serial;
}
async function doctor() {
  const unity = await findUnity(), adb = await findAdb();
  console.log(`Node: ${process.version}\nUnity: ${unity || 'FALTA — instalar Unity Hub + Unity 6000.0.65f1 + Android Build Support (SDK/NDK/OpenJDK)'}\nADB: ${adb || 'FALTA — viene incluido con Android Build Support'}\nAPK: ${await exists(path.join(ROOT, 'Builds/OTRORAYO-Quest.apk')) ? 'disponible' : 'pendiente de compilación'}`);
  const addresses = Object.values(os.networkInterfaces()).flat().filter(x => x.family === 'IPv4' && !x.internal).map(x => `http://${x.address}:8787`);
  console.log('Direcciones de esta Mac (elegí la red compartida con los Quest): ' + (addresses.join(', ') || 'sin red local'));
  if (adb) console.log(await run(adb, ['devices', '-l'], { capture: true }));
}
async function build() {
  const unity = await findUnity();
  if (!unity) throw new Error('Falta Unity. Instalá Unity Hub, Unity 6000.0.65f1 y Android Build Support con SDK/NDK/OpenJDK. Abrí Unity una vez para activar tu licencia.');
  const android = path.join(unityEditorRoot(unity), 'PlaybackEngines/AndroidPlayer');
  if (!await exists(android)) throw new Error('Este Unity no tiene Android Build Support. Agregalo desde Unity Hub.');
  await mkdir(path.join(ROOT, 'Builds'), { recursive: true });
  for (const method of ['Configure', 'Build']) {
    console.log(method === 'Configure' ? 'Configurando OpenXR y Android…' : 'Generando APK…');
    await run(unity, ['-batchmode', '-nographics', '-quit', '-buildTarget', 'Android', '-projectPath', ROOT,
      '-executeMethod', `Otrorayo.Quest.Editor.QuestBuild.${method}`, '-logFile', path.join(ROOT, `Builds/${method.toLowerCase()}.log`)]);
  }
  const apk = path.join(ROOT, 'Builds/OTRORAYO-Quest.apk');
  if (!await exists(apk)) throw new Error('Unity terminó sin APK. Revisá Builds/build.log.');
  console.log(`APK generado: ${apk}`);
}
async function install(options) {
  // Validate everything before touching a connected device.
  const tokenFile = path.resolve(options['token-file'] || path.join(ROOT, '../data/device-token.txt'));
  let token;
  try { token = (await readFile(tokenFile, 'utf8')).trim(); } catch { throw new Error('No se encontró el token. Iniciá el controlador: cd app && npm start'); }
  const config = validateConfig(options.id, options.server, token);
  const apk = path.resolve(options.apk || path.join(ROOT, 'Builds/OTRORAYO-Quest.apk'));
  if (!await exists(apk)) throw new Error('Todavía no hay APK. Ejecutá primero: node app/quest/scripts/quest.mjs build');
  const adb = await findAdb(); if (!adb) throw new Error('No se encontró ADB. Ejecutá doctor para ver qué falta.');
  const serial = await getDevice(adb, options.serial);
  const args = ['-s', serial];
  console.log(`Instalando OTRORAYO VR en ${config.id} (${serial})…`);
  await run(adb, [...args, 'install', '-r', apk]);
  // First launch lets Android create the app-specific external files directory.
  await run(adb, [...args, 'shell', 'am', 'start', '-n', ACTIVITY], { capture: true });
  await new Promise(resolve => setTimeout(resolve, 1500));
  await run(adb, [...args, 'shell', 'am', 'force-stop', APP_ID]);
  const temp = await mkdtemp(path.join(os.tmpdir(), 'otrorayo-provision-'));
  try {
    await chmod(temp, 0o700);
    const file = path.join(temp, 'quest-config.json');
    await writeFile(file, JSON.stringify(config, null, 2), { mode: 0o600 });
    await run(adb, [...args, 'shell', 'mkdir', '-p', FILES]);
    await run(adb, [...args, 'push', file, `${FILES}/quest-config.json`], { capture: true });
  } finally { await rm(temp, { recursive: true, force: true }); }
  await run(adb, [...args, 'shell', 'am', 'start', '-n', ACTIVITY], { capture: true });
  console.log(`${config.id} instalado y configurado. Poné el visor y la Mac en la misma red. Buscá ${config.id} ONLINE en el panel.`);
}
async function logs(options) {
  const adb = await findAdb(); if (!adb) throw new Error('Falta ADB. Ejecutá doctor.');
  const serial = await getDevice(adb, options.serial);
  const output = path.resolve(options.output || path.join(ROOT, 'Builds', `quest-events-${serial.replace(/[^\w-]/g, '_')}.jsonl`));
  await mkdir(path.dirname(output), { recursive: true });
  await run(adb, ['-s', serial, 'pull', `${FILES}/quest-events.jsonl`, output]);
  console.log(`Registro exportado: ${output}`);
}
function help() {
  console.log(`OTRORAYO · App Quest\n\n  node app/quest/scripts/quest.mjs doctor\n  node app/quest/scripts/quest.mjs build\n  node app/quest/scripts/quest.mjs install --id Q01 --server http://192.168.1.100:8787\n  node app/quest/scripts/quest.mjs logs\n\nOpciones: --serial SERIAL, --apk RUTA, --token-file RUTA, --output RUTA\nVariables opcionales: UNITY_EDITOR (ejecutable Unity), ADB (ejecutable adb).\nLeé app/quest/README.md para habilitar modo desarrollador y hacer el ensayo.`);
}
export async function main(argv = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: {
    id: { type: 'string' }, server: { type: 'string' }, serial: { type: 'string' }, apk: { type: 'string' },
    'token-file': { type: 'string' }, output: { type: 'string' }, help: { type: 'boolean' }
  } });
  if (values.help || !positionals.length) return help();
  if (positionals.length !== 1) throw new Error('Indicá una sola acción: doctor, build, install o logs.');
  switch (positionals[0]) {
    case 'doctor': return doctor();
    case 'build': return build();
    case 'install': return install(values);
    case 'logs': return logs(values);
    default: throw new Error('Acción desconocida. Usá --help.');
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`OTRORAYO: ${error.message}`); process.exitCode = 1; });
}
