/**
 * GameScene — Escena principal: bucle de juego de los 3 niveles.
 * ---------------------------------------------------------------------------
 * Una sola escena sirve para los tres niveles; lo que cambia es el objeto
 * `CG.LEVELS[n]` (ver levels.js). Organización del archivo:
 *
 *   1. Ciclo de vida     : init / create / update (bucle principal)
 *   2. Construcción      : fondo, servidores, jugador, grupos, FX, HUD, entrada
 *   3. Jugador           : movimiento, disparo, pulso (filtrar), parche
 *   4. Amenazas          : generación, movimiento, llegada, destrucción
 *   5. Servidores        : vulnerabilidades, infección, carga, drenaje
 *   6. Eventos y jefe    : oleadas DDoS, eventos dinámicos, jefe Zero-Day
 *   7. Interfaz          : HUD, banners, paneles de briefing / fin de nivel
 *   8. Fin de nivel      : victoria / derrota
 *
 * Técnicas de Phaser usadas: Arcade Physics (overlap/collider), grupos con
 * pool de objetos (balas), emisores de partículas, tweens, máscaras
 * geométricas (apagón) y cámaras (shake / flash).
 * Todos los temporizadores usan `dt` acumulado en update(), así la pausa
 * detiene el juego por completo de forma trivial.
 */
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  // ===========================================================================
  // 1. CICLO DE VIDA
  // ===========================================================================

  /** Recibe los datos del nivel anterior (o del menú). */
  init(data) {
    this.levelIdx = data.level || 1;
    this.cfg = CG.LEVELS[this.levelIdx - 1];
    this.score = data.score || 0;
    this.playerName = data.name || CG.playerName || 'AGENTE';
    this.stats = data.stats || { kills: 0, patches: 0, legitHits: 0, shields: 0, levels: 0 };
  }

  create() {
    const C = CG.CONFIG;
    this.W = C.WIDTH;
    this.H = C.HEIGHT;
    this.P = C.PLAYER;

    // ---- Estado de la partida ----
    this.state = 'briefing';          // briefing | playing | paused | ending
    this.integrity = 100;             // % de integridad del servidor (vidas)
    this.bw = this.P.bwMax;           // ancho de banda (recurso)
    this.elapsed = 0;                 // segundos jugados en el nivel
    this.phase = 'main';              // main | boss (solo nivel 3)
    this.bossElapsed = 0;
    this.combo = 0;
    this.comboT = 0;
    this.fireCd = 0;
    this.pulseCd = 0;
    this.stunT = 0;
    this.invulnT = 0;
    this.alarmT = 0;
    this.spawnT = {};
    this.waveQueue = [];
    this.waveState = {};
    this.waveTarget = null;
    this.patchProg = 0;
    this.patchTarget = null;
    this.usingMouse = false;
    this.aim = 0;
    this.activeEvent = null;
    this.eventT = 14;
    this.boss = null;
    this.canContinue = false;

    this.physics.world.setBounds(0, C.HUD_H, this.W, this.H - C.HUD_H);
    this.input.mouse.disableContextMenu();

    this.buildBackground();
    this.buildServers();
    this.buildPlayer();
    this.buildGroups();
    this.buildFX();
    this.buildHUD();
    this.buildInput();

    this.vulnT = this.cfg.vuln ? this.cfg.vuln.first : 0;

    this.events.once('shutdown', () => {
      CG.audio.stopMusic();
      this.input.keyboard.clearCaptures();
    });

    this.showBriefing();
  }

  /** Bucle principal: se ejecuta ~60 veces por segundo. */
  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;   // limitar picos de lag
    this.time_ = time;
    this.bg.tilePositionY -= 6 * dt;

    if (this.state === 'briefing' || this.state === 'paused') return;

    if (this.state === 'ending') {
      this.drawWorld(time);
      this.updateHUD();
      return;
    }

    // ---- state === 'playing' ----
    this.elapsed += dt;
    if (this.phase === 'boss') this.bossElapsed += dt;

    this.updatePlayer(dt);
    this.tryFire(dt);
    this.updatePatch(dt);
    this.updateSpawns(dt);
    this.updateWaves(dt);
    this.updateThreats(dt);
    this.updateBolts(dt);
    this.updateBullets();
    this.updateServers(dt);
    this.updateEvents(dt);
    this.updateBoss(dt);
    this.updateResources(dt);

    this.drawWorld(time);
    this.updateHUD();
    this.checkEnd();
  }

  // ===========================================================================
  // 2. CONSTRUCCIÓN DE LA ESCENA
  // ===========================================================================

  buildBackground() {
    const C = CG.CONFIG;
    this.bg = CG.UI.grid(this);
    // Marco de la zona de juego
    this.add.rectangle(2, C.HUD_H + 2, this.W - 4, this.H - C.HUD_H - 4)
      .setOrigin(0).setStrokeStyle(2, 0x1b4a7a, 0.7).setDepth(1);
  }

  buildServers() {
    const C = CG.CONFIG;
    this.serverGroup = this.physics.add.staticGroup();
    this.servers = C.SERVER_POS.map((p, i) => {
      const spr = this.serverGroup.create(p.x, p.y, 'server').setDepth(3);
      spr.refreshBody();
      spr.body.setSize(56, 64);
      const label = CG.UI.txt(this, p.x, p.y + 52, 'OK', 12, '#4ade80', { fontStyle: 'bold' })
        .setOrigin(0.5, 0).setDepth(61);
      this.add.text(p.x, p.y - 58, `SRV-0${i + 1}`, { fontFamily: C.FONT, fontSize: '11px', color: '#64748b' })
        .setOrigin(0.5).setDepth(3);
      return {
        id: i, x: p.x, y: p.y, spr, label,
        vuln: false, vulnT: 0,      // vulnerabilidad sin parchear (cuenta atrás)
        infected: false,            // infectado: drena integridad
        locked: false,              // cifrado por ransomware
        load: 0, overloaded: false, // carga DDoS
      };
    });
  }

  buildPlayer() {
    this.player = this.physics.add.image(this.W / 2, this.H / 2 + 20, 'player').setDepth(8);
    this.player.setCircle(17, 7, 7);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.serverGroup);

    // Estela de partículas detrás del agente
    this.trail = this.add.particles(0, 0, 'spark', {
      follow: this.player, lifespan: 320, scale: { start: 0.7, end: 0 },
      alpha: { start: 0.5, end: 0 }, tint: CG.CONFIG.COLOR.cyan, frequency: 45, blendMode: 'ADD',
    }).setDepth(7);
  }

  buildGroups() {
    this.bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 60 });   // pool
    this.threats = this.physics.add.group();
    this.bolts = this.physics.add.group();

    // Colisiones/solapamientos gestionados por Arcade Physics
    this.physics.add.overlap(this.bullets, this.threats, (b, t) => this.onBulletHitThreat(b, t));
    this.physics.add.overlap(this.bullets, this.bolts, (b, o) => this.onBulletHitBolt(b, o));
    this.physics.add.overlap(this.player, this.threats, (p, t) => this.onPlayerHitThreat(t));
    this.physics.add.overlap(this.player, this.bolts, (p, o) => this.onPlayerHitBolt(o));
  }

  buildFX() {
    // Un emisor persistente por color; se usan con explode(n, x, y)
    const mk = (tint) => this.add.particles(0, 0, 'spark', {
      speed: { min: 50, max: 230 }, angle: { min: 0, max: 360 },
      lifespan: { min: 250, max: 650 }, scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 }, tint, blendMode: 'ADD', emitting: false,
    }).setDepth(20);
    this.fx = {
      red: mk(0xff3b5c), yellow: mk(0xfacc15), cyan: mk(0x22d3ee), green: mk(0x4ade80),
      purple: mk(0xd946ef), orange: mk(0xfb923c), pink: mk(0xf472b6), white: mk(0xffffff),
    };

    // Overlay de apagón (evento del nivel 3) con "linterna" alrededor del agente
    this.dark = this.add.rectangle(0, 0, this.W, this.H, 0x000000, 0.9).setOrigin(0).setDepth(50).setVisible(false);
    this.maskG = this.make.graphics({ add: false });
    this.darkMask = this.maskG.createGeometryMask();
    this.darkMask.invertAlpha = true;
    this.dark.setMask(this.darkMask);

    // Viñeta roja cuando la integridad es crítica
    this.warnRect = this.add.rectangle(0, CG.CONFIG.HUD_H, this.W, this.H, 0xff0000, 0).setOrigin(0).setDepth(90);
  }

  buildHUD() {
    const C = CG.CONFIG;
    const T = CG.UI.txt;
    this.add.rectangle(0, 0, this.W, C.HUD_H, 0x050b18, 0.96).setOrigin(0).setDepth(99);
    this.add.rectangle(0, C.HUD_H, this.W, 2, 0x1b4a7a, 1).setOrigin(0).setDepth(99);
    this.hudGfx = this.add.graphics().setDepth(100);
    this.uiGfx = this.add.graphics().setDepth(60);   // barras de servidores, anillos, escudo

    const lab = (x, s) => T(this, x, 6, s, 11, '#64748b', { fontStyle: 'bold' }).setDepth(101);
    lab(16, 'INTEGRIDAD DEL SERVIDOR');
    lab(262, 'ANCHO DE BANDA');
    lab(472, 'PUNTAJE');
    lab(640, 'TIEMPO');
    this.hud = {
      integrity: T(this, 20, 27, '', 12, '#ffffff', { fontStyle: 'bold' }).setDepth(101),
      bw: T(this, 266, 27, '', 12, '#ffffff', { fontStyle: 'bold' }).setDepth(101),
      score: T(this, 472, 20, '', 24, '#fde047', { fontStyle: 'bold' }).setDepth(101),
      combo: T(this, 590, 26, '', 13, '#f0abfc', { fontStyle: 'bold' }).setDepth(101),
      time: T(this, 640, 20, '', 24, '#e2e8f0', { fontStyle: 'bold' }).setDepth(101),
      level: T(this, this.W - 14, 8, `NIVEL ${this.levelIdx}`, 14, '#22d3ee', { fontStyle: 'bold' }).setOrigin(1, 0).setDepth(101),
      sound: T(this, this.W - 14, 30, '', 11, '#64748b').setOrigin(1, 0).setDepth(101),
      event: T(this, this.W / 2, this.H - 38, '', 14, '#facc15', { fontStyle: 'bold' }).setOrigin(0.5).setDepth(101),
      hint: T(this, 12, this.H - 18,
        'WASD mover · Clic/ESPACIO disparar · Q/Clic der. filtrar · Mantén E parchear · P pausa · M sonido',
        11, '#475569').setDepth(101),
    };

    // Banner central de anuncios
    this.banner = T(this, this.W / 2, 150, '', 34, '#22d3ee', { fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(110).setAlpha(0).setStroke('#000000', 5);
    this.bannerSub = T(this, this.W / 2, 186, '', 15, '#e2e8f0')
      .setOrigin(0.5).setDepth(110).setAlpha(0).setStroke('#000000', 4);

    // Indicador "Mantén E" sobre el servidor cercano
    this.hintText = T(this, 0, 0, 'Mantén E', 12, '#ffffff', { fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(62).setVisible(false).setStroke('#000000', 3);
  }

  buildInput() {
    const kb = this.input.keyboard;
    // `false` = no capturar (no bloquear) las teclas de letras en el navegador
    this.keys = kb.addKeys({
      up: 'W', down: 'S', left: 'A', right: 'D',
      up2: 'UP', down2: 'DOWN', left2: 'LEFT', right2: 'RIGHT',
      fire: 'SPACE', patch: 'E',
    }, false);
    kb.addCapture('SPACE,UP,DOWN,LEFT,RIGHT');   // evita el scroll de la página

    kb.on('keydown-Q', () => this.state === 'playing' && this.firePulse());
    kb.on('keydown-E', () => this.state === 'playing' && !this.patchTarget && this.patchHint());
    kb.on('keydown-P', () => this.togglePause());
    kb.on('keydown-ESC', () => this.togglePause());
    kb.on('keydown-M', () => { CG.audio.toggleMute(); this.refreshSoundLabel(); });
    kb.on('keydown-SPACE', () => this.advance());
    kb.on('keydown-ENTER', () => this.advance());

    this.input.on('pointermove', () => { this.usingMouse = true; });
    this.input.on('pointerdown', (p) => {
      if (this.state === 'playing' && p.rightButtonDown()) this.firePulse();
      else this.advance();
    });
    this.refreshSoundLabel();
  }

  refreshSoundLabel() {
    this.hud.sound.setText(CG.audio.isMuted() ? '[M] SONIDO OFF' : '[M] SONIDO ON');
  }

  // ===========================================================================
  // 3. JUGADOR
  // ===========================================================================

  updatePlayer(dt) {
    const k = this.keys;
    let vx = 0; let vy = 0;
    if (k.left.isDown || k.left2.isDown) vx -= 1;
    if (k.right.isDown || k.right2.isDown) vx += 1;
    if (k.up.isDown || k.up2.isDown) vy -= 1;
    if (k.down.isDown || k.down2.isDown) vy += 1;
    const remote = CG.remote;
    if (remote?.connected) { vx += remote.x; vy += remote.y; }
    const len = Math.hypot(vx, vy);
    if (len > 0) { vx /= len; vy /= len; }

    if (this.stunT > 0) this.stunT -= dt;
    if (this.invulnT > 0) this.invulnT -= dt;
    const spd = this.P.speed * (this.stunT > 0 ? 0.4 : 1);
    this.player.setVelocity(vx * spd, vy * spd);

    // Apuntado asistido del mando; si no hay objetivo, conserva el control manual.
    const autoTarget = remote?.connected && remote.autoAim ? this.findAutoAimTarget() : null;
    if (autoTarget) {
      this.aim = Phaser.Math.Angle.Between(this.player.x, this.player.y, autoTarget.x, autoTarget.y);
    } else if (remote?.connected && Math.hypot(remote.ax, remote.ay) > 0.12) {
      this.aim = Math.atan2(remote.ay, remote.ax);
    } else if (remote?.connected && len > 0) {
      this.aim = Math.atan2(vy, vx);
    } else if (this.usingMouse && !remote?.connected) {
      const ptr = this.input.activePointer;
      this.aim = Phaser.Math.Angle.Between(this.player.x, this.player.y, ptr.worldX, ptr.worldY);
    } else if (len > 0) {
      this.aim = Math.atan2(vy, vx);
    }
    this.player.rotation = this.aim;
    this.player.setAlpha(this.invulnT > 0 ? (Math.floor(this.time_ / 80) % 2 ? 0.4 : 1) : 1);
    this.trail.emitting = len > 0;
  }

  /** Objetivo hostil más cercano para el apuntado asistido; nunca el tráfico legítimo. */
  findAutoAimTarget() {
    let best = null;
    let bestDistance = Infinity;
    const consider = (target) => {
      if (!target?.active) return;
      const dx = target.x - this.player.x;
      const dy = target.y - this.player.y;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) { best = target; bestDistance = distance; }
    };

    this.threats.getChildren().forEach((threat) => {
      if (threat.kind !== 'legit') consider(threat);
    });
    this.bolts.getChildren().forEach(consider);
    if (this.boss?.ready && this.boss.shield <= 0) consider(this.boss);
    return best;
  }

  /** Acción "Destruir virus": dispara un proyectil hacia el mouse. */
  tryFire(dt) {
    this.fireCd -= dt;
    this.pulseCd -= dt;
    const wants = this.keys.fire.isDown || this.input.activePointer.leftButtonDown() || (CG.remote?.connected && CG.remote.fire);
    if (!wants || this.fireCd > 0) return;
    if (this.bw < this.P.bulletCost) { this.noBandwidth(); return; }

    this.bw -= this.P.bulletCost;
    this.fireCd = this.P.fireRate;
    const cos = Math.cos(this.aim);
    const sin = Math.sin(this.aim);
    const b = this.bullets.get(this.player.x, this.player.y, 'bullet');
    if (!b) return;
    b.enableBody(true, this.player.x + cos * 26, this.player.y + sin * 26, true, true);
    b.setDepth(6).setRotation(this.aim);
    b.body.setCircle(5, 4, -2);
    b.setVelocity(cos * this.P.bulletSpeed, sin * this.P.bulletSpeed);
    CG.audio.play('shoot');
  }

  /** Desactiva las balas que salen de la zona de juego (devolverlas al pool). */
  updateBullets() {
    const top = CG.CONFIG.HUD_H;
    this.bullets.getChildren().forEach((b) => {
      if (b.active && (b.x < -10 || b.x > this.W + 10 || b.y < top - 10 || b.y > this.H + 10)) {
        b.disableBody(true, true);
      }
    });
  }

  /** Acción "Filtrar tráfico": pulso de área que destruye amenazas cercanas. */
  firePulse() {
    if (this.pulseCd > 0) return;
    if (this.bw < this.P.pulseCost) { this.noBandwidth(); return; }
    this.bw -= this.P.pulseCost;
    this.pulseCd = this.P.pulseCooldown;
    CG.audio.play('pulse');

    const R = this.P.pulseRadius;
    const { x, y } = this.player;
    const ring = this.add.circle(x, y, 10, 0x22d3ee, 0.18).setStrokeStyle(3, 0x67e8f9, 1).setDepth(19);
    this.tweens.add({
      targets: ring, scale: R / 10, alpha: 0, duration: 380, ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });

    this.threats.getChildren().slice().forEach((t) => {
      if (!t.active || Phaser.Math.Distance.Between(x, y, t.x, t.y) > R + 10) return;
      if (t.kind === 'legit') { this.floatText(t.x, t.y - 12, 'PERMITIDO', '#4ade80'); return; }
      t.hp -= 2;
      if (t.hp <= 0) this.killThreat(t); else this.flash(t);
    });
    this.bolts.getChildren().slice().forEach((o) => {
      if (o.active && Phaser.Math.Distance.Between(x, y, o.x, o.y) <= R + 10) {
        this.burst('purple', o.x, o.y, 8);
        o.destroy();
      }
    });
    if (this.boss && this.boss.ready && Phaser.Math.Distance.Between(x, y, this.boss.x, this.boss.y) < R + 75) {
      this.bossShieldHit();
    }
  }

  /**
   * Acción "Parchear / mitigar / descifrar" (mantener E cerca de un servidor).
   * Prioridad: cifrado > infectado > vulnerable > carga alta.
   */
  updatePatch(dt) {
    // Servidor más cercano que necesite atención y esté a rango
    let best = null; let bd = Infinity;
    this.servers.forEach((s) => {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, s.x, s.y);
      const needs = s.locked || s.infected || s.vuln || s.load > 8;
      if (needs && d <= this.P.patchRange && d < bd) { best = s; bd = d; }
    });
    if (best !== this.patchTarget) this.patchProg = 0;
    this.patchTarget = best;

    const holding = this.keys.patch.isDown || (CG.remote?.connected && CG.remote.patch);
    if (!best || !holding) {
      this.patchProg = Math.max(0, this.patchProg - dt * 0.4);   // el progreso se pierde despacio
      return;
    }
    // Sin ancho de banda no se bloquea la acción: solo se hace más lenta (40 %)
    const rate = this.bw > 0 ? 1 : 0.4;
    if (rate < 1) this.noBandwidth();

    // Mitigar carga DDoS (continuo)
    if (!best.locked && !best.infected && !best.vuln) {
      best.load = Math.max(0, best.load - 40 * dt * rate);
      this.bw = Math.max(0, this.bw - 5 * dt);
      if (Math.random() < dt * 8) CG.audio.play('patchTick');
      if (best.load < 40) best.overloaded = false;
      return;
    }

    // Parche con barra de progreso
    const need = best.locked ? 2.4 : best.infected ? 1.6 : 1.0;
    this.patchProg += dt * rate;
    this.bw = Math.max(0, this.bw - (this.P.patchCost / need) * dt);
    if (Math.random() < dt * 10) CG.audio.play('patchTick');
    if (this.patchProg < need) return;

    const wasLocked = best.locked;
    best.locked = false; best.infected = false; best.vuln = false;
    this.patchProg = 0;
    this.integrity = Math.min(100, this.integrity + 5);
    this.stats.patches++;
    this.addScore(wasLocked ? 80 : 50, best.x, best.y - 40, false);
    this.burst('green', best.x, best.y, 22);
    CG.audio.play('patchDone');
    this.floatText(best.x, best.y - 62, wasLocked ? 'DESCIFRADO ✔' : 'PARCHEADO ✔', '#4ade80');
  }

  /** Feedback al pulsar E sin estar al alcance de ningún servidor. */
  patchHint() {
    let near = null; let bd = Infinity;
    this.servers.forEach((s) => {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, s.x, s.y);
      if ((s.locked || s.infected || s.vuln || s.load > 8) && d < bd) { near = s; bd = d; }
    });
    const msg = near ? `Acércate a SRV-0${near.id + 1} y mantén E` : 'Ningún servidor necesita atención';
    this.floatText(this.player.x, this.player.y - 34, msg, near ? '#facc15' : '#94a3b8');
  }

  /** Regeneración de ancho de banda (modificada por eventos dinámicos). */
  updateResources(dt) {
    const ev = this.activeEvent ? this.activeEvent.type : null;
    const regen = this.P.bwRegen * (ev === 'drain' ? 0 : ev === 'boost' ? 2.5 : 1);
    this.bw = Math.min(this.P.bwMax, this.bw + regen * dt);
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    if (this.integrity < 30) {
      this.alarmT -= dt;
      if (this.alarmT <= 0) { CG.audio.play('warn'); this.alarmT = 1.6; }
    }
  }

  noBandwidth() {
    if (this.noBwT && this.time_ - this.noBwT < 600) return;
    this.noBwT = this.time_;
    CG.audio.play('error');
    this.floatText(this.player.x, this.player.y - 34, 'SIN ANCHO DE BANDA', '#f87171');
  }

  // ===========================================================================
  // 4. AMENAZAS
  // ===========================================================================

  /** Punto de aparición sobre un borde: 0=N, 1=E, 2=S, 3=O. */
  edgePoint(side) {
    const top = CG.CONFIG.HUD_H;
    switch (side) {
      case 0: return { x: Phaser.Math.Between(30, this.W - 30), y: top + 8 };
      case 1: return { x: this.W - 8, y: Phaser.Math.Between(top + 20, this.H - 20) };
      case 2: return { x: Phaser.Math.Between(30, this.W - 30), y: this.H - 8 };
      default: return { x: 8, y: Phaser.Math.Between(top + 20, this.H - 20) };
    }
  }

  progress() {
    return this.phase === 'boss' ? 1 : Math.min(1, this.elapsed / this.cfg.duration);
  }

  spawnThreat(kind, side, target, at) {
    const def = CG.THREATS[kind];
    const p = at || this.edgePoint(side === undefined ? Phaser.Math.Between(0, 3) : side);
    const t = this.threats.create(p.x, p.y, def.tex);
    t.kind = kind;
    t.hp = def.hp;
    t.age = 0;
    t.wob = Math.random() * Math.PI * 2;
    t.spd = Phaser.Math.FloatBetween(def.speed[0], def.speed[1]) * this.cfg.speedMul * (1 + 0.15 * this.progress());
    t.target = target || Phaser.Utils.Array.GetRandom(this.servers);
    t.setDepth(5);
    const r = Math.max(6, Math.min(t.width, t.height) / 2 - 3);
    t.body.setCircle(r, t.width / 2 - r, t.height / 2 - r);
    return t;
  }

  /** Genera amenazas periódicamente según la configuración del nivel. */
  updateSpawns(dt) {
    if (this.phase === 'boss' && !this.boss.ready) return;
    const table = this.phase === 'boss' ? this.cfg.bossSpawn : this.cfg.spawn;
    if (!table) return;
    const ramp = 1 - 0.4 * this.progress();       // ritmo creciente dentro del nivel
    Object.keys(table).forEach((kind) => {
      const every = table[kind].every;
      if (this.spawnT[kind] === undefined) this.spawnT[kind] = every * 0.5;
      this.spawnT[kind] -= dt;
      if (this.spawnT[kind] <= 0) {
        this.spawnThreat(kind);
        this.spawnT[kind] = every * ramp * Phaser.Math.FloatBetween(0.8, 1.2);
      }
    });
  }

  /** Movimiento de cada amenaza hacia su servidor objetivo. */
  updateThreats(dt) {
    this.threats.getChildren().slice().forEach((t) => {
      if (!t.active) return;
      t.age += dt;
      const s = t.target;
      const dx = s.x - t.x; const dy = s.y - t.y;
      const d = Math.hypot(dx, dy);
      if (d < 40) { this.threatArrives(t); return; }
      let vx = (dx / d) * t.spd;
      let vy = (dy / d) * t.spd;
      if (t.kind === 'phishing') {                 // zigzag senoidal (perpendicular)
        const w = Math.sin(t.age * 5 + t.wob) * t.spd * 0.9;
        vx += (-dy / d) * w; vy += (dx / d) * w;
      }
      t.setVelocity(vx, vy);
      if (t.kind === 'malware') t.rotation += dt * 3;
      else if (t.kind === 'ddos') t.rotation += dt * 6;
    });
  }

  /** Efecto de cada amenaza al alcanzar el servidor. */
  threatArrives(t) {
    const s = t.target;
    switch (t.kind) {
      case 'malware':
        this.damage(6, s.x, s.y, '-6 %');
        if (this.levelIdx === 1 && !s.infected && Math.random() < 0.15) this.infect(s);
        break;
      case 'phishing':
        this.damage(3, s.x, s.y, 'Credenciales robadas');
        this.bw = Math.max(0, this.bw - 20);
        this.floatText(s.x, s.y - 50, '-20 BW', '#facc15');
        break;
      case 'ddos':
        s.load = Math.min(100, s.load + 6);
        this.burst('pink', t.x, t.y, 4);
        break;
      case 'ransom':
        if (!s.locked) {
          s.locked = true;
          this.announce('🔒 SERVIDOR CIFRADO', '#fb923c', `SRV-0${s.id + 1}: acércate y mantén E para descifrar`);
          CG.audio.play('warn');
        }
        this.burst('orange', s.x, s.y, 20);
        break;
      case 'legit':
        this.bw = Math.min(this.P.bwMax, this.bw + 3);
        this.score += 2;
        this.floatText(s.x, s.y - 40, '+2 tráfico OK', '#4ade80');
        break;
      default: break;
    }
    t.destroy();
  }

  infect(s) {
    s.infected = true; s.vuln = false;
    this.announce('☣ SERVIDOR INFECTADO', '#ff3b5c', `SRV-0${s.id + 1}: parchéalo con E`);
  }

  /** Proyectil del jugador impacta una amenaza. */
  onBulletHitThreat(b, t) {
    if (!b.active || !t.active) return;
    b.disableBody(true, true);
    if (t.kind === 'legit') {                       // ¡error del jugador!
      this.stats.legitHits++;
      this.combo = 0;
      this.score = Math.max(0, this.score - 25);
      this.damage(4, t.x, t.y, 'Tráfico legítimo bloqueado −25');
      this.burst('green', t.x, t.y, 8);
      t.destroy();
      return;
    }
    t.hp--;
    if (t.hp <= 0) this.killThreat(t);
    else { this.flash(t); CG.audio.play('hit'); }
  }

  onPlayerHitThreat(t) {
    if (!t.active || t.kind === 'legit' || this.invulnT > 0) return;
    this.bw = Math.max(0, this.bw - 12);
    this.stunT = 0.4;
    this.invulnT = 0.5;
    this.floatText(this.player.x, this.player.y - 30, '-12 BW', '#f87171');
    this.burst(CG.THREATS[t.kind].fx, t.x, t.y, 10);
    CG.audio.play('damage');
    t.destroy();
  }

  /** Destrucción de una amenaza: puntaje con combo, partículas y sonido. */
  killThreat(t) {
    const def = CG.THREATS[t.kind];
    this.stats.kills++;
    this.addScore(def.score, t.x, t.y, true);
    this.bw = Math.min(this.P.bwMax, this.bw + 1.5);
    this.burst(def.fx, t.x, t.y, t.kind === 'ddos' ? 6 : 16);
    CG.audio.play('explode');
    t.destroy();
  }

  flash(sprite) {
    sprite.setTint(0xffffff);
    this.time.delayedCall(70, () => sprite.active && sprite.clearTint());
  }

  // ===========================================================================
  // 5. SERVIDORES
  // ===========================================================================

  updateServers(dt) {
    let drain = 0;
    this.servers.forEach((s) => {
      if (s.vuln) {
        s.vulnT -= dt;
        if (s.vulnT <= 0) this.infect(s);        // no se parcheó a tiempo
      }
      if (s.infected) drain += 1.0;
      if (s.locked) drain += 2.0;
      if (s.load > 0) s.load = Math.max(0, s.load - 3 * dt);
      if (!s.overloaded && s.load >= 100) {
        s.overloaded = true;
        this.announce('🔥 SOBRECARGA', '#fb923c', `SRV-0${s.id + 1} colapsando: mitígalo con E`);
        CG.audio.play('warn');
      }
      if (s.overloaded) {
        drain += 2.5;
        if (s.load < 40) s.overloaded = false;
      }
    });
    if (drain > 0) this.integrity = Math.max(0, this.integrity - drain * dt);

    // Aparición de nuevas vulnerabilidades
    if (this.cfg.vuln && this.phase === 'main') {
      this.vulnT -= dt;
      if (this.vulnT <= 0) {
        const clean = this.servers.filter((s) => !s.vuln && !s.infected && !s.locked);
        if (clean.length) {
          const s = Phaser.Utils.Array.GetRandom(clean);
          s.vuln = true; s.vulnT = this.cfg.vuln.deadline;
          CG.audio.play('warn');
          this.floatText(s.x, s.y - 62, '⚠ VULNERABILIDAD', '#facc15');
        }
        this.vulnT = this.cfg.vuln.every;
      }
    }
  }

  /** Resta integridad con sacudida de cámara y sonido. */
  damage(n, x, y, msg) {
    this.integrity = Math.max(0, this.integrity - n);
    if (n >= 3) this.cameras.main.shake(120, 0.004);
    CG.audio.play('damage');
    this.burst('red', x, y, 10);
    if (msg) this.floatText(x, y - 44, msg, '#f87171');
  }

  // ===========================================================================
  // 6. OLEADAS DDoS, EVENTOS DINÁMICOS Y JEFE
  // ===========================================================================

  /** Nivel 2: oleadas masivas anunciadas 3 s antes y dirigidas a un servidor. */
  updateWaves(dt) {
    if (!this.cfg.waves) return;
    const SIDES = ['NORTE', 'ESTE', 'SUR', 'OESTE'];
    this.cfg.waves.forEach((w, i) => {
      const st = this.waveState[i] || (this.waveState[i] = {});
      if (!st.warned && this.elapsed >= w.at - 3) {
        st.warned = true;
        st.side = Phaser.Math.Between(0, 3);
        st.target = Phaser.Utils.Array.GetRandom(this.servers);
        this.waveTarget = { s: st.target, t: 8 };
        this.announce('⚠ OLEADA DDoS INMINENTE', '#f472b6',
          `Desde el ${SIDES[st.side]} hacia SRV-0${st.target.id + 1} — ¡prepara el pulso FILTRAR!`);
        CG.audio.play('event');
      }
      if (!st.fired && this.elapsed >= w.at) {
        st.fired = true;
        this.waveQueue.push({ side: st.side, target: st.target, left: w.count, t: 0 });
      }
    });

    // Cola de generación escalonada (un paquete cada 90 ms)
    this.waveQueue.forEach((q) => {
      q.t -= dt;
      while (q.t <= 0 && q.left > 0) {
        this.spawnThreat('ddos', q.side, q.target);
        q.left--; q.t += 0.09;
      }
    });
    this.waveQueue = this.waveQueue.filter((q) => q.left > 0);
    if (this.waveTarget) { this.waveTarget.t -= dt; if (this.waveTarget.t <= 0) this.waveTarget = null; }
  }

  /** Nivel 3: eventos aleatorios que cambian las reglas temporalmente. */
  updateEvents(dt) {
    if (!this.cfg.events) return;
    if (this.activeEvent) {
      this.activeEvent.t -= dt;
      this.hud.event.setText(`${this.activeEvent.label}  ${Math.ceil(this.activeEvent.t)}s`);
      if (this.activeEvent.type === 'blackout') {
        this.maskG.clear().fillStyle(0xffffff).fillCircle(this.player.x, this.player.y, 130);
      }
      if (this.activeEvent.t <= 0) this.endEvent();
    } else {
      this.eventT -= dt;
      if (this.eventT <= 0) this.startEvent();
    }
  }

  startEvent() {
    const pool = ['blackout', 'drain', 'boost', 'surge', 'blackout', 'drain'];
    const type = Phaser.Utils.Array.GetRandom(pool);
    CG.audio.play('event');
    switch (type) {
      case 'blackout':
        this.activeEvent = { type, t: 7, label: '⚡ APAGÓN' };
        this.dark.setVisible(true);
        this.announce('⚡ APAGÓN EN EL DATACENTER', '#facc15', 'Visibilidad reducida: guíate por los indicadores de los servidores');
        break;
      case 'drain':
        this.activeEvent = { type, t: 7, label: '📉 FUGA DE ANCHO DE BANDA' };
        this.announce('📉 FUGA DE ANCHO DE BANDA', '#f87171', 'No se regenera BW: gasta con cuidado');
        break;
      case 'boost':
        this.activeEvent = { type, t: 8, label: '📶 REFUERZO ISP' };
        this.bw = this.P.bwMax;
        this.announce('📶 REFUERZO DEL ISP', '#4ade80', 'Ancho de banda al máximo y regeneración ×2.5');
        CG.audio.play('powerup');
        break;
      default:   // surge: hora pico con mucho tráfico legítimo que NO se debe destruir
        this.activeEvent = { type, t: 4, label: '🚦 HORA PICO' };
        for (let i = 0; i < 10; i++) this.spawnThreat('legit');
        this.announce('🚦 HORA PICO DE TRÁFICO', '#38bdf8', '¡Mucho tráfico legítimo! No dispares a lo verde');
    }
  }

  endEvent() {
    if (this.activeEvent.type === 'blackout') { this.dark.setVisible(false); this.maskG.clear(); }
    this.activeEvent = null;
    this.hud.event.setText('');
    this.eventT = Phaser.Math.Between(13, 20);
  }

  // ------------------------------- Jefe final Zero-Day -----------------------

  startBoss() {
    this.phase = 'boss';
    this.bossElapsed = 0;
    const B = CG.CONFIG.BOSS;
    const boss = this.physics.add.image(this.W / 2, -110, 'boss').setDepth(7);
    boss.body.setCircle(70, 20, 20);
    boss.hp = B.hp; boss.maxHp = B.hp;
    boss.shield = B.shield;
    boss.exposedT = 0;
    boss.attackT = 2.2;
    boss.pattern = 0;
    boss.t = 0;
    boss.ready = false;
    boss.enraged = false;
    this.boss = boss;
    // Ojo: con (sprite, grupo) el callback recibe (sprite, miembroDelGrupo)
    this.physics.add.overlap(boss, this.bullets, (bo, b) => this.onBulletHitBoss(b));
    this.tweens.add({
      targets: boss, y: 135, duration: 2000, ease: 'Cubic.easeOut',
      onComplete: () => { boss.ready = true; },
    });
    this.announce('⚠ ZERO-DAY DETECTADO', '#e879f9', 'Rompe su escudo con 3 pulsos FILTRAR y luego ¡dispara!');
    CG.audio.play('boss');
    this.cameras.main.shake(600, 0.006);
  }

  updateBoss(dt) {
    if (this.cfg.boss && this.phase === 'main' && this.elapsed >= this.cfg.duration) this.startBoss();
    const boss = this.boss;
    if (!boss || !boss.ready || !boss.active) return;
    const B = CG.CONFIG.BOSS;

    boss.t += dt;
    boss.x = this.W / 2 + Math.sin(boss.t * (boss.enraged ? 1.3 : 0.9)) * 300;
    boss.y = 135 + Math.sin(boss.t * 1.7) * 18;

    if (boss.exposedT > 0) {
      boss.exposedT -= dt;
      if (boss.exposedT <= 0) {
        boss.shield = B.shield;
        this.floatText(boss.x, boss.y + 100, 'ESCUDO REGENERADO', '#e879f9');
      }
    }

    boss.attackT -= dt;
    if (boss.attackT <= 0) {
      this.bossAttack();
      boss.attackT = boss.enraged ? 1.5 : 2.3;
    }
  }

  /** Cuatro patrones de ataque que se alternan. */
  bossAttack() {
    const boss = this.boss;
    const pattern = ['aimed', 'radial', 'summon', 'snipe'][boss.pattern++ % 4];
    const en = boss.enraged;
    if (pattern === 'radial') {
      const n = en ? 16 : 10;
      const off = Math.random() * Math.PI;
      for (let i = 0; i < n; i++) this.fireBolt(boss.x, boss.y, off + (Math.PI * 2 * i) / n, 175);
    } else if (pattern === 'aimed') {
      const a = Phaser.Math.Angle.Between(boss.x, boss.y, this.player.x, this.player.y);
      const n = en ? 5 : 3;
      for (let i = 0; i < n; i++) this.fireBolt(boss.x, boss.y, a + (i - (n - 1) / 2) * 0.2, 270);
    } else if (pattern === 'summon') {
      for (let i = 0; i < 3; i++) this.spawnThreat('malware', undefined, undefined, { x: boss.x + (i - 1) * 50, y: boss.y + 60 });
      this.floatText(boss.x, boss.y + 100, 'INVOCA MALWARE', '#f87171');
    } else {   // snipe: exploit dirigido a un servidor
      const s = Phaser.Utils.Array.GetRandom(this.servers);
      this.fireBolt(boss.x, boss.y, Phaser.Math.Angle.Between(boss.x, boss.y, s.x, s.y), 300);
      if (en) this.fireBolt(boss.x, boss.y, Phaser.Math.Angle.Between(boss.x, boss.y, this.player.x, this.player.y), 300);
    }
    CG.audio.play('hit');
  }

  fireBolt(x, y, angle, speed) {
    const o = this.bolts.create(x, y, 'bolt').setDepth(9);
    o.age = 0;
    o.body.setCircle(7, 3, 3);
    o.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  updateBolts(dt) {
    const top = CG.CONFIG.HUD_H;
    this.bolts.getChildren().slice().forEach((o) => {
      if (!o.active) return;
      o.age += dt;
      if (o.x < -30 || o.x > this.W + 30 || o.y < top - 30 || o.y > this.H + 30) { o.destroy(); return; }
      for (const s of this.servers) {
        if (Phaser.Math.Distance.Between(o.x, o.y, s.x, s.y) < 36) {
          this.damage(5, s.x, s.y, 'Exploit −5 %');
          o.destroy();
          return;
        }
      }
    });
  }

  onBulletHitBolt(b, o) {
    if (!b.active || !o.active) return;
    b.disableBody(true, true);
    this.burst('purple', o.x, o.y, 8);
    this.addScore(5, o.x, o.y, true);
    o.destroy();
  }

  onPlayerHitBolt(o) {
    if (!o.active || this.invulnT > 0) return;
    this.bw = Math.max(0, this.bw - 15);
    this.stunT = 0.6;
    this.invulnT = 1;
    this.floatText(this.player.x, this.player.y - 30, '-15 BW', '#f87171');
    this.burst('purple', o.x, o.y, 12);
    CG.audio.play('damage');
    o.destroy();
  }

  onBulletHitBoss(b) {
    const boss = this.boss;
    if (!b.active || !boss || !boss.ready) return;
    b.disableBody(true, true);
    if (boss.shield > 0) {              // escudo activo: la bala rebota
      this.burst('purple', b.x, b.y, 4);
      CG.audio.play('deflect');
      return;
    }
    boss.hp--;
    this.score += 2;
    this.flash(boss);
    this.burst('red', b.x, b.y, 5);
    CG.audio.play('hit');
    if (!boss.enraged && boss.hp <= boss.maxHp / 2) {
      boss.enraged = true;
      this.announce('☠ ZERO-DAY EN FASE CRÍTICA', '#ff3b5c', 'Ataques más rápidos y densos');
      CG.audio.play('boss');
    }
    if (boss.hp <= 0) this.killBoss();
  }

  /** Un pulso FILTRAR cerca del jefe rompe un segmento del escudo. */
  bossShieldHit() {
    const boss = this.boss;
    if (boss.shield <= 0) return;
    boss.shield--;
    this.burst('purple', boss.x, boss.y, 24);
    CG.audio.play('deflect');
    if (boss.shield === 0) {
      boss.exposedT = CG.CONFIG.BOSS.exposedTime;
      this.stats.shields++;
      this.addScore(100, boss.x, boss.y + 90, false);
      this.announce('¡ESCUDO ROTO!', '#4ade80', `¡Dispara al Zero-Day! (${CG.CONFIG.BOSS.exposedTime} s de ventana)`);
      CG.audio.play('powerup');
    } else {
      this.floatText(boss.x, boss.y + 100, `ESCUDO ${boss.shield}/${CG.CONFIG.BOSS.shield}`, '#e879f9');
    }
  }

  killBoss() {
    const boss = this.boss;
    this.state = 'ending';
    this.physics.pause();
    this.threats.clear(true, true);
    this.bolts.clear(true, true);
    CG.audio.play('bossDie');
    this.cameras.main.shake(1200, 0.01);
    this.time.addEvent({
      delay: 150, repeat: 9,
      callback: () => this.burst(Phaser.Utils.Array.GetRandom(['purple', 'red', 'white', 'orange']),
        boss.x + Phaser.Math.Between(-70, 70), boss.y + Phaser.Math.Between(-70, 70), 26),
    });
    this.addScore(1000, boss.x, boss.y, false);
    this.tweens.add({ targets: boss, alpha: 0, scale: 1.4, duration: 1500 });
    this.time.delayedCall(1700, () => { boss.destroy(); this.winLevel(); });
  }

  // ===========================================================================
  // 7. INTERFAZ Y EFECTOS
  // ===========================================================================

  addScore(base, x, y, useCombo) {
    let mult = 1;
    if (useCombo) {
      mult = Math.min(5, 1 + Math.floor(this.combo / 4));
      this.combo++;
      this.comboT = 2.2;
    }
    const pts = base * mult;
    this.score += pts;
    this.floatText(x, y - 14, `+${pts}`, mult > 1 ? '#fde047' : '#e2e8f0');
  }

  burst(color, x, y, n = 14) {
    (this.fx[color] || this.fx.white).explode(n, x, y);
  }

  floatText(x, y, msg, color = '#ffffff') {
    const t = CG.UI.txt(this, x, y, msg, 13, color, { fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(70).setStroke('#000000', 3);
    this.tweens.add({
      targets: t, y: y - 34, alpha: 0, duration: 1000, ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  announce(msg, color = '#22d3ee', sub = '') {
    this.tweens.killTweensOf([this.banner, this.bannerSub]);
    this.banner.setText(msg).setColor(color).setAlpha(1).setScale(1.25);
    this.bannerSub.setText(sub).setAlpha(sub ? 1 : 0);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 180 });
    this.tweens.add({ targets: [this.banner, this.bannerSub], alpha: 0, delay: 2200, duration: 600 });
  }

  /** Redibuja los elementos dinámicos del mundo (barras, anillos, escudo). */
  drawWorld(time) {
    const g = this.uiGfx;
    g.clear();

    this.servers.forEach((s) => {
      // Estado -> color/etiqueta (prioridad de mayor a menor gravedad)
      let color = 0x4ade80; let text = 'OK'; let tint = 0xffffff;
      const blink = Math.floor(time / 250) % 2 === 0;
      if (s.locked) { color = 0xa78bfa; text = 'CIFRADO ✖'; tint = 0xc4b5fd; }
      else if (s.overloaded) { color = 0xfb923c; text = 'SOBRECARGA'; tint = blink ? 0xfb923c : 0xffffff; }
      else if (s.infected) { color = 0xff3b5c; text = '☣ INFECTADO'; tint = 0xff6b81; }
      else if (s.vuln) { color = 0xfacc15; text = `⚠ VULNERABLE ${Math.ceil(s.vulnT)}s`; tint = blink ? 0xfde047 : 0xffffff; }
      else if (s.load > 8) { color = 0xf472b6; text = `CARGA ${Math.round(s.load)}%`; }
      s.spr.setTint(tint);
      s.label.setText(text).setColor('#' + color.toString(16).padStart(6, '0'));

      g.lineStyle(2, color, 0.55);
      g.strokeCircle(s.x, s.y, 50);

      // Círculo guía: si el servidor necesita atención, muestra dónde hay que estar para usar E
      if (s.locked || s.infected || s.vuln || s.load > 8) {
        g.lineStyle(2, color, 0.25 + 0.25 * Math.sin(time / 220));
        g.strokeCircle(s.x, s.y, this.P.patchRange);
      }

      // Barra de carga (nivel 2 o si hay carga)
      if (this.cfg.loadEnabled || s.load > 0) {
        g.fillStyle(0x0b1730, 1).fillRect(s.x - 30, s.y + 40, 60, 5);
        g.fillStyle(s.load > 70 ? 0xff3b5c : 0xf472b6, 1).fillRect(s.x - 30, s.y + 40, 60 * (s.load / 100), 5);
      }
    });

    // Marcador del servidor objetivo de una oleada DDoS
    if (this.waveTarget) {
      const s = this.waveTarget.s;
      g.lineStyle(3, 0xf472b6, 0.5 + 0.5 * Math.sin(time / 90));
      g.strokeCircle(s.x, s.y, 64);
    }

    // Indicador de parcheo / mitigación
    const st = this.patchTarget;
    if (st && this.state === 'playing') {
      const holding = this.keys.patch.isDown;
      g.lineStyle(3, 0xffffff, 0.8);
      g.strokeCircle(st.x, st.y, 58);
      this.hintText.setVisible(!holding).setPosition(st.x, st.y - 72);
      if (holding && this.patchProg > 0) {
        const need = st.locked ? 2.4 : st.infected ? 1.6 : 1.0;
        g.lineStyle(6, 0x4ade80, 1).beginPath()
          .arc(st.x, st.y, 58, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, this.patchProg / need))
          .strokePath();
      }
    } else {
      this.hintText.setVisible(false);
    }

    // Escudo y barra de vida del jefe
    const boss = this.boss;
    if (boss && boss.active && boss.ready) {
      const B = CG.CONFIG.BOSS;
      for (let i = 0; i < boss.shield; i++) {
        const a0 = (Math.PI * 2 * i) / B.shield + time / 900;
        g.lineStyle(6, 0xe879f9, 0.85).beginPath()
          .arc(boss.x, boss.y, 100, a0, a0 + (Math.PI * 2) / B.shield - 0.35).strokePath();
      }
      if (boss.exposedT > 0) {
        g.lineStyle(3, 0x4ade80, 0.4 + 0.4 * Math.sin(time / 80)).strokeCircle(boss.x, boss.y, 90);
      }
    }
  }

  /** HUD superior: barras de integridad y ancho de banda, puntaje y tiempo. */
  updateHUD() {
    const g = this.hudGfx;
    g.clear();
    const bar = (x, y, w, h, ratio, color) => {
      g.fillStyle(0x0b1730, 1).fillRect(x, y, w, h);
      g.fillStyle(color, 1).fillRect(x, y, Math.max(0, w * ratio), h);
      g.lineStyle(1, 0x2b4a73, 1).strokeRect(x, y, w, h);
    };

    const iRatio = this.integrity / 100;
    const iColor = iRatio > 0.5 ? 0x4ade80 : iRatio > 0.25 ? 0xfacc15 : 0xff3b5c;
    bar(16, 24, 230, 20, iRatio, iColor);
    bar(262, 24, 190, 20, this.bw / this.P.bwMax, 0x22d3ee);
    this.hud.integrity.setText(`${Math.ceil(this.integrity)}%`);
    this.hud.bw.setText(`${Math.floor(this.bw)} / ${this.P.bwMax}`);
    this.hud.score.setText(String(this.score).padStart(6, '0'));
    this.hud.combo.setText(this.combo >= 4 ? `COMBO x${Math.min(5, 1 + Math.floor(this.combo / 4))}` : '');

    // Tiempo: cuenta regresiva en la fase principal; cronómetro durante el jefe
    let secs; let label;
    if (this.phase === 'boss') { secs = this.bossElapsed; label = 'JEFE'; }
    else { secs = Math.max(0, this.cfg.duration - this.elapsed); label = ''; }
    const m = Math.floor(secs / 60); const s = Math.floor(secs % 60);
    this.hud.time.setText(`${label ? label + ' ' : ''}${m}:${String(s).padStart(2, '0')}`);
    this.hud.time.setColor(this.phase !== 'boss' && secs < 10 ? '#f87171' : '#e2e8f0');

    // Barra fina de progreso de la misión bajo el HUD
    g.fillStyle(0x0b1730, 1).fillRect(0, CG.CONFIG.HUD_H - 4, this.W, 4);
    g.fillStyle(0x22d3ee, 0.9).fillRect(0, CG.CONFIG.HUD_H - 4, this.W * this.progress(), 4);

    // Barra de vida del jefe
    const boss = this.boss;
    if (boss && boss.active) {
      const w = 420; const x = (this.W - w) / 2; const y = CG.CONFIG.HUD_H + 12;
      bar(x, y, w, 12, boss.hp / boss.maxHp, boss.exposedT > 0 ? 0x4ade80 : 0xd946ef);
      if (!this.bossLabel) {
        this.bossLabel = CG.UI.txt(this, this.W / 2, y - 1, 'ZERO-DAY', 10, '#ffffff', { fontStyle: 'bold' })
          .setOrigin(0.5, 0).setDepth(101);
      }
      this.bossLabel.setText(boss.exposedT > 0 ? `ZERO-DAY · VULNERABLE ${Math.ceil(boss.exposedT)}s` : 'ZERO-DAY · ESCUDO ACTIVO');
    } else if (this.bossLabel) {
      this.bossLabel.destroy(); this.bossLabel = null;
    }

    // Viñeta roja de alerta con integridad crítica
    this.warnRect.setAlpha(this.integrity < 30 && this.state === 'playing'
      ? 0.06 + 0.06 * Math.sin(this.time_ / 150) : 0);
  }

  // ---------------------------------------------------- paneles modales

  /** Crea un panel modal centrado; devuelve el contenedor. */
  modal(w, h, borderColor) {
    const c = this.add.container(0, 0).setDepth(200);
    c.add(this.add.rectangle(0, 0, this.W, this.H, 0x000000, 0.72).setOrigin(0));
    c.add(this.add.rectangle(this.W / 2, this.H / 2 + 20, w, h, 0x08142b, 0.97).setStrokeStyle(3, borderColor, 1));
    return c;
  }

  /** Pantalla de briefing al inicio de cada nivel. */
  showBriefing() {
    const cfg = this.cfg;
    const T = CG.UI.txt;
    const c = this.modal(780, 470, 0x22d3ee);
    const cx = this.W / 2; const top = 62;
    c.add(T(this, cx, top + 26, `NIVEL ${cfg.id} · ${cfg.name.toUpperCase()}`, 24, '#22d3ee', { fontStyle: 'bold' }).setOrigin(0.5));
    c.add(T(this, cx, top + 58, cfg.tag, 12, '#e879f9', { fontStyle: 'bold' }).setOrigin(0.5));
    c.add(T(this, cx, top + 88, 'OBJETIVO: ' + cfg.objective, 14, '#fde047', { wordWrap: { width: 720 }, align: 'center' }).setOrigin(0.5, 0));
    cfg.tips.forEach((tip, i) => {
      c.add(T(this, 116, top + 126 + i * 42, '▸ ' + tip, 13, '#cbd5e1', { wordWrap: { width: 730 } }));
    });
    c.add(T(this, 116, top + 262, 'AMENAZAS EN ESTA MISIÓN', 12, '#64748b', { fontStyle: 'bold' }));
    cfg.threats.forEach((k, i) => {
      const y = top + 288 + i * 26;
      c.add(this.add.image(130, y + 8, CG.THREATS[k].tex).setScale(0.6));
      c.add(T(this, 156, y, CG.THREATS[k].name, 13, k === 'legit' ? '#4ade80' : '#f8fafc', { fontStyle: 'bold' }));
      c.add(T(this, 320, y, CG.THREATS[k].desc, 12, '#94a3b8'));
    });
    const go = T(this, cx, 560, 'Pulsa ESPACIO, ENTER o haz clic para comenzar', 16, '#4ade80', { fontStyle: 'bold' }).setOrigin(0.5);
    c.add(go);
    this.tweens.add({ targets: go, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });
    this.modalBox = c;
    this.canContinue = true;
  }

  /** Avanza desde briefing → juego o desde fin de nivel → siguiente escena. */
  advance() {
    if (!this.canContinue) return;
    if (this.state === 'briefing') {
      this.canContinue = false;
      this.modalBox.destroy();
      this.state = 'playing';
      CG.audio.ensure();
      CG.audio.play('levelStart');
      CG.audio.startMusic(this.levelIdx);
      this.announce(`NIVEL ${this.cfg.id}`, '#22d3ee', this.cfg.name);
    } else if (this.state === 'ending' && this.endNext) {
      this.canContinue = false;
      const next = this.endNext;
      this.endNext = null;
      next();
    }
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.physics.pause();
      this.pauseBox = this.modal(420, 150, 0xfacc15);
      this.pauseBox.add(CG.UI.txt(this, this.W / 2, this.H / 2 - 4, 'PAUSA', 34, '#facc15', { fontStyle: 'bold' }).setOrigin(0.5));
      this.pauseBox.add(CG.UI.txt(this, this.W / 2, this.H / 2 + 44, 'P o ESC para continuar', 14, '#cbd5e1').setOrigin(0.5));
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.physics.resume();
      this.pauseBox.destroy();
    }
  }

  // ===========================================================================
  // 8. FIN DE NIVEL
  // ===========================================================================

  checkEnd() {
    if (this.integrity <= 0) return this.loseGame();
    if (!this.cfg.boss && this.elapsed >= this.cfg.duration) this.winLevel();
    return null;
  }

  /** DERROTA: integridad 0 % → pantalla de Game Over. */
  loseGame() {
    if (this.state === 'ending') return;
    this.state = 'ending';
    this.physics.pause();
    CG.audio.stopMusic();
    CG.audio.play('lose');
    this.cameras.main.shake(700, 0.012);
    this.cameras.main.flash(500, 255, 30, 60);
    this.announce('SERVIDOR COMPROMETIDO', '#ff3b5c', 'La red ha caído…');
    this.time.delayedCall(1700, () => this.scene.start('GameOverScene', {
      score: this.score, level: this.levelIdx, name: this.playerName, stats: this.stats,
    }));
  }

  /** VICTORIA DE NIVEL: bonificaciones y panel de resultados. */
  winLevel() {
    this.state = 'ending';
    this.physics.pause();
    CG.audio.stopMusic();
    CG.audio.play('win');
    this.stats.levels = Math.max(this.stats.levels, this.levelIdx);

    const integrityBonus = Math.round(this.integrity) * 10;
    const missionBonus = 500 * this.levelIdx;
    const timeBonus = this.cfg.boss ? Math.max(0, Math.round((120 - this.bossElapsed) * 10)) : 0;
    this.score += integrityBonus + missionBonus + timeBonus;

    const last = this.levelIdx >= CG.LEVELS.length;
    const T = CG.UI.txt;
    const c = this.modal(620, 340, 0x4ade80);
    const cx = this.W / 2;
    c.add(T(this, cx, 208, 'MISIÓN COMPLETADA', 30, '#4ade80', { fontStyle: 'bold' }).setOrigin(0.5));
    const rows = [
      [`Integridad restante (${Math.round(this.integrity)} %)`, `+${integrityBonus}`],
      ['Bonificación de misión', `+${missionBonus}`],
    ];
    if (this.cfg.boss) rows.push([`Tiempo contra el jefe (${Math.round(this.bossElapsed)} s)`, `+${timeBonus}`]);
    rows.push(['PUNTAJE TOTAL', String(this.score)]);
    rows.forEach(([k, v], i) => {
      const bold = i === rows.length - 1;
      c.add(T(this, 200, 262 + i * 34, k, bold ? 18 : 15, bold ? '#fde047' : '#cbd5e1', { fontStyle: bold ? 'bold' : 'normal' }));
      c.add(T(this, 760, 262 + i * 34, v, bold ? 18 : 15, bold ? '#fde047' : '#f8fafc', { fontStyle: 'bold' }).setOrigin(1, 0));
    });
    const hint = T(this, cx, 486, last ? 'Pulsa ESPACIO o clic para ver el resultado final' : `Pulsa ESPACIO o clic para el NIVEL ${this.levelIdx + 1}`, 15, '#4ade80', { fontStyle: 'bold' }).setOrigin(0.5);
    c.add(hint);
    this.tweens.add({ targets: hint, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });

    this.endNext = () => {
      const data = { score: this.score, name: this.playerName, stats: this.stats };
      if (last) this.scene.start('VictoryScene', { ...data, level: this.levelIdx, integrity: this.integrity });
      else this.scene.start('GameScene', { ...data, level: this.levelIdx + 1 });
    };
    this.time.delayedCall(900, () => { this.canContinue = true; });
  }
}
