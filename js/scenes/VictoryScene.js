/**
 * VictoryScene — Condición de VICTORIA (las 3 misiones completadas y el
 * jefe Zero-Day derrotado). Guarda el puntaje y lanza confeti de partículas.
 */
class VictoryScene extends Phaser.Scene {
  constructor() { super('VictoryScene'); }

  init(data) { this.result = data; }

  create() {
    const { WIDTH: W } = CG.CONFIG;
    const T = CG.UI.txt;
    const d = this.result;
    this.input.keyboard.clearCaptures();

    this.bg = CG.UI.grid(this);
    CG.audio.play('win');

    // Confeti: emisor con varios tintes que cae desde arriba
    this.add.particles(0, 0, 'spark', {
      x: { min: 0, max: W }, y: -10, lifespan: 4200,
      speedY: { min: 90, max: 220 }, speedX: { min: -40, max: 40 },
      scale: { start: 1.3, end: 0.5 }, frequency: 35, blendMode: 'ADD',
      tint: [0x22d3ee, 0xd946ef, 0xfacc15, 0x4ade80],
    }).setDepth(-5);

    const title = T(this, W / 2, 84, '¡RED ASEGURADA!', 54, '#4ade80', { fontStyle: 'bold' })
      .setOrigin(0.5).setStroke('#052e16', 6).setShadow(0, 0, '#4ade80', 22, true, true);
    this.tweens.add({ targets: title, scale: 1.05, duration: 900, yoyo: true, repeat: -1 });
    T(this, W / 2, 140, 'El Zero-Day fue neutralizado y el centro de datos ISND sigue en línea.', 15, '#bbf7d0').setOrigin(0.5);
    T(this, W / 2, 166, `Integridad final del servidor: ${Math.round(d.integrity)} %`, 13, '#94a3b8').setOrigin(0.5);

    CG.UI.panel(this, W / 2 - 230, 200, 460, 224, 'INFORME DE MISIÓN', 0x4ade80);
    CG.UI.resultStats(this, W / 2 - 200, 236, d);
    CG.UI.submitScore(this, W / 2, 440, d, 'win');

    CG.UI.button(this, W / 2 - 200, 516, 190, 46, '↻ JUGAR DE NUEVO', () => this.restart(), 0x4ade80);
    CG.UI.button(this, W / 2, 516, 190, 46, '🏆 RANKING', () => this.scene.start('LeaderboardScene'), 0xfacc15);
    CG.UI.button(this, W / 2 + 200, 516, 190, 46, '⌂ MENÚ', () => this.scene.start('MenuScene'), 0x22d3ee);
    T(this, W / 2, 578, 'ENTER para jugar de nuevo', 12, '#64748b').setOrigin(0.5);

    // Pequeña guarda: evita reiniciar por accidente con un ENTER/ESPACIO que venía pulsado
    this.armed = false;
    this.time.delayedCall(900, () => { this.armed = true; });
    this.input.keyboard.on('keydown-ENTER', () => this.armed && this.restart());
  }

  restart() {
    this.scene.start('GameScene', {
      level: 1, score: 0, name: this.result.name,
      stats: { kills: 0, patches: 0, legitHits: 0, shields: 0, levels: 0 },
    });
  }

  update(t, delta) { this.bg.tilePositionY += delta * 0.01; }
}
