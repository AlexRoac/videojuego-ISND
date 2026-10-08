/**
 * ui.js — Utilidades de interfaz reutilizables por todas las escenas
 * (texto con estilo, paneles, botones y fondo animado).
 */
CG.UI = {
  /** Texto con la tipografía del juego. `extra` permite sobrescribir el estilo. */
  txt(scene, x, y, str, size = 14, color = '#e2e8f0', extra = {}) {
    return scene.add.text(x, y, str, {
      fontFamily: CG.CONFIG.FONT,
      fontSize: `${size}px`,
      color,
      ...extra,
    });
  },

  /** Fondo cuadriculado ("grid" generado en BootScene). Devuelve el tileSprite. */
  grid(scene) {
    const { WIDTH: W, HEIGHT: H } = CG.CONFIG;
    return scene.add.tileSprite(0, 0, W, H, 'grid').setOrigin(0).setDepth(-10);
  },

  /** Panel rectangular con borde neón y título opcional. */
  panel(scene, x, y, w, h, title, color = 0x22d3ee) {
    const bg = scene.add.rectangle(x, y, w, h, 0x08142b, 0.88).setOrigin(0).setStrokeStyle(2, color, 0.8);
    let label = null;
    if (title) {
      label = CG.UI.txt(scene, x + 14, y + 8, title, 14, '#' + color.toString(16).padStart(6, '0'),
        { fontStyle: 'bold' });
    }
    return { bg, label };
  },

  /**
   * Botón interactivo. Devuelve un contenedor con `.rect` y `.label`.
   * @param {function} onClick  callback al hacer clic
   */
  button(scene, x, y, w, h, text, onClick, color = 0x22d3ee) {
    const css = '#' + color.toString(16).padStart(6, '0');
    const rect = scene.add.rectangle(0, 0, w, h, 0x0b1c3a, 1).setStrokeStyle(2, color, 1);
    const label = CG.UI.txt(scene, 0, 0, text, 16, css, { fontStyle: 'bold' }).setOrigin(0.5);
    const box = scene.add.container(x, y, [rect, label]);
    rect.setInteractive({ useHandCursor: true });
    rect.on('pointerover', () => { rect.setFillStyle(color, 0.25); label.setColor('#ffffff'); });
    rect.on('pointerout', () => { rect.setFillStyle(0x0b1c3a, 1); label.setColor(css); });
    rect.on('pointerdown', () => { CG.audio.play('click'); onClick(); });
    box.rect = rect;
    box.label = label;
    return box;
  },

  /** Bloque de estadísticas de la partida (pantallas de fin). */
  resultStats(scene, x, y, data) {
    const s = data.stats || {};
    const rows = [
      ['Agente', data.name],
      ['Puntaje final', String(data.score).padStart(6, '0')],
      ['Misiones superadas', `${s.levels || 0} / 3`],
      ['Amenazas destruidas', s.kills || 0],
      ['Parches aplicados', s.patches || 0],
      ['Tráfico legítimo bloqueado (error)', s.legitHits || 0],
      ['Escudos Zero-Day rotos', s.shields || 0],
    ];
    rows.forEach(([k, v], i) => {
      CG.UI.txt(scene, x, y + i * 26, k, 15, '#94a3b8');
      CG.UI.txt(scene, x + 380, y + i * 26, String(v), 15, '#f8fafc', { fontStyle: 'bold' }).setOrigin(1, 0);
    });
  },

  /** Envía el puntaje al ranking y muestra el estado en pantalla. */
  async submitScore(scene, x, y, data, result) {
    const status = CG.UI.txt(scene, x, y, 'Guardando puntaje…', 13, '#94a3b8').setOrigin(0.5, 0);
    const r = await CG.Leaderboard.submit({
      name: data.name, score: data.score, level: data.level, result,
    });
    if (!status.active) return;   // la escena ya cambió mientras esperábamos
    if (r.source === 'remote') status.setText('✔ Puntaje enviado al ranking global (Supabase)').setColor('#4ade80');
    else if (r.error) status.setText('Sin conexión: guardado en el ranking local').setColor('#facc15');
    else status.setText('✔ Guardado en el ranking local (LocalStorage)').setColor('#4ade80');
  },
};
