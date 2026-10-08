/**
 * config.js — Configuración global de CyberGuard: ISND Defense
 * ---------------------------------------------------------------------------
 * Todo el proyecto cuelga del espacio de nombres `CG` (CyberGuard) para no
 * contaminar el ámbito global. Aquí se centralizan las constantes "de balance"
 * (velocidades, costos, radios) para poder ajustar la dificultad sin tocar la
 * lógica de las escenas.
 */
window.CG = window.CG || {};

CG.CONFIG = {
  TITLE: 'CyberGuard: ISND Defense',
  WIDTH: 960,          // Resolución lógica del juego (Phaser la escala con Scale.FIT)
  HEIGHT: 640,
  HUD_H: 56,           // Alto de la barra superior (HUD)

  // ✏️ EDITAR: nombres reales de los integrantes del equipo
  TEAM: [
    'Integrante 1 — Nombre Apellido',
    'Integrante 2 — Nombre Apellido',
    'Integrante 3 — Nombre Apellido',
    'Integrante 4 — Nombre Apellido',
  ],
  COURSE: 'Nuevas Tecnologías · Ingeniería en Sistemas y Negocios Digitales (ISND)',

  /**
   * Ranking global (Tecnología 2). Si URL y ANON_KEY están vacías, el juego usa
   * el modo "mock" con LocalStorage. Ver README.md para crear la tabla en Supabase.
   */
  SUPABASE: {
    URL: 'https://louvghtsokwedxxdhktm.supabase.co',
    ANON_KEY: 'sb_publishable_lReRXU2emTDAOr6M54tEMQ_AyaXibRO', // pública; nunca service_role/secret
    TABLE: 'scores',
  },

  // Posición de los 4 servidores (racks) del centro de datos
  SERVER_POS: [
    { x: 260, y: 230 }, { x: 700, y: 230 },
    { x: 260, y: 470 }, { x: 700, y: 470 },
  ],

  // Balance del jugador (agente defensivo)
  PLAYER: {
    speed: 240,          // px/s
    bulletSpeed: 560,    // px/s
    fireRate: 0.17,      // s entre disparos
    bulletCost: 2.5,     // BW por disparo (Destruir virus)
    pulseCost: 30,       // BW por pulso (Filtrar tráfico)
    pulseRadius: 155,    // px
    pulseCooldown: 0.9,  // s
    patchRange: 125,     // px al servidor para poder parchear (se dibuja como círculo guía)
    patchCost: 10,       // BW totales por parche completo
    bwMax: 100,
    bwRegen: 9,          // BW/s
  },

  // Jefe final Zero-Day
  BOSS: { hp: 45, shield: 3, exposedTime: 7 },

  // Colores de la identidad gráfica (hex numérico y CSS)
  COLOR: {
    cyan: 0x22d3ee, magenta: 0xd946ef, green: 0x4ade80, red: 0xff3b5c,
    yellow: 0xfacc15, orange: 0xfb923c, bg: 0x050b18,
  },
  FONT: 'Consolas, "Courier New", monospace',
};

/**
 * Catálogo de amenazas. `fx` es el color de las partículas al destruirse.
 * `speed` es un rango [min, max] en px/s.
 */
CG.THREATS = {
  malware:  { tex: 'malware',  speed: [55, 80],   hp: 1, score: 10, fx: 'red',
              name: 'Malware',   desc: 'Daña la integridad al llegar al servidor.' },
  phishing: { tex: 'phishing', speed: [95, 125],  hp: 1, score: 15, fx: 'yellow',
              name: 'Phishing',  desc: 'Rápido y en zigzag; roba ancho de banda.' },
  ddos:     { tex: 'ddos',     speed: [100, 135], hp: 1, score: 3,  fx: 'pink',
              name: 'Paquete DDoS', desc: 'Sobrecarga el servidor objetivo (CARGA %).' },
  ransom:   { tex: 'ransom',   speed: [40, 55],   hp: 3, score: 40, fx: 'orange',
              name: 'Ransomware', desc: 'Cifra un servidor: hay que descifrarlo (E).' },
  legit:    { tex: 'legit',    speed: [60, 80],   hp: 1, score: 0,  fx: 'green',
              name: 'Tráfico legítimo', desc: '¡NO lo destruyas! Penaliza puntaje e integridad.' },
};
