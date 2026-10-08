# 🛡️ CyberGuard: ISND Defense

> Videojuego web de ciberseguridad y gestión de infraestructura IT.
> Proyecto de la asignatura **Nuevas Tecnologías** — Ingeniería en Sistemas y Negocios Digitales (ISND).

🔗 **Juega aquí (GitHub Pages):** `https://TU-USUARIO.github.io/NOMBRE-DEL-REPOSITORIO/`
<!-- ✏️ Reemplazar por el enlace real una vez activado GitHub Pages -->

---

## 📖 Descripción

Eres un **agente defensivo** dentro del centro de datos de ISND. Cuatro servidores están bajo ataque de **malware, phishing, DDoS y ransomware**. Debes moverte por la sala, destruir amenazas, filtrar tráfico, parchear vulnerabilidades y gestionar tu **ancho de banda** para que la **integridad del servidor** no llegue a 0 %.

### 🎯 Objetivo del juego
Completar las **3 misiones** sin que la integridad caiga a 0 % y derrotar al jefe final **Zero-Day**. Cuanto más puntaje acumules (combos, parches, integridad restante, rapidez contra el jefe), mejor posición tendrás en el **ranking**.

### 🏁 Condiciones de victoria y derrota
| Resultado | Condición |
|---|---|
| ✅ **Victoria de misión** | N1 y N2: sobrevivir el tiempo indicado. N3: resistir el ransomware y derrotar al jefe Zero-Day. |
| 🏆 **Victoria final** | Completar las 3 misiones (pantalla *¡RED ASEGURADA!*). |
| ❌ **Derrota** | La **integridad del servidor** llega a 0 % (pantalla *GAME OVER*). Se puede iniciar una nueva partida. |

---

## 🗺️ Las 3 misiones

| Nivel | Tema | Mecánicas clave |
|---|---|---|
| **1** | Detección de vulnerabilidades y filtrado de código malicioso *(introductorio)* | Los servidores muestran ⚠ **VULNERABLE** con cuenta regresiva: hay que **parchearlos** antes de que se infecten. Malware, phishing y tráfico legítimo que **no** se debe destruir. |
| **2** | Ataque masivo **DDoS** y sobrecarga de servidores *(estrategia y recursos)* | Cada paquete DDoS sube la **CARGA %** del servidor; al 100 % se sobrecarga. **Oleadas** avisadas 3 s antes y dirigidas a un servidor. Hay que elegir entre disparar, usar el pulso *Filtrar* (caro) o *mitigar* carga. |
| **3** | **Ransomware** y jefe final **Zero-Day** *(alta dificultad)* | El ransomware **cifra** servidores (hay que descifrarlos). Después aparece el **Zero-Day**: tiene escudo (se rompe con 3 pulsos *Filtrar*) y luego una ventana de 7 s para dispararle; 4 patrones de ataque y fase crítica al 50 %. **Eventos dinámicos:** apagón, fuga de ancho de banda, refuerzo del ISP y hora pico de tráfico. |

### Amenazas
| Amenaza | Comportamiento |
|---|---|
| 🔴 Malware | Avanza hacia un servidor y le resta integridad. |
| 🟡 Phishing | Rápido y en zigzag; roba ancho de banda. |
| 🟣 Paquete DDoS | Pequeño y numeroso; sube la carga del servidor. |
| 🟠 Ransomware | Resistente (3 de vida); cifra el servidor al llegar. |
| 🟢 Tráfico legítimo | **No destruir**: hacerlo penaliza puntaje e integridad. Entregado, da ancho de banda. |

---

## 🎮 Controles

| Acción | Tecla / Mouse | Costo |
|---|---|---|
| Mover | `W A S D` o flechas | — |
| **Destruir virus** (disparo) | Clic izquierdo o `ESPACIO` (se apunta con el mouse) | 2.5 BW |
| **Filtrar tráfico** (pulso de área) | Clic derecho o `Q` | 30 BW |
| **Parchear / mitigar / descifrar** | Mantener `E` cerca de un servidor | ~10 BW |
| Pausa | `P` o `ESC` | — |
| Sonido on/off | `M` | — |
| Iniciar partida desde el menú | `ENTER` | — |

**HUD:** integridad del servidor (vidas), ancho de banda (recurso que se regenera), puntaje, tiempo (cuenta regresiva o cronómetro del jefe) y barra de progreso de la misión.

**Sistema de puntaje:** combos (hasta ×5) por destruir amenazas en cadena, bonos por parchear, bonificación por integridad restante, por misión y por rapidez contra el jefe.

---

## 🧰 Tecnologías utilizadas y justificación técnica

