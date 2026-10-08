/**
 * levels.js — Definición declarativa de las 3 misiones.
 * ---------------------------------------------------------------------------
 * Cada nivel es un objeto de datos; GameScene lo interpreta. Así se puede
 * cambiar la dificultad editando números, sin tocar el código del motor.
 *
 *  duration  : segundos de la fase principal (cuenta regresiva en el HUD)
 *  speedMul  : multiplicador de velocidad de las amenazas
 *  spawn     : { tipo: { every } } → una amenaza cada `every` segundos
 *              (el ritmo se acelera hasta un 40 % conforme avanza el nivel)
 *  vuln      : vulnerabilidades: cada `every` s aparece una; si no se parchea
 *              en `deadline` s, el servidor se INFECTA y drena integridad
 *  waves     : (N2) oleadas DDoS masivas { at: segundo, count: paquetes }
 *  loadEnabled: (N2) los servidores muestran barra de CARGA
 *  events    : (N3) eventos dinámicos aleatorios (apagón, fuga de BW, etc.)
 *  boss      : (N3) al terminar la fase principal aparece el jefe Zero-Day
 */
CG.LEVELS = [
  {
    id: 1,
    name: 'Detección de vulnerabilidades',
    tag: 'MISIÓN INTRODUCTORIA',
    duration: 75,
    speedMul: 1,
    objective: 'Mantén la integridad del servidor durante 75 segundos.',
    tips: [
      'Los servidores marcan ⚠ VULNERABLE: entra al círculo guía del servidor y MANTÉN E (≈1 s) para parchear antes de que se infecte.',
      'Destruye malware y phishing con clic izquierdo o ESPACIO (apunta con el mouse).',
      'El tráfico legítimo (verde) debe llegar: ¡no le dispares!',
    ],
    threats: ['malware', 'phishing', 'legit'],
    spawn: { malware: { every: 2.4 }, phishing: { every: 9 }, legit: { every: 4.2 } },
    vuln: { every: 9, deadline: 20, first: 6 },
  },
  {
    id: 2,
    name: 'Ataque masivo DDoS',
    tag: 'ESTRATEGIA Y GESTIÓN DE RECURSOS',
    duration: 90,
    speedMul: 1.05,
    objective: 'Sobrevive 90 segundos al ataque DDoS sin que caiga la integridad.',
    tips: [
      'Los paquetes DDoS suben la CARGA % del servidor; al 100 % se SOBRECARGA y drena integridad.',
      'Mantén E junto a un servidor para MITIGAR su carga (gasta ancho de banda).',
      'Las oleadas masivas se resuelven con el pulso FILTRAR (Q / clic derecho, 30 BW): úsalo con cabeza.',
    ],
    threats: ['ddos', 'malware', 'phishing', 'legit'],
    spawn: {
      ddos: { every: 0.9 }, malware: { every: 5 },
      phishing: { every: 8 }, legit: { every: 2.6 },
    },
    waves: [{ at: 20, count: 22 }, { at: 45, count: 30 }, { at: 70, count: 40 }],
    loadEnabled: true,
    vuln: null,
  },
  {
    id: 3,
    name: 'Ransomware y jefe Zero-Day',
    tag: 'ALTA DIFICULTAD · EVENTOS DINÁMICOS',
    duration: 45,      // duración de la fase de Ransomware; luego llega el jefe
    speedMul: 1.1,
    objective: 'Resiste el Ransomware 45 s y derrota al jefe final Zero-Day.',
    tips: [
      'El Ransomware CIFRA servidores: mantén E (más tiempo) para descifrarlos. Tiene 3 de vida.',
      'El Zero-Day tiene ESCUDO: rómpelo con 3 pulsos FILTRAR cerca de él y luego ¡dispara!',
      'Habrá eventos: apagones, fugas de ancho de banda, hora pico de tráfico legítimo…',
    ],
    threats: ['ransom', 'malware', 'phishing', 'legit'],
    spawn: {
      ransom: { every: 5.2 }, malware: { every: 2.6 },
      phishing: { every: 5 }, legit: { every: 4.5 },
    },
    // Amenazas que siguen apareciendo mientras dura el combate con el jefe
    bossSpawn: { legit: { every: 6 }, ransom: { every: 14 } },
    vuln: { every: 15, deadline: 18, first: 12 },
    events: true,
    boss: true,
  },
];
