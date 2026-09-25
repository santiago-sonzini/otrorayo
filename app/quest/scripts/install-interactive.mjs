import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import os from 'node:os';
import { main } from './quest.mjs';

const input = createInterface({ input: stdin, output: stdout });
try {
  console.log('\nOTRORAYO · INSTALAR EN UN QUEST\nConectá un solo visor por USB y aceptá la depuración dentro del Quest.\n');
  const id = (await input.question('Identificador del visor (Q01 a Q10): ')).trim().toUpperCase();
  const addresses = [...new Set(Object.values(os.networkInterfaces()).flat().filter(x => x.family === 'IPv4' && !x.internal).map(x => `http://${x.address}:8787`))];
  console.log('Direcciones de esta Mac: ' + (addresses.join(', ') || 'sin conexión de red'));
  const suggested = addresses.length === 1 ? addresses[0] : '';
  const server = (await input.question(`Dirección de la Mac en la red de los Quest${suggested ? ` [${suggested}]` : ''}: `)).trim() || suggested;
  await main(['install', '--id', id, '--server', server]);
} catch (error) {
  console.error('\n' + error.message);
  process.exitCode = 1;
} finally { await input.question('\nPresioná Enter para cerrar.'); input.close(); }
