/**
 * leaderboard.js — Sistema de Ranking / Tabla de posiciones (Tecnología 2)
 * ---------------------------------------------------------------------------
 * Dos modos transparentes para el resto del juego:
 *
 *  1) GLOBAL: si en config.js se rellenan SUPABASE.URL y SUPABASE.ANON_KEY, los
 *     puntajes se envían/leen por la API REST de Supabase (PostgREST) usando
 *     `fetch`. Cualquier jugador del mundo ve la misma tabla.
 *  2) LOCAL (mock): si no hay credenciales —o si la red falla— se usa
 *     LocalStorage del navegador. El juego nunca se rompe por falta de red.
 *
 * Siempre se guarda además una copia local, de modo que el ranking local sirve
 * como respaldo ante cualquier error del servicio remoto.
 */
CG.Leaderboard = {
  LOCAL_KEY: 'cyberguard_leaderboard_v1',

  /** ¿Hay credenciales de Supabase configuradas? */
  remoteEnabled() {
    const s = CG.CONFIG.SUPABASE;
    return !!(s && s.URL && s.ANON_KEY);
  },

  /** Limpia el nombre: solo letras/números/espacio/_-. y máximo 12 caracteres. */
  sanitizeName(name) {
    const clean = String(name || '').replace(/[^\p{L}\p{N} _\-.]/gu, '').trim().slice(0, 12);
    return clean || 'AGENTE';
  },

  // ----------------------------------------------------------- LocalStorage
  _readLocal() {
    try {
      const list = JSON.parse(localStorage.getItem(this.LOCAL_KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  },

  _writeLocal(list) {
    try {
      localStorage.setItem(this.LOCAL_KEY, JSON.stringify(list.slice(0, 100)));
    } catch (e) { /* cuota llena o modo privado: se ignora */ }
  },

  // -------------------------------------------------------------- Red (REST)
  async _fetch(path, options = {}, timeoutMs = 6000) {
    const s = CG.CONFIG.SUPABASE;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${s.URL.replace(/\/$/, '')}/rest/v1/${path}`, {
        ...options,
        signal: ctrl.signal,
        headers: {
          apikey: s.ANON_KEY,
          Authorization: `Bearer ${s.ANON_KEY}`,
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } finally {
      clearTimeout(timer);
    }
  },

  // -------------------------------------------------------------- API pública
  /**
   * Guarda un puntaje. Devuelve { source: 'remote' | 'local', error? }.
   * @param {{name:string, score:number, level:number, result:'win'|'lose'}} entry
   */
  async submit(entry) {
    const row = {
      name: this.sanitizeName(entry.name),
      score: Math.max(0, Math.floor(entry.score || 0)),
      level: entry.level || 1,
      result: entry.result === 'win' ? 'win' : 'lose',
      created_at: new Date().toISOString(),
    };

    // Copia local siempre (respaldo + modo mock)
    const list = this._readLocal();
    list.push(row);
    list.sort((a, b) => b.score - a.score);
    this._writeLocal(list);

    if (!this.remoteEnabled()) return { source: 'local' };

    try {
      const { created_at, ...payload } = row;   // la BD pone su propio created_at
      await this._fetch(CG.CONFIG.SUPABASE.TABLE, {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(payload),
      });
      return { source: 'remote' };
    } catch (err) {
      return { source: 'local', error: err.message };
    }
  },

  /** Obtiene el Top N. Devuelve { source, rows, error? }. */
  async top(limit = 10) {
    if (this.remoteEnabled()) {
      try {
        const q = `${CG.CONFIG.SUPABASE.TABLE}?select=name,score,level,result,created_at&order=score.desc&limit=${limit}`;
        const res = await this._fetch(q);
        return { source: 'remote', rows: await res.json() };
      } catch (err) {
        return { source: 'local', rows: this._readLocal().slice(0, limit), error: err.message };
      }
    }
    return { source: 'local', rows: this._readLocal().slice(0, limit) };
  },
};
