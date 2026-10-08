(() => {
  const neutral = () => ({ x: 0, y: 0, ax: 0, ay: 0, fire: false, patch: false });
  CG.remote = { ...neutral(), connected: false };

  let channel;
  let heartbeat;
  let lastInput = 0;

  const button = document.createElement('button');
  button.textContent = '📱 Conectar celular';
  button.style.cssText = 'padding:8px;border:1px solid #22d3ee;border-radius:8px;color:#67e8f9;background:#0f172a;font-size:12px';
  document.querySelector('header').append(button);

  const dialog = document.createElement('dialog');
  dialog.style.cssText = 'background:#0f172a;color:#e2e8f0;border:1px solid #22d3ee;border-radius:16px;padding:24px;max-width:90vw;width:480px';
  dialog.innerHTML = '<h2 style="font-size:20px;color:#67e8f9">Control con celular</h2><p>La computadora y el celular pueden usar redes distintas. Ambos solo necesitan internet.</p><button id="remote-connect" style="padding:8px;border:1px solid #22d3ee;border-radius:8px">Generar enlace del mando</button><div id="remote-links" style="margin:16px 0;overflow-wrap:anywhere"></div><p id="remote-status" role="status">Esperando conexión…</p><button id="remote-close" style="margin-top:16px;padding:8px">Cerrar</button>';
  document.body.append(dialog);

  const status = dialog.querySelector('#remote-status');
  const links = dialog.querySelector('#remote-links');
  const connectButton = dialog.querySelector('#remote-connect');
  dialog.querySelector('#remote-close').onclick = () => dialog.close();

  function reset(message = 'Celular desconectado. Abre de nuevo el enlace para reconectar.') {
    Object.assign(CG.remote, neutral(), { connected: false });
    status.textContent = message;
  }

  function handleInput(input) {
    if (!input || typeof input !== 'object') return;
    const axis = value => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
    const safe = {
      x: axis(input.x), y: axis(input.y), ax: axis(input.ax), ay: axis(input.ay),
      fire: input.fire === true, patch: input.patch === true,
    };
    if (['pulse', 'pause', 'advance', 'mute'].includes(input.action)) safe.action = input.action;
    lastInput = Date.now();
    Object.assign(CG.remote, safe, { connected: true });
    status.textContent = '✓ Celular conectado. Ya puedes cerrar esta ventana y jugar.';

    const scene = CG.game?.scene.getScenes(true)[0];
    if (!scene) return;
    if (safe.action === 'advance') {
      if (scene.advance) scene.advance();
      else if (scene.startGame) scene.startGame();
      else if (scene.scene.key === 'GameOverScene' || scene.scene.key === 'VictoryScene') scene.scene.start('MenuScene');
    }
    if (safe.action === 'pause' && scene.togglePause) scene.togglePause();
    if (safe.action === 'pulse' && scene.state === 'playing') scene.firePulse();
    if (safe.action === 'mute') { CG.audio.toggleMute(); scene.refreshSoundLabel?.(); scene.refreshMuteLabel?.(); }
  }

  async function disconnectChannel() {
    clearInterval(heartbeat);
    heartbeat = null;
    if (channel) await channel.unsubscribe().catch(() => {});
    channel = null;
  }

  async function connect() {
    connectButton.disabled = true;
    links.replaceChildren();
    reset('Creando sesión segura…');
    await disconnectChannel();

    try {
      const config = CG.CONFIG.SUPABASE;
      if (!window.supabase?.createClient || !config.URL || !config.ANON_KEY) throw new Error('Supabase no está configurado');

      const bytes = crypto.getRandomValues(new Uint8Array(16));
      const room = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
      const client = window.supabase.createClient(config.URL, config.ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });

      channel = client
        .channel(`cyberguard:${room}`, { config: { broadcast: { ack: true } } })
        .on('broadcast', { event: 'input' }, message => handleInput(message.payload))
        .subscribe((subscriptionStatus, error) => {
          if (subscriptionStatus === 'SUBSCRIBED') {
            const url = new URL('controller.html', location.href);
            url.hash = new URLSearchParams({ room }).toString();
            const link = document.createElement('a');
            link.href = url.href;
            link.textContent = url.href;
            link.style.cssText = 'display:block;color:#67e8f9;margin-bottom:12px';
            links.replaceChildren(link);
            status.textContent = 'Abre este enlace en el celular; puede usar datos móviles u otra Wi-Fi.';
            clearInterval(heartbeat);
            const announce = () => channel?.send({ type: 'broadcast', event: 'host', payload: { online: true } });
            announce();
            heartbeat = setInterval(announce, 500);
          } else if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT') {
            console.error('Supabase Realtime:', subscriptionStatus, error);
            reset('No se pudo conectar con Supabase Realtime. Revisa tu conexión e inténtalo de nuevo.');
          }
        });
    } catch (error) {
      console.error('Control remoto:', error);
      links.textContent = 'No se pudo crear el enlace del mando. Revisa tu conexión a internet e inténtalo de nuevo.';
      status.textContent = 'No conectado';
    } finally {
      connectButton.disabled = false;
    }
  }

  connectButton.onclick = connect;
  button.onclick = () => { dialog.showModal(); if (!channel && !connectButton.disabled) connect(); };
  setInterval(() => {
    if (CG.remote.connected && Date.now() - lastInput > 1000) reset();
  }, 250);
  window.addEventListener('pagehide', disconnectChannel);
})();
