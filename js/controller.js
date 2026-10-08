(() => {
  const room = new URLSearchParams(location.hash.slice(1)).get('room') || '';
  const state = { x: 0, y: 0, ax: 0, ay: 0, fire: false, patch: false, autoAim: false };
  const status = document.getElementById('status');
  const actions = [];
  let channel;
  let subscribed = false;
  let sending = false;
  let lastHost = 0;
  let autoFire = false;
  const heldPointers = { fire: new Set(), patch: new Set() };
  const autoFireButton = document.getElementById('autofire');
  const autoAimButton = document.getElementById('autoaim');

  function setAutoFire(enabled) {
    autoFire = enabled;
    state.fire = autoFire || heldPointers.fire.size > 0;
    autoFireButton.classList.toggle('active', autoFire);
    autoFireButton.setAttribute('aria-pressed', String(autoFire));
    autoFireButton.firstChild.textContent = `AUTO: ${autoFire ? 'ON' : 'OFF'}`;
  }

  function setAutoAim(enabled) {
    state.autoAim = enabled;
    autoAimButton.classList.toggle('active', enabled);
    autoAimButton.setAttribute('aria-pressed', String(enabled));
    autoAimButton.firstChild.textContent = `AIM: ${enabled ? 'ON' : 'OFF'}`;
  }

  async function send() {
    if (!subscribed || sending || document.hidden) return;
    sending = true;
    const action = actions.shift();
    try {
      const result = await channel.send({ type: 'broadcast', event: 'input', payload: { ...state, action } });
      if (result !== 'ok') throw new Error(String(result));
      status.textContent = Date.now() - lastHost < 1500 ? '✓ Conectado' : 'Abre el juego en la computadora';
    } catch {
      status.textContent = 'Sin conexión. Reintentando…';
    } finally {
      sending = false;
    }
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

  function reset() {
    Object.keys(state).forEach(key => { state[key] = typeof state[key] === 'boolean' ? false : 0; });
    Object.values(heldPointers).forEach(pointers => pointers.clear());
    setAutoFire(false);
    setAutoAim(false);
    actions.length = 0;
    document.querySelectorAll('.held').forEach(element => element.classList.remove('held'));
    document.querySelectorAll('.stick span').forEach(element => { element.style.transform = ''; });
    send();
  }

  stick('move', 'x', 'y');
  stick('aim', 'ax', 'ay');
  ['fire', 'patch'].forEach(key => {
    const button = document.getElementById(key);
    const pointers = heldPointers[key];
    button.onpointerdown = event => {
      pointers.add(event.pointerId);
      button.setPointerCapture(event.pointerId);
      state[key] = true;
      button.classList.add('held');
      send();
    };
    button.onpointerup = button.onpointercancel = button.onlostpointercapture = event => {
      pointers.delete(event.pointerId);
      state[key] = pointers.size > 0 || (key === 'fire' && autoFire);
      button.classList.toggle('held', pointers.size > 0);
      send();
    };
  });
  autoFireButton.onclick = () => { setAutoFire(!autoFire); send(); };
  autoAimButton.onclick = () => { setAutoAim(!state.autoAim); send(); };
  document.querySelectorAll('[data-action]').forEach(button => {
    button.onclick = () => { if (actions.length < 5) actions.push(button.dataset.action); send(); };
  });
  window.addEventListener('blur', reset);
  window.addEventListener('pagehide', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  document.getElementById('fullscreen').onclick = () => document.documentElement.requestFullscreen?.().catch(() => {
    status.textContent = 'Gira el celular para jugar en horizontal';
  });
  window.addEventListener('contextmenu', event => event.preventDefault());

  async function start() {
    const config = CG.CONFIG.SUPABASE;
    if (!room || !/^[a-f0-9]{32}$/.test(room)) {
      status.textContent = 'Enlace inválido. Genera uno nuevo desde el juego.';
      return;
    }
    if (!window.supabase?.createClient || !config.URL || !config.ANON_KEY) {
      status.textContent = 'El mando no está configurado.';
      return;
    }
    const client = window.supabase.createClient(config.URL, config.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    channel = client
      .channel(`cyberguard:${room}`, { config: { broadcast: { ack: true } } })
      .on('broadcast', { event: 'host' }, () => {
        lastHost = Date.now();
        status.textContent = '✓ Conectado';
      })
      .subscribe((subscriptionStatus, error) => {
        subscribed = subscriptionStatus === 'SUBSCRIBED';
        if (subscribed) { status.textContent = 'Abre el juego en la computadora'; send(); }
        if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT') {
          console.error('Supabase Realtime:', subscriptionStatus, error);
          status.textContent = 'Sin conexión. Recarga para reintentar.';
        }
      });
    setInterval(() => { if (!document.hidden) send(); }, 50);
  }

  start();
})();
