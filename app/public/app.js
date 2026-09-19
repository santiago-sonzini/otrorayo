const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = ms => { const s = Math.max(0, Math.floor((ms || 0) / 1000)); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
let state = null, socket = null, connected = false;
let toastTimer;
function toast(message, error = false) { const el = $('#toast'); el.textContent = message; el.className = error ? 'error' : ''; el.style.display = 'block'; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.style.display = 'none', 5000); }
async function api(url, payload) {
  const response = await fetch(url, { method: payload ? 'POST' : 'GET', headers: payload ? { 'content-type': 'application/json' } : {}, body: payload ? JSON.stringify(payload) : undefined });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}
async function run(action, ids) { try { await api('/api/action', { action, ids }); toast(`${action} enviado`); } catch (e) { toast(e.message, true); } }
async function loadFiles() {
  try {
    const files = await api('/api/files');
    const select = $('#files'), previous = select.value;
    select.innerHTML = '<option value="">Seleccionar archivo…</option>' + files.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
    select.value = files.includes(previous) ? previous : '';
  } catch (e) { toast(e.message, true); }
}
function badgeBattery(n) { return n == null ? '—' : `${Math.round(n)}%`; }
function deviceCard(d, selected) {
  const o = d.observed, last = d.lastSeen ? `${Math.round((state.now - d.lastSeen) / 1000)} s` : '—';
  const batteryClass = o?.battery < 20 ? 'critical' : o?.battery < 40 ? 'warn' : '';
  const content = o?.contentStatus === 'LOADING' ? `LOADING ${o.transferPercent}%` : o?.contentStatus || 'SIN DATO';
  return `<article class="device ${d.online ? '' : 'offline'} ${selected ? 'selected' : ''}">
    <div class="device-head"><strong>${d.id}</strong><span>${d.online ? '● ONLINE' : '○ OFFLINE'}</span></div>
    <div class="device-state">${esc(o?.playback || 'TELEMETRÍA NO VIGENTE')}</div>
    <dl><dt>CONTENIDO</dt><dd>${esc(content)}</dd><dt>BATERÍA</dt><dd class="${batteryClass}">${badgeBattery(o?.battery)}${o?.charging ? ' ↯' : ''}</dd><dt>TIMECODE</dt><dd>${o ? fmt(o.positionMs) : '—'}</dd><dt>DRIFT</dt><dd>${d.driftMs == null ? '—' : `${d.driftMs > 0 ? '+' : ''}${d.driftMs} ms`}</dd><dt>RELOJ</dt><dd>${d.clock ? `${Math.round(d.clock.offsetMs)} ms` : '—'}</dd><dt>ÚLTIMO</dt><dd>${last}</dd><dt>APP / IP</dt><dd title="${esc(d.ip || '')}">${esc(o?.appVersion || '—')} / ${esc(d.ip || '—')}</dd><dt>COMANDO</dt><dd title="${esc(d.command?.detail || '')}">${esc(d.command ? `${d.command.action} ${d.command.status}` : '—')}</dd></dl>
    <div class="device-actions"><button data-device-action="IDENTIFY" data-id="${d.id}" ${d.online ? '' : 'disabled'}>IDENTIFY</button><button data-device-action="RELOAD" data-id="${d.id}" ${d.online ? '' : 'disabled'}>RELOAD</button><button data-device-action="RESYNC" data-id="${d.id}" ${d.online ? '' : 'disabled'}>RESYNC</button></div></article>`;
}
function render(next) {
  state = next;
  const desired = state.desired, exp = desired.experience, selected = desired.selected;
  $('#event-name').textContent = desired.eventName;
  $('#experience-name').textContent = exp?.name || 'Cargá una experiencia para comenzar';
  $('#phase').textContent = desired.phase;
  $('#online-count').textContent = `${state.devices.filter(d => selected.includes(d.id) && d.online).length} / ${selected.length}`;
  $('#ready-count').textContent = `${state.devices.filter(d => selected.includes(d.id) && d.online && d.observed?.contentStatus === 'READY' && d.observed?.contentSha256 === exp?.vr?.sha256).length} / ${selected.length}`;
  $('#master-clock').textContent = fmt(state.expectedPositionMs).slice(3);
  $('#timecode').textContent = fmt(state.expectedPositionMs);
  $('#duration').textContent = exp?.durationMs ? fmt(exp.durationMs) : 'SIN DURACIÓN';
  $('#progress').style.width = exp?.durationMs ? `${Math.min(100, state.expectedPositionMs / exp.durationMs * 100)}%` : '0%';
  $('#selected-label').textContent = selected.join(' + ');
  $('#preflight-badge').textContent = state.preflight.ready ? 'LISTO PARA PRUEBA' : 'BLOQUEADO';
  $('#preflight-badge').className = `badge ${state.preflight.ready ? 'ready' : 'blocked'}`;
  $('#checks').innerHTML = state.preflight.checks.map(c => `<div class="check"><span>${esc(c.label)}<small>${esc(c.detail)}</small></span><b class="${c.status}">${c.status === 'BLOCK' ? 'BLOQUEO' : c.status}</b></div>`).join('');
  $('#devices').innerHTML = state.devices.map(d => deviceCard(d, selected.includes(d.id))).join('');
  $('#selection-buttons').innerHTML = `<button class="select-btn ${selected.length === 10 ? 'active' : ''}" data-select="ALL">ALL</button>` + state.devices.map(d => `<button class="select-btn ${selected.length === 1 && selected[0] === d.id ? 'active' : ''}" data-select="${d.id}">${d.id}</button>`).join('') + `<button class="select-btn ${selected.length === 2 && selected.includes('Q01') && selected.includes('Q02') ? 'active' : ''}" data-select="TWO">Q01 + Q02</button>`;
  for (const button of document.querySelectorAll('[data-action]')) {
    const a = button.dataset.action;
    button.disabled = a === 'DISTRIBUTE' ? !exp || ['SCHEDULED','PLAYING','PAUSED'].includes(desired.phase) : a === 'PREPARE' ? !exp || !selected.every(id => state.devices.find(d => d.id === id)?.observed?.contentSha256 === exp.vr.sha256) || ['SCHEDULED','PLAYING','PAUSED'].includes(desired.phase) : a === 'PLAY' ? !state.preflight.ready || !selected.every(id => state.devices.find(d => d.id === id)?.observed?.playback === 'READY') || !['PREPARING', 'READY'].includes(desired.phase) : a === 'PAUSE' ? desired.phase !== 'PLAYING' : a === 'RESUME' ? desired.phase !== 'PAUSED' : a === 'RESYNC' ? !['PLAYING','SCHEDULED'].includes(desired.phase) : false;
  }
}
function connect() {
  socket = new WebSocket(`ws://${location.host}/ws/dashboard`);
  socket.onopen = () => { connected = true; document.body.classList.remove('offline'); $('#server-status').textContent = 'ONLINE'; };
  socket.onmessage = event => { try { render(JSON.parse(event.data)); } catch (e) { console.error(e); } };
  socket.onclose = () => { connected = false; document.body.classList.add('offline'); $('#server-status').textContent = 'OFFLINE'; setTimeout(connect, 1000); };
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
  try { await api('/api/experience', { eventName: form.get('eventName'), name: form.get('name'), file: form.get('file'), durationMs: Number(form.get('durationSeconds') || 0) * 1000 }); toast('Experiencia registrada y checksum calculado'); }
  catch (e) { toast(e.message, true); }
});
$('#refresh-files').addEventListener('click', loadFiles);
loadFiles(); connect();
