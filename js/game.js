/**
 * game.js — Punto de entrada: configura y arranca Phaser.
 * ---------------------------------------------------------------------------
 * Flujo de escenas:
 *   BootScene → MenuScene → GameScene (N1 → N2 → N3) → VictoryScene
 *                              ↓ (integridad 0 %)
 *                          GameOverScene          ↔  LeaderboardScene
 *
 * Los scripts se cargan como <script> clásicos (sin módulos ES) para que el
 * juego funcione también abriendo index.html con doble clic (file://).
 */
(() => {
  // Nombre del jugador recordado de partidas anteriores
  try { CG.playerName = localStorage.getItem('cg_player') || ''; } catch (e) { CG.playerName = ''; }

  /**
   * Ajusta #game-frame al mayor rectángulo 3:2 que quepa en <main>.
   * Debe ejecutarse ANTES de crear el juego para que Phaser mida el tamaño correcto.
   */
  const main = document.querySelector('main');
  const frame = document.getElementById('game-frame');
  function fitFrame() {
    if (!main || !frame) return;
    const r = main.getBoundingClientRect();
    const cs = getComputedStyle(main);
    const aw = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const ah = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const s = Math.min(aw / CG.CONFIG.WIDTH, ah / CG.CONFIG.HEIGHT, 1.34);
    frame.style.width = `${Math.floor(CG.CONFIG.WIDTH * s)}px`;
    frame.style.height = `${Math.floor(CG.CONFIG.HEIGHT * s)}px`;
  }
  fitFrame();

  const config = {
    type: Phaser.AUTO,                       // WebGL si está disponible; si no, Canvas
    parent: 'game-container',
    width: CG.CONFIG.WIDTH,
    height: CG.CONFIG.HEIGHT,
    backgroundColor: '#050b18',
    dom: { createContainer: true },          // permite <input> HTML dentro del juego
    physics: { default: 'arcade', arcade: { debug: false } },
    scale: {
      mode: Phaser.Scale.FIT,                // se adapta al contenedor manteniendo la proporción
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, MenuScene, GameScene, GameOverScene, VictoryScene, LeaderboardScene],
  };

  CG.game = new Phaser.Game(config);

  // Los navegadores exigen un gesto del usuario para iniciar el audio
  ['pointerdown', 'keydown'].forEach((ev) => {
    window.addEventListener(ev, () => CG.audio.ensure(), { passive: true });
  });

  // Si <main> cambia de tamaño (carga de estilos, rotación, ventana…), reajustar marco y canvas.
  const refit = () => { fitFrame(); CG.game.scale.refresh(); };
  if (main && 'ResizeObserver' in window) new ResizeObserver(refit).observe(main);
  window.addEventListener('resize', refit);
  window.addEventListener('load', refit);

  // Botón de pantalla completa del HTML
  const fs = document.getElementById('btn-fullscreen');
  if (fs) fs.addEventListener('click', () => {
    if (CG.game.scale.isFullscreen) CG.game.scale.stopFullscreen();
    else CG.game.scale.startFullscreen();
  });
})();