### Tecnologías nuevas exigidas
| # | Tecnología | Uso en el proyecto | Justificación |
|---|---|---|---|
| 1 | **Phaser 3 (v3.80)** | Motor del juego: bucle principal, **físicas Arcade** (colisiones/solapamientos), escenas, grupos con *pool* de objetos, partículas, tweens, cámaras y máscaras. | Framework estándar para juegos 2D en HTML5; evita reinventar el bucle de juego y permite separar la lógica en **escenas** reutilizables. Se carga por CDN, sin instalación. |
| 2 | **Ranking online (Supabase REST API / LocalStorage)** | `js/services/leaderboard.js` guarda y consulta el Top 10 mediante `fetch` a la API REST de Supabase (PostgREST). Sin credenciales, funciona en modo *mock* con LocalStorage. | Demuestra consumo de **API REST** y persistencia. El respaldo local hace que el juego funcione sin red ni configuración. |

### Tecnologías de apoyo
- **Web Audio API** (`js/services/audio.js`): todos los efectos y la música se **sintetizan** con osciladores y ruido filtrado; no hay archivos de audio externos que puedan faltar.
- **Tailwind CSS (CDN)**: interfaz HTML que rodea al juego (cabecera, marco, pie, pantalla de carga).
- **HTML5 / CSS3 / JavaScript (ES2020)**: sin *bundlers*; los scripts son clásicos, así que el juego funciona incluso abriendo `index.html` con doble clic.
- **Gráficos procedurales**: todos los sprites se dibujan con la API `Graphics` de Phaser en `BootScene` (repositorio liviano, sin imágenes externas).

---

## 🗂️ Estructura del proyecto

```
├── index.html                 # Punto de entrada (Tailwind + Phaser por CDN)
├── css/
│   └── style.css              # Identidad gráfica (neón, marco, scanlines, input)
├── js/
│   ├── config.js              # Constantes de balance, equipo, credenciales Supabase, amenazas
│   ├── levels.js              # Definición declarativa de los 3 niveles
│   ├── ui.js                  # Utilidades de interfaz (botones, paneles, texto)
│   ├── game.js                # Configuración y arranque de Phaser
│   ├── services/
│   │   ├── audio.js           # Efectos y música con Web Audio API
│   │   └── leaderboard.js     # Ranking (Supabase REST / LocalStorage)
│   └── scenes/
│       ├── BootScene.js       # Genera todas las texturas por código
│       ├── MenuScene.js       # Pantalla de inicio: instrucciones, controles, equipo
│       ├── GameScene.js       # Bucle de juego de los 3 niveles + jefe + eventos
│       ├── GameOverScene.js   # Derrota
│       ├── VictoryScene.js    # Victoria final
│       └── LeaderboardScene.js# Tabla de posiciones
├── assets/
│   └── favicon.svg            # Ícono (el resto del arte se genera por código)
└── README.md
```

**Flujo de escenas:** `Boot → Menu → Game (N1 → N2 → N3) → Victory` · derrota: `Game → GameOver` · ambos enlazan con `Leaderboard`.

---

## 🚀 Ejecución local y despliegue

### Celular como control desde otra red (Wi-Fi + datos móviles)

Ambos equipos necesitan internet, pero **no necesitan estar en la misma red**. Los controles pasan por el servidor público mediante HTTP y eventos SSE, así que no se requiere conexión directa, abrir puertos del router ni un servidor TURN.

**Primero publica el servidor**, que incluye el juego y el mando:

1. Sube el proyecto a un repositorio de GitHub.
2. En Render crea un **Web Service** con ese repositorio, runtime **Node**, Build Command `npm install --ignore-scripts` y Start Command `npm start`. También se incluye `render.yaml` para usar un Blueprint. Revisa el plan y su costo antes de crear el servicio.
3. Espera que el servicio esté disponible y copia su dirección HTTPS. No basta con publicar los HTML en un alojamiento estático: debe ejecutarse `server.cjs`.

