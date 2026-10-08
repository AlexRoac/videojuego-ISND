/**
 * GameOverScene — Condición de DERROTA (integridad del servidor = 0 %).
 * Guarda el puntaje en el ranking y permite reiniciar la partida.
 */
class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }

  init(data) { this.result = data; }

  create() {
    const { WIDTH: W } = CG.CONFIG;
    const T = CG.UI.txt;
    const d = this.result;
    this.input.keyboard.clearCaptures();

    this.bg = CG.UI.grid(this);
    this.add.rectangle(0, 0, W, CG.CONFIG.HEIGHT, 0x3b0010, 0.35).setOrigin(0).setDepth(-9);

    const title = T(this, W / 2, 92, 'GAME OVER', 60, '#ff3b5c', { fontStyle: 'bold' })
      .setOrigin(0.5).setStroke('#4c0519', 6).setShadow(0, 0, '#ff3b5c', 22, true, true);
    this.tweens.add({ targets: title, alpha: 0.6, duration: 700, yoyo: true, repeat: -1 });
    T(this, W / 2, 148, 'SERVIDOR COMPROMETIDO — la integridad llegó a 0 %', 16, '#fca5a5').setOrigin(0.5);
    T(this, W / 2, 174, `Caíste en el NIVEL ${d.level}: ${CG.LEVELS[d.level - 1].name}`, 13, '#94a3b8').setOrigin(0.5);

    CG.UI.panel(this, W / 2 - 230, 210, 460, 224, 'INFORME DE INCIDENTE', 0xff3b5c);
    CG.UI.resultStats(this, W / 2 - 200, 246, d);
    CG.UI.submitScore(this, W / 2, 448, d, 'lose');

    CG.UI.button(this, W / 2 - 200, 520, 190, 46, '↻ NUEVA PARTIDA', () => this.restart(), 0x4ade80);
    CG.UI.button(this, W / 2, 520, 190, 46, '🏆 RANKING', () => this.scene.start('LeaderboardScene'), 0xfacc15);
    CG.UI.button(this, W / 2 + 200, 520, 190, 46, '⌂ MENÚ', () => this.scene.start('MenuScene'), 0x22d3ee);
    T(this, W / 2, 580, 'ENTER para reiniciar', 12, '#64748b').setOrigin(0.5);

    // Pequeña guarda: evita reiniciar por accidente con un ENTER/ESPACIO que venía pulsado
    this.armed = false;
    this.time.delayedCall(900, () => { this.armed = true; });
    this.input.keyboard.on('keydown-ENTER', () => this.armed && this.restart());
  }

  /** Reinicia la partida completa desde el nivel 1. */
  restart() {
    this.scene.start('GameScene', {
      level: 1, score: 0, name: this.result.name,
      stats: { kills: 0, patches: 0, legitHits: 0, shields: 0, levels: 0 },
    });
  }

  update(t, delta) { this.bg.tilePositionY += delta * 0.01; }
}
