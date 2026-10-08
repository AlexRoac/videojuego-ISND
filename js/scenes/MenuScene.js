/**
 * MenuScene — Pantalla de inicio.
 * Muestra título, misión, leyenda de amenazas, controles, integrantes del
 * equipo y un campo (elemento DOM de Phaser) para el nombre del agente.
 */
class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    const { WIDTH: W } = CG.CONFIG;
    const T = CG.UI.txt;

    // Las escenas de juego capturan teclas (WASD, ESPACIO…). Las liberamos aquí
    // para poder escribir el nombre en el campo de texto sin restricciones.
    this.input.keyboard.clearCaptures();

    this.bg = CG.UI.grid(this);

    // Amenazas "flotando" de fondo (decorativo)
    this.floaters = [];
    ['malware', 'phishing', 'ransom', 'ddos', 'legit', 'malware', 'phishing'].forEach((k, i) => {
      const s = this.add.image(Phaser.Math.Between(40, W - 40), Phaser.Math.Between(180, 600), CG.THREATS[k].tex)
        .setAlpha(0.13).setDepth(-5).setScale(1.6);
      s.vx = Phaser.Math.FloatBetween(-18, 18) || 8;
      s.vy = Phaser.Math.FloatBetween(-12, 12);
      s.spin = (i % 2 ? 1 : -1) * 0.4;
      this.floaters.push(s);
    });

    // ---------------------------------------------------------------- título
    const title = T(this, W / 2, 56, 'CYBERGUARD', 58, '#22d3ee', { fontStyle: 'bold' })
      .setOrigin(0.5).setStroke('#0e7490', 6).setShadow(0, 0, '#22d3ee', 22, true, true);
    T(this, W / 2, 108, 'ISND  DEFENSE', 22, '#e879f9', { fontStyle: 'bold' }).setOrigin(0.5);
    T(this, W / 2, 136, 'Protege el centro de datos contra malware, phishing, DDoS y ransomware', 13, '#94a3b8').setOrigin(0.5);
    this.tweens.add({ targets: title, alpha: 0.82, duration: 1200, yoyo: true, repeat: -1 });

    this.add.image(W / 2 - 300, 66, 'player').setScale(1.3);
    this.add.image(W / 2 + 300, 66, 'server').setScale(0.7);

    // ------------------------------------------------------- panel de misión
    CG.UI.panel(this, 30, 158, 440, 214, 'MISIÓN');
    [
      'Eres un agente defensivo dentro del centro de datos',
      'de ISND. Protege los 4 servidores: si la INTEGRIDAD',
      'llega a 0 %, la red cae.',
      '',
      'N1  Vulnerabilidades y filtrado de malware',
      'N2  Ataque masivo DDoS (gestión de recursos)',
      'N3  Ransomware + jefe final «Zero-Day»',
      '',
      'Gana: completa las 3 misiones · Pierde: integridad 0 %',
    ].forEach((l, i) => T(this, 46, 186 + i * 19, l, 13, i >= 4 && i <= 6 ? '#67e8f9' : '#cbd5e1'));

    // --------------------------------------------------- panel de controles
    CG.UI.panel(this, 490, 158, 440, 214, 'CONTROLES', 0xd946ef);
    [
      ['WASD / Flechas', 'Mover al agente'],
      ['Clic izq. / ESPACIO', 'Destruir virus (apuntar: mouse)'],
      ['Clic der. / Q', 'Filtrar tráfico: pulso (30 BW)'],
      ['Mantener E', 'Parchear / mitigar / descifrar'],
      ['P / ESC', 'Pausa'],
      ['M', 'Silenciar / activar sonido'],
    ].forEach(([k, d], i) => {
      T(this, 506, 188 + i * 26, k, 13, '#f0abfc', { fontStyle: 'bold' });
      T(this, 690, 188 + i * 26, d, 12, '#cbd5e1');
    });
    T(this, 506, 346, 'Cada acción gasta ANCHO DE BANDA (BW), que se regenera con el tiempo.', 11, '#facc15');

    // --------------------------------------------------- leyenda de amenazas
    const legend = ['malware', 'phishing', 'ddos', 'ransom', 'legit'];
    legend.forEach((k, i) => {
      const x = 62 + i * 184;
      this.add.image(x, 396, CG.THREATS[k].tex).setScale(0.8);
      T(this, x + 22, 388, CG.THREATS[k].name, 12, k === 'legit' ? '#4ade80' : '#f8fafc', { fontStyle: 'bold' });
    });

    // ------------------------------------------- nombre + botones de acción
    T(this, 30, 440, 'AGENTE:', 15, '#22d3ee', { fontStyle: 'bold' });
    const input = this.add.dom(200, 452, 'input');
    input.node.className = 'cg-input';
    input.node.maxLength = 12;
    input.node.placeholder = 'Tu nombre';
    input.node.autocomplete = 'off';
    input.node.value = CG.playerName || '';
    this.nameInput = input.node;
    // ENTER dentro del campo: el teclado de Phaser no siempre recibe el evento con un <input> enfocado
    input.node.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.startGame(); });

    CG.UI.button(this, 440, 452, 170, 44, '▶ JUGAR', () => this.startGame(), 0x4ade80);
    CG.UI.button(this, 630, 452, 170, 44, '🏆 RANKING', () => this.scene.start('LeaderboardScene'), 0xfacc15);
    this.muteBtn = CG.UI.button(this, 830, 452, 150, 44, '', () => this.toggleSound(), 0x94a3b8);
    this.refreshMuteLabel();

    // ---------------------------------------------------------------- equipo
    CG.UI.panel(this, 30, 494, 900, 122, 'EQUIPO DE DESARROLLO', 0x4ade80);
    CG.CONFIG.TEAM.forEach((m, i) => {
      T(this, 46 + (i % 2) * 440, 522 + Math.floor(i / 2) * 22, '▸ ' + m, 13, '#e2e8f0');
    });
    T(this, 46, 574, CG.CONFIG.COURSE, 12, '#64748b');
    T(this, 46, 592, 'Tecnologías: Phaser 3 · Web Audio API · Tailwind CSS · Supabase/LocalStorage', 11, '#64748b');

    // ENTER inicia la partida (también desde el campo de texto)
    this.input.keyboard.on('keydown-ENTER', () => this.startGame());
  }

  refreshMuteLabel() {
    this.muteBtn.label.setText(CG.audio.isMuted() ? '🔇 SONIDO OFF' : '🔊 SONIDO ON');
  }

  toggleSound() {
    CG.audio.toggleMute();
    this.refreshMuteLabel();
  }

  startGame() {
    if (this.starting) return;
    this.starting = true;
    CG.audio.ensure();
    CG.playerName = CG.Leaderboard.sanitizeName(this.nameInput.value);
    try { localStorage.setItem('cg_player', CG.playerName); } catch (e) { /* ignorar */ }
    CG.audio.play('levelStart');
    this.scene.start('GameScene', {
      level: 1, score: 0, name: CG.playerName,
      stats: { kills: 0, patches: 0, legitHits: 0, shields: 0, levels: 0 },
    });
  }

  update(t, delta) {
    const dt = delta / 1000;
    this.bg.tilePositionX += 8 * dt;
    this.bg.tilePositionY += 4 * dt;
    this.floaters.forEach((s) => {
      s.x += s.vx * dt; s.y += s.vy * dt; s.rotation += s.spin * dt;
      if (s.x < -30) s.x = 990; if (s.x > 990) s.x = -30;
      if (s.y < 150) s.y = 620; if (s.y > 620) s.y = 150;
    });
  }
}