Referencia: [documentación oficial de Web Services de Render](https://render.com/docs/web-services). El servidor escucha en `0.0.0.0` y utiliza el puerto `PORT` del proveedor. Usa una sola instancia porque las sesiones viven en memoria; reiniciar el servidor requiere generar un enlace nuevo. El proxy debe permitir SSE y no almacenar sus respuestas en un búfer. Si el servicio se suspende, espera a que arranque antes de conectar.

**Después, para jugar:**

1. Abre la dirección pública del juego en la computadora con Wi-Fi.
2. Pulsa **📱 Conectar celular**. El juego genera un enlace HTTPS del mando.
3. Abre ese enlace en el celular usando datos móviles o cualquier otra red con internet.
4. Usa el joystick izquierdo para moverte y el derecho para apuntar. Mantén **Disparar** o **Parchear**; **Filtrar**, **Pausa** y **Jugar / Continuar** funcionan con un toque. En las pantallas de victoria o derrota, Continuar regresa al menú.

También puedes abrir el juego localmente (incluso con Live Server) y escribir la dirección HTTPS del servidor publicado en el campo **Servidor público**, dentro de **Conectar celular**. Pulsa **Generar enlace del mando**. Se recuerda esa dirección para futuras sesiones. GitHub Pages puede servir el juego si usas este relay público por separado.

Mantén el navegador del celular abierto. Al perder conexión se sueltan los controles automáticamente. El enlace es exclusivo de esa sesión del juego; otra pestaña puede crear su propio mando. Puedes seguir usando teclado y mouse.

### Pruebas locales en la misma red

Ejecuta `npm start` o `node server.cjs` y abre **http://localhost:5173** en la computadora. Deja vacío **Servidor público**. Los enlaces locales solo funcionan con el celular en la misma Wi-Fi; la ventana del juego lo indica. Si no conecta, permite Node.js en el firewall para redes privadas. No uses `localhost` en el celular: representa al propio teléfono.

El servidor utiliza únicamente módulos incluidos con Node.js. Para detenerlo pulsa `Ctrl+C`. Puedes cambiar el puerto mediante la variable de entorno `PORT`.

`npm test` comprueba las sesiones, los controles entre orígenes distintos, los enlaces HTTPS detrás de un proxy, la validación del token y la liberación de controles tras una desconexión. Estas pruebas locales no sustituyen probar una computadora con Wi-Fi y un teléfono con datos contra el servicio publicado.

### Solo teclado y mouse
Basta con abrir `index.html` en el navegador. Si prefieres un servidor local:

```bash
python -m http.server 5173
# luego abrir http://localhost:5173
```

### Desplegar en GitHub Pages
1. Crea un repositorio en GitHub y sube el contenido de esta carpeta a la rama `main`.
   ```bash
   git init
   git add .
   git commit -m "CyberGuard: ISND Defense"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/NOMBRE-DEL-REPOSITORIO.git
   git push -u origin main
   ```
2. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. Espera 1–2 minutos: el juego quedará en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPOSITORIO/`.
4. Pega ese enlace al inicio de este README.

### Activar el ranking global (opcional, Supabase)
1. Crea un proyecto gratuito en [supabase.com](https://supabase.com).
2. En **SQL Editor** ejecuta:
   ```sql
   create table public.scores (
     id         bigint generated always as identity primary key,
     name       text    not null check (char_length(name) between 1 and 12),
     score      integer not null check (score between 0 and 1000000),
     level      integer not null check (level between 1 and 3),
     result     text    not null check (result in ('win','lose')),
     created_at timestamptz not null default now()
   );

   alter table public.scores enable row level security;

   -- Cualquiera puede leer el ranking y enviar un puntaje; nadie puede editar ni borrar
   create policy "leer ranking"  on public.scores for select using (true);
   create policy "enviar puntaje" on public.scores for insert with check (true);
   ```
3. En **Project Settings → API** copia la **Project URL** y la clave **anon public** en `js/config.js`:
   ```js
   SUPABASE: { URL: 'https://xxxx.supabase.co', ANON_KEY: 'eyJ...', TABLE: 'scores' },
   ```
   > ⚠️ Usa solo la clave **anon** (es pública por diseño y está protegida por las políticas RLS). **Nunca** publiques la clave `service_role`.

Si no se configura, o si falla la red, el juego usa automáticamente el ranking local.

> **Limitación conocida:** al ser un juego 100 % en el cliente, un jugador con conocimientos podría enviar puntajes falsos a la API. Para un ranking a prueba de trampas habría que validar las partidas en un servidor (p. ej. una Edge Function). Para el alcance de este proyecto se documenta como mejora futura.

---

## 👥 Integrantes

| Integrante | Rol |
|---|---|
| Nombre Apellido | — |
| Nombre Apellido | — |
| Nombre Apellido | — |
| Nombre Apellido | — |

<!-- ✏️ Reemplazar también el arreglo TEAM en js/config.js para que aparezcan en la pantalla de inicio -->

**Asignatura:** Nuevas Tecnologías · **Carrera:** Ingeniería en Sistemas y Negocios Digitales (ISND)

---

## 🧠 Guía rápida para explicar el código

- **`GameScene.update()`** es el corazón: cada frame ejecuta jugador → disparos → parche → generación de amenazas → movimiento → servidores → eventos → jefe → HUD → comprobación de fin.
- **Los niveles son datos** (`levels.js`): cambiar duración, ritmo de aparición u oleadas no requiere tocar la lógica.
- **Balance centralizado** en `config.js` (`PLAYER`, `BOSS`, `THREATS`).
- **Los temporizadores usan `dt`** acumulado en `update()`, por eso la pausa detiene todo sin código extra.
- **Sonido sintetizado**: cada efecto es una "receta" de osciladores + envolvente (ver `SFX` en `audio.js`).
- **Ranking desacoplado**: las escenas solo llaman a `CG.Leaderboard.submit()` y `.top()`; no saben si los datos van a Supabase o a LocalStorage.

## 📄 Licencia y créditos
Proyecto académico. Motor: [Phaser 3](https://phaser.io) (MIT). Arte y audio generados por código.
