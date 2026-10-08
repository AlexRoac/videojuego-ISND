(() => {
  const neutral = () => ({ x: 0, y: 0, ax: 0, ay: 0, fire: false, patch: false });
  CG.remote = { ...neutral(), connected: false };
  let stream;
  let last = 0;
  const button = document.createElement('button');
  button.textContent = '📱 Conectar celular';
  button.style.cssText = 'padding:8px;border:1px solid #22d3ee;border-radius:8px;color:#67e8f9;background:#0f172a;font-size:12px';
  document.querySelector('header').append(button);
  const dialog = document.createElement('dialog');
  dialog.style.cssText = 'background:#0f172a;color:#e2e8f0;border:1px solid #22d3ee;border-radius:16px;padding:24px;max-width:90vw;width:480px';
  dialog.innerHTML = '<h2 style="font-size:20px;color:#67e8f9">Control con celular</h2><p>La computadora puede usar Wi-Fi y el celular datos móviles. Ambos necesitan internet y un servidor público.</p><label style="display:block;margin-top:12px" for="remote-server">Servidor público (si el juego está abierto localmente)</label><input id="remote-server" type="url" placeholder="https://tu-juego.onrender.com" style="width:100%;background:#020617;color:#e2e8f0;padding:8px;margin:8px 0"><button id="remote-connect" style="padding:8px;border:1px solid #22d3ee;border-radius:8px">Generar enlace del mando</button><div id="remote-links" style="margin:16px 0;overflow-wrap:anywhere"></div><p id="remote-status" role="status">Esperando conexión…</p><button id="remote-close" style="margin-top:16px;padding:8px">Cerrar</button>';
  document.body.append(dialog);
  dialog.querySelector('#remote-close').onclick = () => dialog.close();
  const status = dialog.querySelector('#remote-status');
  const reset = () => { Object.assign(CG.remote, neutral(), { connected: false }); status.textContent = 'Celular desconectado. Abre de nuevo el enlace para reconectar.'; };
  const serverInput = dialog.querySelector('#remote-server');
  try { serverInput.value = localStorage.getItem('cg_remote_server') || ''; } catch { /* almacenamiento opcional */ }
  const connectButton = dialog.querySelector('#remote-connect');
  async function connect() {
    const links = dialog.querySelector('#remote-links');
    connectButton.disabled = true;
    stream?.close();
    stream = null;
    reset();
    status.textContent = 'Conectando al servidor…';
    try {
      const base = serverInput.value.trim() ? new URL(serverInput.value.trim()).origin : location.origin;
      if (!/^https?:/.test(base)) throw new Error();
      if (serverInput.value.trim() && !base.startsWith('https://')) throw new Error();
      const response = await fetch(`${base}/api/room`, { method: 'POST', signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error();
      const room = await response.json();
      const addresses = await (await fetch(`${base}/api/addresses`, { signal: AbortSignal.timeout(10000) })).json();
      const bases = serverInput.value.trim() ? [base] : (addresses.addresses.length ? addresses.addresses : [base]);
      links.replaceChildren();
      bases.forEach(base => {
        const a = document.createElement('a');
        a.href = `${base}/controller.html?room=${room.id}&token=${room.token}`;
        a.textContent = a.href;
        a.style.cssText = 'display:block;color:#67e8f9;margin-bottom:12px';
        links.append(a);
      });
      if (!addresses.public && !serverInput.value.trim()) {
        const notice = document.createElement('p');
        notice.textContent = 'Estos enlaces son locales y solo funcionan en la misma red. Para usar datos móviles publica el servidor (ver README) y escribe arriba su dirección HTTPS.';
        links.prepend(notice);
      }
      try { localStorage.setItem('cg_remote_server', serverInput.value.trim()); } catch { /* opcional */ }
      status.textContent = 'Abre el enlace en el celular. No necesitas compartir la Wi-Fi si el servidor es público.';
      stream = new EventSource(`${base}/api/events?room=${room.id}&token=${room.token}`);
      stream.onerror = reset;
      stream.onmessage = event => {
        const input = JSON.parse(event.data);
        if (input.disconnected) return reset();
        last = Date.now();
        Object.assign(CG.remote, input, { connected: true });
        status.textContent = '✓ Celular conectado. Ya puedes cerrar esta ventana y jugar.';
        const scene = CG.game?.scene.getScenes(true)[0];
        if (!scene) return;
        if (input.action === 'advance') {
          if (scene.advance) scene.advance();
          else if (scene.startGame) scene.startGame();
          else if (scene.scene.key === 'GameOverScene' || scene.scene.key === 'VictoryScene') scene.scene.start('MenuScene');
        }
        if (input.action === 'pause' && scene.togglePause) scene.togglePause();
        if (input.action === 'pulse' && scene.state === 'playing') scene.firePulse();
        if (input.action === 'mute') { CG.audio.toggleMute(); scene.refreshSoundLabel?.(); scene.refreshMuteLabel?.(); }
      };
    } catch {
      links.textContent = 'No se pudo conectar. Para redes distintas escribe la dirección HTTPS del servidor publicado, o abre el juego desde esa dirección. Consulta README.md para publicarlo. Para pruebas locales ejecuta node server.cjs y abre http://localhost:5173.';
      status.textContent = 'No conectado';
    }
    finally { connectButton.disabled = false; }
  }
  connectButton.onclick = connect;
  button.onclick = () => { dialog.showModal(); if (!stream && !connectButton.disabled) connect(); };
  setInterval(() => { if (CG.remote.connected && Date.now() - last > 1000) reset(); }, 250);
})();
