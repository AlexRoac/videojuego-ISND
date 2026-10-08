/**
 * audio.js — Efectos de sonido y música sintetizados con la Web Audio API
 * ---------------------------------------------------------------------------
 * No se usa ningún archivo .mp3/.wav: cada sonido se genera en tiempo real
 * combinando OSCILADORES (tonos) y RUIDO BLANCO filtrado, con envolventes de
 * volumen (ataque/caída) para evitar "clics". Ventajas: cero descargas, cero
 * archivos faltantes y sonidos parametrizables.
 *
 * Nota: los navegadores bloquean el audio hasta que el usuario interactúa; por
 * eso el AudioContext se crea de forma perezosa en `ensure()`, que se invoca
 * desde el primer clic o tecla (ver game.js).
 */
CG.audio = (() => {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem('cg_muted') === '1'; } catch (e) { /* sin storage */ }

  let musicTimer = null;
  let musicStep = 0;
  let musicLevel = 1;

  /** Crea (o reanuda) el contexto de audio. Devuelve null si no hay soporte. */
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /** Tono con barrido de frecuencia opcional (f → to) y envolvente exponencial. */
  function tone({ f = 440, to = null, type = 'sine', d = 0.15, v = 0.2, delay = 0 }) {
    const c = ensure();
    if (!c || muted) return;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + d + 0.03);
  }

  /** Ráfaga de ruido blanco filtrado (explosiones, pulsos, estática). */
  function noise({ d = 0.2, v = 0.2, freq = 1200, to = null, type = 'lowpass', delay = 0 }) {
    const c = ensure();
    if (!c || muted) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filt = c.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(freq, t);
    if (to) filt.frequency.exponentialRampToValueAtTime(Math.max(to, 20), t + d);
    const g = c.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(filt);
    filt.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + d + 0.03);
  }

  /** Reproduce una lista de notas en secuencia (arpegios, fanfarrias). */
  function arp(freqs, step, opts = {}) {
    freqs.forEach((f, i) => tone({ f, delay: i * step, ...opts }));
  }

  // Biblioteca de efectos: cada entrada es una pequeña "receta" de síntesis
  const SFX = {
    shoot:     () => tone({ f: 920, to: 240, type: 'square', d: 0.09, v: 0.05 }),
    hit:       () => tone({ f: 300, to: 160, type: 'square', d: 0.07, v: 0.08 }),
    deflect:   () => { tone({ f: 1400, to: 900, type: 'triangle', d: 0.1, v: 0.1 }); noise({ d: 0.05, v: 0.06, freq: 4000, type: 'highpass' }); },
    explode:   () => { noise({ d: 0.22, v: 0.18, freq: 1800, to: 200 }); tone({ f: 170, to: 40, type: 'sine', d: 0.2, v: 0.18 }); },
    pulse:     () => { tone({ f: 180, to: 1300, type: 'sawtooth', d: 0.35, v: 0.09 }); noise({ d: 0.35, v: 0.09, freq: 400, to: 5000, type: 'bandpass' }); },
    patchTick: () => tone({ f: 660 + Math.random() * 120, type: 'sine', d: 0.05, v: 0.05 }),
    patchDone: () => arp([523, 659, 784, 1047], 0.07, { type: 'triangle', d: 0.18, v: 0.13 }),
    damage:    () => { tone({ f: 240, to: 70, type: 'sawtooth', d: 0.28, v: 0.16 }); noise({ d: 0.2, v: 0.1, freq: 900, to: 150 }); },
    warn:      () => { tone({ f: 880, type: 'square', d: 0.1, v: 0.07 }); tone({ f: 660, type: 'square', d: 0.1, v: 0.07, delay: 0.14 }); },
    error:     () => tone({ f: 140, type: 'sawtooth', d: 0.18, v: 0.1 }),
    event:     () => arp([392, 523, 392, 523], 0.11, { type: 'square', d: 0.1, v: 0.07 }),
    powerup:   () => arp([440, 554, 659, 880], 0.06, { type: 'triangle', d: 0.15, v: 0.12 }),
    levelStart:() => arp([262, 330, 392], 0.1, { type: 'triangle', d: 0.2, v: 0.12 }),
    boss:      () => { tone({ f: 60, to: 40, type: 'sawtooth', d: 1.2, v: 0.2 }); tone({ f: 90, to: 60, type: 'square', d: 1.2, v: 0.08 }); noise({ d: 1, v: 0.08, freq: 300, to: 100 }); },
    bossDie:   () => { for (let i = 0; i < 6; i++) noise({ d: 0.3, v: 0.16, freq: 2200, to: 150, delay: i * 0.16 }); tone({ f: 200, to: 30, type: 'sawtooth', d: 1.2, v: 0.18 }); },
    win:       () => arp([523, 659, 784, 1047, 784, 1047, 1319], 0.11, { type: 'triangle', d: 0.25, v: 0.15 }),
    lose:      () => arp([392, 349, 294, 220, 147], 0.18, { type: 'sawtooth', d: 0.3, v: 0.12 }),
    click:     () => tone({ f: 700, to: 500, type: 'square', d: 0.05, v: 0.06 }),
  };

  function play(name) {
    const fx = SFX[name];
    if (fx) fx();
  }

  // ---------------------------------------------------------------- música
  // Secuenciador minimalista: bajo en tonalidad menor + "hi-hat" de ruido.
  const BASS = [55, 0, 55, 65.4, 0, 55, 82.4, 73.4];
  const LEAD = [220, 0, 261.6, 0, 329.6, 0, 261.6, 196];

  function musicTick() {
    if (muted || !ctx) return;
    const i = musicStep % 8;
    if (BASS[i]) tone({ f: BASS[i], type: 'triangle', d: 0.22, v: 0.1 });
    if (i % 2 === 0) noise({ d: 0.04, v: 0.03, freq: 7000, type: 'highpass' });
    if (musicLevel >= 2 && LEAD[i]) tone({ f: LEAD[i], type: 'square', d: 0.12, v: 0.018 });
    if (musicLevel >= 3 && i % 4 === 2) tone({ f: BASS[i] * 4 || 220, type: 'sawtooth', d: 0.1, v: 0.02 });
    musicStep++;
  }

  function startMusic(level = 1) {
    stopMusic();
    musicLevel = level;
    musicStep = 0;
    const bpmMs = [190, 165, 140][level - 1] || 180;   // más rápido = más tensión
    musicTimer = setInterval(musicTick, bpmMs);
  }

  function stopMusic() {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null;
  }

  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem('cg_muted', muted ? '1' : '0'); } catch (e) { /* ignorar */ }
    ensure();
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  }

  return { ensure, play, startMusic, stopMusic, toggleMute, isMuted: () => muted };
})();
