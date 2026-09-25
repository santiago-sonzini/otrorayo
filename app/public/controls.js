export function videoTransfer(device, hash, controllerOnline = true) {
  const observed = device.observed;
  const percent = Math.max(0, Math.min(100, Number(observed?.transferPercent) || 0));
  if (!controllerOnline || !device.online || !observed) {
    const last = device.lastObserved;
    const previous = last?.contentStatus === 'LOADING' ? Math.floor(last.transferPercent || 0) : null;
    return { kind: 'offline', label: 'Sin conexión', percent: null, detail: previous == null ? 'Esperando que el visor vuelva a reportar.' : `Último avance: ${previous}%. Esperando conexión.` };
  }
  if (observed.contentStatus === 'READY' && observed.contentSha256 === hash)
    return { kind: 'ready', label: 'Video listo', percent: 100, detail: 'Guardado y verificado en el visor.' };
  if (observed.contentStatus === 'ERROR' || device.command?.action === 'DISTRIBUTE' && ['ERROR', 'TIMEOUT'].includes(device.command.status))
    return { kind: 'error', label: 'Envío pendiente de resolver', percent: null, detail: observed.error || device.command?.detail || 'No hubo confirmación. Revisá la conexión y volvé a distribuir.' };
  if (observed.contentStatus === 'LOADING') {
    if (device.command?.action === 'PREPARE' || device.command?.action === 'RELOAD')
      return { kind: 'checking', label: 'Verificando video', percent: null, detail: 'Comprobando el archivo antes de preparar.' };
    if (percent === 0) return { kind: 'checking', label: 'Iniciando envío / verificando archivo', percent: null, detail: 'Comprobando si el video ya está guardado.' };
    if (percent >= 99) return { kind: 'checking', label: 'Finalizando y verificando', percent: 99, detail: 'Esperando la confirmación del archivo completo.' };
    return { kind: 'sending', label: 'Enviando video', percent: Math.floor(percent), detail: 'Copiando desde la Mac al visor.' };
  }
  if (device.command?.action === 'DISTRIBUTE' && device.command.message?.content?.sha256 === hash)
    return { kind: 'waiting', label: 'Esperando al visor', percent: null, detail: 'Solicitud de envío enviada.' };
  return { kind: 'missing', label: 'Sin video validado', percent: null, detail: 'Pulsá Distribuir para enviarlo.' };
}

export function blockReason(state, action) {
  if (!state) return 'Conectando con el controlador…';
  const { desired, devices, preflight } = state;
  const targets = desired.selected.map(id => devices.find(d => d.id === id));
  const active = ['SCHEDULED', 'PLAYING', 'PAUSED'].includes(desired.phase);
  if (action === 'LOBBY') return '';
  if (['DISTRIBUTE', 'PREPARE', 'SELECT'].includes(action) && active)
    return 'Pulsá «Volver al inicio» para cerrar la sesión anterior.';
  if (action === 'SELECT') return '';
  if (targets.some(d => !d?.online)) return 'Abrí OTRORAYO en todos los visores seleccionados y conectalos al mismo Wi-Fi.';
  if (['DISTRIBUTE', 'PREPARE', 'PLAY'].includes(action) && !desired.experience)
    return 'Guardá una experiencia primero.';
  if (action === 'DISTRIBUTE') return targets.some(d => d.observed?.contentStatus === 'LOADING') ? 'Esperá a que termine la transferencia o verificación.' : '';
  if (action === 'PREPARE') {
    if (targets.some(d => d.observed?.contentStatus !== 'READY' || d.observed?.contentSha256 !== desired.experience.vr.sha256))
      return 'Primero distribuí el video y esperá a que quede validado.';
    return targets.some(d => d.observed?.playback === 'STANDBY') ? 'Los visores se están preparando.' : '';
  }
  if (action === 'PLAY') {
    if (!['PREPARING', 'READY'].includes(desired.phase)) return active ? 'Pulsá «Volver al inicio» para comenzar otra función.' : 'Pulsá Preparar antes de Play.';
    const blocks = preflight.checks.filter(c => c.status === 'BLOCK');
    if (!preflight.ready) return blocks.map(c => `${c.label}: ${c.detail}`).join(' · ');
    if (targets.some(d => d.observed?.playback !== 'READY')) return 'Esperando que todos los visores estén listos.';
  }
  if (action === 'PAUSE' && desired.phase !== 'PLAYING') return 'Disponible durante la reproducción.';
  if (action === 'RESUME') {
    if (desired.phase !== 'PAUSED') return 'Disponible cuando la experiencia está pausada.';
    if (targets.some(d => d.observed?.playback !== 'PAUSED')) return 'Los visores ya salieron de la sesión. Pulsá «Volver al inicio».';
  }
  if (action === 'RESYNC' && !['PLAYING', 'SCHEDULED'].includes(desired.phase)) return 'Disponible durante la reproducción.';
  return '';
}

export function nextStep(state) {
  if (!state) return 'Conectando con el controlador…';
  const { desired, devices } = state;
  const targets = devices.filter(d => desired.selected.includes(d.id));
  if (['SCHEDULED', 'PLAYING', 'PAUSED'].includes(desired.phase)) {
    if (targets.some(d => d.online && ['LOBBY', 'ERROR'].includes(d.observed?.playback)))
      return 'La sesión del panel no coincide con los visores. Pulsá «Volver al inicio» para recuperarlos.';
    return 'Para repetir la experiencia: Volver al inicio → Preparar → Play.';
  }
  if (targets.some(d => !d.online)) return 'Abrí OTRORAYO en los visores seleccionados. Cada uno debe aparecer ONLINE.';
  if (targets.some(d => d.observed?.contentStatus === 'LOADING')) return 'Transfiriendo o verificando el video. Esperá; no hace falta volver a pulsar Distribuir.';
  if (targets.some(d => d.observed?.contentStatus !== 'READY')) return 'Paso 1: pulsá Distribuir para copiar y verificar el video en los visores seleccionados.';
  if (targets.some(d => d.observed?.playback === 'STANDBY')) return 'Preparando el video. Play se habilitará cuando todos los visores estén listos.';
  return blockReason(state, 'PLAY') || 'Todo listo. Pulsá Play para iniciar desde el principio.';
}
