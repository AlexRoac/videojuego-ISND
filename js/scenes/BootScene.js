/**
 * BootScene — Genera TODOS los gráficos del juego por código.
 * ---------------------------------------------------------------------------
 * En lugar de cargar imágenes externas (que podrían faltar o pesar), cada
 * sprite se dibuja con la API de Graphics de Phaser y se convierte en textura
 * con `generateTexture`. Esto mantiene el repositorio liviano y permite
 * explicar el arte como "código" en la defensa del proyecto.
 */
class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  create() {
    const C = CG.CONFIG.COLOR;

    /** Helper: dibuja con `fn(g)` y guarda la textura `key` de tamaño w×h. */
    const make = (key, w, h, fn) => {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      fn(g);
      g.generateTexture(key, w, h);
      g.destroy();
    };

    // Cuadrícula de fondo (mosaico repetible 64×64)
    make('grid', 64, 64, (g) => {
      g.fillStyle(0x050b18, 1).fillRect(0, 0, 64, 64);
      g.lineStyle(1, 0x0e2a45, 1).strokeRect(0, 0, 64, 64);
      g.fillStyle(0x1b4a7a, 1).fillRect(0, 0, 3, 3);
    });

    // Chispa/partícula genérica
    make('spark', 10, 10, (g) => {
      g.fillStyle(0xffffff, 0.35).fillCircle(5, 5, 5);
      g.fillStyle(0xffffff, 1).fillCircle(5, 5, 2.5);
    });

    // Proyectil del agente ("comando kill")
    make('bullet', 18, 6, (g) => {
      g.fillStyle(C.cyan, 1).fillRoundedRect(0, 0, 18, 6, 3);
      g.fillStyle(0xffffff, 1).fillRoundedRect(6, 1.5, 11, 3, 1.5);
    });

    // Agente defensivo: escudo hexagonal + flecha (apunta a la derecha)
    make('player', 48, 48, (g) => {
      g.lineStyle(2, C.cyan, 0.9).strokeCircle(24, 24, 21);
      g.fillStyle(0x0b3a52, 1).fillCircle(24, 24, 18);
      g.fillStyle(C.cyan, 1).fillTriangle(40, 24, 15, 12, 15, 36);
      g.fillStyle(0xffffff, 1).fillTriangle(34, 24, 19, 17, 19, 31);
      g.fillStyle(0x0b3a52, 1).fillCircle(18, 24, 3);
    });

    // Servidor / rack (colores claros para que el tinte de estado se note)
    make('server', 72, 80, (g) => {
      g.fillStyle(0x10233f, 1).fillRoundedRect(4, 4, 64, 72, 6);
      g.lineStyle(3, 0xbfefff, 1).strokeRoundedRect(4, 4, 64, 72, 6);
      for (let i = 0; i < 4; i++) {
        const y = 12 + i * 16;
        g.fillStyle(0x1d3a63, 1).fillRoundedRect(12, y, 48, 11, 2);
        g.fillStyle(0xffffff, 1).fillCircle(20, y + 5.5, 2.5);
        g.fillStyle(0x7dd3fc, 1).fillRect(30, y + 4, 24, 3);
      }
    });

    // Malware: bola con púas roja
    make('malware', 40, 40, (g) => {
      g.fillStyle(C.red, 1);
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8;
        g.fillTriangle(
          20 + Math.cos(a - 0.28) * 11, 20 + Math.sin(a - 0.28) * 11,
          20 + Math.cos(a + 0.28) * 11, 20 + Math.sin(a + 0.28) * 11,
          20 + Math.cos(a) * 19, 20 + Math.sin(a) * 19);
      }
      g.fillCircle(20, 20, 11);
      g.fillStyle(0x2a0410, 1).fillCircle(20, 20, 6);
      g.fillStyle(0xffffff, 1).fillCircle(20, 20, 2.5);
    });

    // Phishing: sobre amarillo con "anzuelo"
    make('phishing', 40, 30, (g) => {
      g.fillStyle(C.yellow, 1).fillRoundedRect(2, 3, 36, 24, 3);
      g.lineStyle(2, 0x7a5a00, 1).strokeRoundedRect(2, 3, 36, 24, 3);
      g.lineBetween(3, 5, 20, 17).lineBetween(37, 5, 20, 17);
      g.lineStyle(3, 0x7a5a00, 1).beginPath().arc(20, 20, 4, 0, Math.PI * 1.3).strokePath();
    });

    // Paquete DDoS: rombo magenta pequeño
    make('ddos', 16, 16, (g) => {
      g.fillStyle(0xf472b6, 1).fillTriangle(8, 0, 16, 8, 8, 16).fillTriangle(8, 0, 0, 8, 8, 16);
      g.fillStyle(0xffffff, 1).fillCircle(8, 8, 2);
    });

    // Ransomware: candado naranja
    make('ransom', 52, 52, (g) => {
      g.lineStyle(6, 0xfdba74, 1).beginPath().arc(26, 20, 11, Math.PI, 0).strokePath();
      g.fillStyle(C.orange, 1).fillRoundedRect(8, 20, 36, 28, 5);
      g.lineStyle(2, 0x7c2d12, 1).strokeRoundedRect(8, 20, 36, 28, 5);
      g.fillStyle(0x3b1207, 1).fillCircle(26, 32, 5).fillRect(24, 32, 4, 10);
    });

    // Tráfico legítimo: paquete verde con check
    make('legit', 32, 24, (g) => {
      g.fillStyle(C.green, 1).fillRoundedRect(1, 1, 30, 22, 5);
      g.lineStyle(3, 0x052e16, 1).beginPath().moveTo(8, 12).lineTo(14, 18).lineTo(24, 6).strokePath();
    });

    // Jefe Zero-Day: octógono con ojo central
    make('boss', 180, 180, (g) => {
      const cx = 90, cy = 90;
      g.fillStyle(0x2a0a3a, 1);
      g.lineStyle(5, C.magenta, 1);
      const pts = [];
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8 + Math.PI / 8;
        pts.push({ x: cx + Math.cos(a) * 82, y: cy + Math.sin(a) * 82 });
      }
      g.fillPoints(pts, true).strokePoints(pts, true);
      g.lineStyle(2, 0xf0abfc, 0.7).strokeCircle(cx, cy, 58).strokeCircle(cx, cy, 44);
      for (let i = 0; i < 8; i++) {                       // "púas" de código
        const a = (Math.PI * 2 * i) / 8;
        g.fillStyle(C.magenta, 1).fillTriangle(
          cx + Math.cos(a - 0.15) * 82, cy + Math.sin(a - 0.15) * 82,
          cx + Math.cos(a + 0.15) * 82, cy + Math.sin(a + 0.15) * 82,
          cx + Math.cos(a) * 92, cy + Math.sin(a) * 92);
      }
      g.fillStyle(0xff3b5c, 1).fillCircle(cx, cy, 28);
      g.fillStyle(0x1a0410, 1).fillCircle(cx, cy, 15);
      g.fillStyle(0xffffff, 1).fillCircle(cx - 5, cy - 5, 5);
    });

    // Proyectil del jefe (exploit)
    make('bolt', 20, 20, (g) => {
      g.fillStyle(C.magenta, 0.4).fillCircle(10, 10, 10);
      g.fillStyle(C.magenta, 1).fillCircle(10, 10, 6.5);
      g.fillStyle(0xffffff, 1).fillCircle(10, 10, 3);
    });

    // Quitar la pantalla de carga HTML y pasar al menú
    const loader = document.getElementById('boot-loader');
    if (loader) loader.remove();
    this.scene.start('MenuScene');
  }
}
