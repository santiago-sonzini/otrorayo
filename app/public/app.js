import { blockReason, nextStep, videoTransfer } from './controls.js';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = ms => { const s = Math.max(0, Math.floor((ms || 0) / 1000)); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
let state = null, socket = null, connected = false;
let formExperienceId = null;
let toastTimer;
let actionPending = false;
let selectionMarkup = '';
let deliveryHash = null;
const deliveryRecipients = new Set();
function updateConnection() { if (state) render(state); }
function toast(message, error = false) { const el = $('#toast'); el.textContent = message; el.className = error ? 'error' : ''; el.style.display = 'block'; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.style.display = 'none', 5000); }
async function api(url, payload) {
  const response = await fetch(url, { method: payload ? 'POST' : 'GET', headers: payload ? { 'content-type': 'application/json' } : {}, body: payload ? JSON.stringify(payload) : undefined });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}
async function run(action, ids) {
  if (actionPending) return;
  actionPending = true; updateConnection();
  try { const next = await api('/api/action', { action, ids }); render(next); toast(action === 'LOBBY' ? 'Sesión reiniciada. Elegí los visores y prepará la experiencia.' : action === 'DISTRIBUTE' ? `Envío solicitado a ${(ids || next.desired.selected).join(' + ')}. Seguí el avance arriba.` : `${action} enviado; esperando confirmación del visor.`); }
  catch (e) { toast(e.message, true); }
  finally { actionPending = false; updateConnection(); }
}
async function loadFiles() {
  try {
    const files = await api('/api/files');
    const select = $('#files'), previous = select.value;
    select.innerHTML = '<option value="">Seleccionar archivo…</option>' + files.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
    select.value = files.includes(previous) ? previous : files.includes(state?.desired?.experience?.vr?.file) ? state.desired.experience.vr.file : '';
  } catch (e) { toast(e.message, true); }
}
function renderDelivery() {
  const video = state.desired.experience?.vr;
  $('#video-delivery').hidden = !video;
  if (!video) return;
  if (deliveryHash !== video.sha256) { deliveryHash = video.sha256; deliveryRecipients.clear(); }
  for (const d of state.devices) {
    if (d.command?.action === 'DISTRIBUTE' && d.command.message?.content?.sha256 === video.sha256 || d.observed?.contentStatus === 'LOADING') deliveryRecipients.add(d.id);
  }
  const ids = deliveryRecipients.size ? [...deliveryRecipients] : state.desired.selected;
  const rows = state.devices.filter(d => ids.includes(d.id)).map(d => ({ id: d.id, ...videoTransfer(d, video.sha256, connected) }));
  const sending = rows.filter(r => r.kind === 'sending').map(r => r.id);
  const processing = rows.filter(r => ['checking', 'waiting'].includes(r.kind)).map(r => r.id);
  const offline = rows.filter(r => r.kind === 'offline').map(r => r.id);
  const completed = rows.filter(r => r.kind === 'ready').length;
  $('#delivery-title').textContent = sending.length ? `Enviando video a ${sending.join(' + ')}` : processing.length ? `Preparando o verificando el envío a ${processing.join(' + ')}` : completed === rows.length ? `Video listo en ${ids.join(' + ')}` : offline.length ? `Esperando conexión de ${offline.join(' + ')}` : `Video para ${ids.join(' + ')}`;
  const size = video.size >= 1e9 ? `${(video.size / 1e9).toFixed(2)} GB` : `${Math.round(video.size / 1e6)} MB`;
  $('#delivery-file').textContent = `${video.file} · ${size} · ${completed} de ${rows.length} visores con video listo`;
  $('#delivery-devices').innerHTML = rows.map(r => `<div class="delivery-row ${r.kind}">
    <div class="delivery-row-heading"><strong>${esc(r.id)}</strong><span>${esc(r.label)}</span><b>${r.percent == null ? '—' : r.percent + '%'}</b></div>
    <div class="delivery-track" role="progressbar" aria-label="Video en ${esc(r.id)}" aria-valuemin="0" aria-valuemax="100" ${r.percent == null ? '' : `aria-valuenow="${r.percent}"`} aria-valuetext="${esc(r.label)}"><span style="width:${r.percent ?? 0}%"></span></div>
    <small>${esc(r.detail)}</small></div>`).join('');
}
function badgeBattery(n) { return n == null ? '—' : `${Math.round(n)}%`; }
function deviceCard(d, selected) {
  const o = d.observed, last = d.lastSeen ? `${Math.round((state.now - d.lastSeen) / 1000)} s` : '—';
  const batteryClass = o?.battery < 20 ? 'critical' : o?.battery < 40 ? 'warn' : '';
  const transfer = videoTransfer(d, state.desired.experience?.vr?.sha256, connected);
  const content = `${transfer.label}${transfer.percent == null ? '' : ` · ${transfer.percent}%`}`;
  return `<article data-device-id="${d.id}" class="device ${d.online ? '' : 'offline'} ${selected ? 'selected' : ''}">
    <div class="device-head"><strong>${d.id}</strong><span>${d.online ? '● ONLINE' : '○ OFFLINE'}</span></div>
    <div class="device-state">${esc(o?.playback || 'TELEMETRÍA NO VIGENTE')}</div>
    <dl><dt>CONTENIDO</dt><dd title="${esc(content)}">${esc(content)}</dd><dt>BATERÍA</dt><dd class="${batteryClass}">${badgeBattery(o?.battery)}${o?.charging ? ' ↯' : ''}</dd><dt>TIMECODE</dt><dd>${o ? fmt(o.positionMs) : '—'}</dd><dt>DRIFT</dt><dd>${d.driftMs == null ? '—' : `${d.driftMs > 0 ? '+' : ''}${d.driftMs} ms`}</dd><dt>RELOJ</dt><dd>${d.clock ? `${Math.round(d.clock.offsetMs)} ms` : '—'}</dd><dt>ÚLTIMO</dt><dd>${last}</dd><dt>APP / IP</dt><dd title="${esc(d.ip || '')}">${esc(o?.appVersion || '—')} / ${esc(d.ip || '—')}</dd><dt>COMANDO</dt><dd title="${esc(d.command?.detail || '')}">${esc(d.command ? `${d.command.action} ${d.command.status}` : '—')}</dd></dl>
    <p class="device-error" ${o?.error ? '' : 'hidden'}>${esc(o?.error)}</p>
    <div class="device-actions"><button data-device-action="IDENTIFY" data-id="${d.id}" ${d.online ? '' : 'disabled'}>IDENTIFY</button><button data-device-action="RELOAD" data-id="${d.id}" ${d.online ? '' : 'disabled'}>RELOAD</button><button data-device-action="RESYNC" data-id="${d.id}" ${d.online ? '' : 'disabled'}>RESYNC</button></div></article>`;
}
function render(next) {
  state = next;
  const desired = state.desired, exp = desired.experience, selected = desired.selected;
  renderDelivery();
  $('#event-name').textContent = desired.eventName;
  $('#experience-name').textContent = exp?.name || 'Cargá una experiencia para comenzar';
  if (exp && exp.id !== formExperienceId) {
    formExperienceId = exp.id;
    const fields = $('#experience-form').elements;
    const values = { eventName: desired.eventName, name: exp.name, file: exp.vr.file, durationSeconds: exp.durationMs ? exp.durationMs / 1000 : '', projection: exp.vr.projection || '360', stereo: exp.vr.stereo || 'mono', muted: String(exp.vr.muted ?? true), lobbyPreset: exp.lobby?.preset || 'orbit', lobbyColor: exp.lobby?.color || '#75dec9', particleIntensity: exp.lobby?.particleIntensity ?? 0.5 };
    for (const [name, value] of Object.entries(values)) fields.namedItem(name).value = value;
  }
  $('#phase').textContent = desired.phase;
  $('#online-count').textContent = `${state.devices.filter(d => selected.includes(d.id) && d.online).length} / ${selected.length}`;
  $('#ready-count').textContent = `${state.devices.filter(d => selected.includes(d.id) && d.online && d.observed?.contentStatus === 'READY' && d.observed?.contentSha256 === exp?.vr?.sha256).length} / ${selected.length}`;
  $('#master-clock').textContent = fmt(state.expectedPositionMs).slice(3);
  $('#timecode').textContent = fmt(state.expectedPositionMs);
  const nativeWelcome = state.devices.some(d => selected.includes(d.id) && /^quest-0\.[3-9]\./.test((d.observed || d.lastObserved)?.appVersion || ''));
  const totalDuration = (exp?.durationMs || 0) + (nativeWelcome ? 19000 : 0);
  $('#duration').textContent = exp?.durationMs ? fmt(totalDuration) : 'SIN DURACIÓN';
  $('#progress').style.width = totalDuration ? `${Math.min(100, state.expectedPositionMs / totalDuration * 100)}%` : '0%';
  if (nativeWelcome && desired.phase === 'PLAYING') $('#phase').textContent = state.expectedPositionMs < 19000 ? 'BIENVENIDA' : state.expectedPositionMs < 21000 ? 'FUNDIDO' : 'VIDEO';
  $('#selected-label').textContent = selected.join(' + ');
  $('#preflight-badge').textContent = state.preflight.ready ? 'LISTO PARA PRUEBA' : 'BLOQUEADO';
  $('#preflight-badge').className = `badge ${state.preflight.ready ? 'ready' : 'blocked'}`;
  $('#checks').innerHTML = state.preflight.checks.map(c => `<div class="check"><span>${esc(c.label)}<small>${esc(c.detail)}</small></span><b class="${c.status}">${c.status === 'BLOCK' ? 'BLOQUEO' : c.status}</b></div>`).join('');
  // Keep action buttons mounted while telemetry changes, including during a click.
  for (const device of state.devices) {
    const template = document.createElement('template');
    template.innerHTML = deviceCard(device, selected.includes(device.id));
    const nextCard = template.content.firstElementChild;
    const card = document.querySelector(`[data-device-id="${device.id}"]`);
    if (!card) { $('#devices').append(nextCard); continue; }
    card.className = nextCard.className;
    for (const selector of ['.device-head', '.device-state', 'dl', '.device-error']) {
      const before = card.querySelector(selector), after = nextCard.querySelector(selector);
      if (before.innerHTML !== after.innerHTML) before.innerHTML = after.innerHTML;
      before.hidden = after.hidden;
    }
    for (const button of card.querySelectorAll('[data-device-action]')) {
      const action = button.dataset.deviceAction;
      button.disabled = !connected || !device.online || actionPending || (action === 'RESYNC' && !['PLAYING', 'SCHEDULED'].includes(desired.phase));
    }
  }
  const nextSelectionMarkup = `<button class="select-btn ${selected.length === 10 ? 'active' : ''}" data-select="ALL">ALL</button>` + state.devices.map(d => `<button class="select-btn ${selected.length === 1 && selected[0] === d.id ? 'active' : ''}" data-select="${d.id}">${d.id}</button>`).join('') + `<button class="select-btn ${selected.length === 2 && selected.includes('Q01') && selected.includes('Q02') ? 'active' : ''}" data-select="TWO">Q01 + Q02</button>`;
  if (nextSelectionMarkup !== selectionMarkup) {
    $('#selection-buttons').innerHTML = nextSelectionMarkup; selectionMarkup = nextSelectionMarkup;
  }
  $('#operation-hint').textContent = !connected ? 'Sin conexión con el controlador. Reconectando…' : nextStep(state);
  for (const button of document.querySelectorAll('[data-select], [data-action]')) {
    const reason = !connected ? 'Sin conexión con el controlador.' : actionPending ? 'Enviando comando…' : blockReason(state, button.dataset.action || 'SELECT');
    button.disabled = !!reason;
    button.title = reason;
    button.setAttribute('aria-description', reason);
  }
  for (const button of document.querySelectorAll('[data-hold]')) button.disabled = !connected || actionPending;

}
function connect() {
  socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/dashboard`);
  socket.onopen = () => { connected = true; document.body.classList.remove('offline'); $('#server-status').textContent = 'ONLINE'; updateConnection(); };
  socket.onmessage = event => { try { render(JSON.parse(event.data)); } catch (e) { console.error(e); } };
  socket.onclose = () => { connected = false; document.body.classList.add('offline'); $('#server-status').textContent = 'OFFLINE'; updateConnection(); setTimeout(connect, 1000); };
  socket.onerror = () => {};
}
document.addEventListener('click', async event => {
  const action = event.target.closest('[data-action]'); if (action) return run(action.dataset.action);
  const deviceAction = event.target.closest('[data-device-action]'); if (deviceAction) return run(deviceAction.dataset.deviceAction, [deviceAction.dataset.id]);
  const select = event.target.closest('[data-select]');
  if (select) {
    const ids = select.dataset.select === 'ALL' ? state.devices.map(d => d.id) : select.dataset.select === 'TWO' ? ['Q01', 'Q02'] : [select.dataset.select];
    try { await api('/api/select', { ids }); } catch (e) { toast(e.message, true); }
  }
});
for (const button of document.querySelectorAll('[data-hold]')) {
  let timer;
  const cancel = () => { clearTimeout(timer); button.classList.remove('holding'); };
  button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); button.classList.add('holding'); timer = setTimeout(() => { run(button.dataset.hold, state.devices.map(d => d.id)); cancel(); }, 1000); });
  button.addEventListener('pointerup', cancel); button.addEventListener('pointercancel', cancel); button.addEventListener('lostpointercapture', cancel);
}
$('#experience-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = new FormData(event.target);
  try { await api('/api/experience', { eventName: form.get('eventName'), name: form.get('name'), file: form.get('file'), durationMs: Number(form.get('durationSeconds') || 0) * 1000, projection: form.get('projection'), stereo: form.get('stereo'), muted: form.get('muted') === 'true', lobby: { preset: form.get('lobbyPreset'), color: form.get('lobbyColor'), particleIntensity: Number(form.get('particleIntensity')) } }); toast('Experiencia guardada. Distribuí y prepará los visores para aplicar los cambios.'); }
  catch (e) { toast(e.message, true); }
});
$('#refresh-files').addEventListener('click', loadFiles);
loadFiles(); connect();
