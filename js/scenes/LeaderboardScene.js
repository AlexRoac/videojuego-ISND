/**
 * LeaderboardScene — Tabla de posiciones (Top 10).
 * Lee los datos de CG.Leaderboard, que decide si consulta Supabase (global)
 * o LocalStorage (mock/respaldo). Los nombres se pintan con Phaser Text (no
 * HTML), por lo que no hay riesgo de inyección de código.
 */
class LeaderboardScene extends Phaser.Scene {
  constructor() { super('LeaderboardScene'); }

  create() {
    const { WIDTH: W } = CG.CONFIG;
    const T = CG.UI.txt;
    this.input.keyboard.clearCaptures();
    this.bg = CG.UI.grid(this);

    T(this, W / 2, 50, '🏆 RANKING DE AGENTES', 36, '#facc15', { fontStyle: 'bold' })
      .setOrigin(0.5).setStroke('#713f12', 5);
    this.sourceText = T(this, W / 2, 92, 'Cargando…', 13, '#94a3b8').setOrigin(0.5);

    CG.UI.panel(this, 110, 116, 740, 384, null, 0xfacc15);
    const head = [['#', 136], ['AGENTE', 190], ['PUNTAJE', 420], ['NIVEL', 540], ['RESULTADO', 620], ['FECHA', 740]];
    head.forEach(([h, x]) => T(this, x, 128, h, 13, '#facc15', { fontStyle: 'bold' }));
    this.add.rectangle(126, 152, 708, 2, 0x713f12).setOrigin(0);

    this.rowsLayer = this.add.container(0, 0);
    this.loading = T(this, W / 2, 300, 'Consultando ranking…', 16, '#64748b').setOrigin(0.5);

    CG.UI.button(this, W / 2 - 120, 552, 190, 46, '⌂ MENÚ', () => this.scene.start('MenuScene'), 0x22d3ee);
    CG.UI.button(this, W / 2 + 120, 552, 190, 46, '▶ JUGAR', () => this.scene.start('MenuScene'), 0x4ade80);

    this.loadRows();
  }

  async loadRows() {
    const T = CG.UI.txt;
    const W = CG.CONFIG.WIDTH;
    const res = await CG.Leaderboard.top(10);
    if (!this.sourceText.active) return;   // el jugador salió de la escena
    this.loading.destroy();

    if (res.source === 'remote') this.sourceText.setText('🌐 Ranking GLOBAL (Supabase)').setColor('#4ade80');
    else if (res.error) this.sourceText.setText('⚠ Sin conexión con Supabase — mostrando ranking LOCAL').setColor('#facc15');
    else this.sourceText.setText('💾 Ranking LOCAL (LocalStorage) — configura Supabase en config.js para el global').setColor('#94a3b8');

    if (!res.rows.length) {
      T(this, W / 2, 300, 'Aún no hay puntajes. ¡Sé el primer agente en el ranking!', 15, '#64748b').setOrigin(0.5);
      return;
    }
    const medal = ['#facc15', '#cbd5e1', '#fb923c'];
    res.rows.forEach((r, i) => {
      const y = 166 + i * 32;
      const col = medal[i] || '#e2e8f0';
      const date = r.created_at ? new Date(r.created_at).toLocaleDateString('es') : '';
      T(this, 136, y, String(i + 1), 15, col, { fontStyle: 'bold' });
      T(this, 190, y, String(r.name).slice(0, 12), 15, col, { fontStyle: 'bold' });
      T(this, 420, y, String(r.score).padStart(6, '0'), 15, col);
      T(this, 540, y, `N${r.level}`, 15, '#94a3b8');
      T(this, 620, y, r.result === 'win' ? '✔ Victoria' : '✖ Derrota', 14, r.result === 'win' ? '#4ade80' : '#f87171');
      T(this, 740, y, date, 13, '#64748b');
    });
  }

  update(t, delta) { this.bg.tilePositionY += delta * 0.01; }
}
