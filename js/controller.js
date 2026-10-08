(() => {
  const query = new URLSearchParams(location.search);
  const endpoint = `/api/input?room=${encodeURIComponent(query.get('room') || '')}&token=${encodeURIComponent(query.get('token') || '')}`;
  const state = { x: 0, y: 0, ax: 0, ay: 0, fire: false, patch: false };
  const status = document.getElementById('status');
  const actions = [];
  let sending = false;
  let blocked = false;
  async function send() {
    if (sending || blocked) return;
    sending = true;
    const action = actions.shift();
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...state, action }), signal: AbortSignal.timeout(2000) });
      if (!response.ok) { blocked = true; throw new Error(); }
      const result = await response.json();
      status.textContent = result.connected ? '✓ Conectado' : 'Abre el juego en la computadora';
    } catch { status.textContent = blocked ? 'Enlace inválido. Conecta de nuevo desde la computadora.' : 'Sin conexión. Reintentando…'; }
    finally { sending = false; }
  }
  function stick(id, xkey, ykey) {
    const element = document.getElementById(id);
    const knob = element.querySelector('span');
    let pointer;
    const update = event => {
      const r = element.getBoundingClientRect();
      let x = (event.clientX - r.left - r.width / 2) / (r.width * .32);
      let y = (event.clientY - r.top - r.height / 2) / (r.height * .32);
      const length = Math.hypot(x, y);
      if (length > 1) { x /= length; y /= length; }
      if (length < .12) x = y = 0;
      state[xkey] = x; state[ykey] = y;
      knob.style.transform = `translate(${x * r.width * .28}px,${y * r.height * .28}px)`;
    };
    element.onpointerdown = event => { if (pointer !== undefined) return; pointer = event.pointerId; element.setPointerCapture(pointer); update(event); };
    element.onpointermove = event => { if (event.pointerId === pointer) update(event); };
    const release = event => { if (event.pointerId !== pointer) return; pointer = undefined; state[xkey] = state[ykey] = 0; knob.style.transform = ''; };
    element.onpointerup = element.onpointercancel = element.onlostpointercapture = release;
  }
  stick('move', 'x', 'y'); stick('aim', 'ax', 'ay');
  ['fire', 'patch'].forEach(key => {
    const button = document.getElementById(key);
    const pointers = new Set();
    button.onpointerdown = event => { pointers.add(event.pointerId); button.setPointerCapture(event.pointerId); state[key] = true; button.classList.add('held'); };
    button.onpointerup = button.onpointercancel = button.onlostpointercapture = event => { pointers.delete(event.pointerId); state[key] = pointers.size > 0; button.classList.toggle('held', state[key]); };
  });
  document.querySelectorAll('[data-action]').forEach(button => { button.onclick = () => { if (actions.length < 5) actions.push(button.dataset.action); send(); }; });
  function reset() {
    Object.keys(state).forEach(key => { state[key] = typeof state[key] === 'boolean' ? false : 0; });
    actions.length = 0;
    document.querySelectorAll('.held').forEach(el => el.classList.remove('held'));
    document.querySelectorAll('.stick span').forEach(el => { el.style.transform = ''; });
    navigator.sendBeacon(endpoint, JSON.stringify(state));
  }
  window.addEventListener('blur', reset);
  window.addEventListener('pagehide', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  document.getElementById('fullscreen').onclick = () => { document.documentElement.requestFullscreen?.().catch(() => { status.textContent = 'Gira el celular para jugar en horizontal'; }); };
  window.addEventListener('contextmenu', event => event.preventDefault());
  setInterval(() => { if (!document.hidden) send(); }, 50);
  send();
})();
