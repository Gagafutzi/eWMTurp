'use strict';

/*
 * Split out of index.html, which was 5,800 lines in one file.
 *
 * The program was wrapped in a single IIFE, so every declaration was
 * function-scoped and invisible outside it. Splitting across <script> tags
 * therefore meant unwrapping it: these are plain scripts in the original
 * order, sharing global scope the way the IIFE's interior shared its own, and
 * `'use strict'` is restated per file because the wrapper that carried it for
 * everybody is gone.
 *
 * Not ES modules, deliberately: these names are reached for directly by the
 * other files, so imports would have meant rewriting all of that at the same
 * time as moving it — two changes at once, in a file there is no test to catch
 * either of them with.
 *
 * Boundaries were not chosen by eye. Each was checked to leave both halves
 * parsing on their own, which is how the theme controller turned out to be a
 * second IIFE *after* the main one rather than part of it.
 */

const StatsManager = {
  data: null,
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.data = raw ? JSON.parse(raw) : this.getDefault();
    } catch (e) { this.data = this.getDefault(); }
  },
  save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch(e) {} },
  getDefault() { return {sessions:[], totalMs:0, bestN:1, createdAt:Date.now(), daily:{}}; },
  addSession(session) {
    this.data.sessions.push(session);
    this.data.totalMs += session.durationMs;
    if (session.bestN > this.data.bestN) this.data.bestN = session.bestN;
    const d = new Date(session.timestamp).toISOString().split('T')[0];
    if (!this.data.daily[d]) this.data.daily[d] = {sessions:0, totalMs:0};
    this.data.daily[d].sessions++;
    this.data.daily[d].totalMs += session.durationMs;
    this.save();
  },
  getRecentSessions(n) { return this.data.sessions.slice(-n); },
  getAvgDPrime(n) {
    const s = this.getRecentSessions(n);
    if (!s.length) return 0;
    return s.reduce((a,b) => a + (b.overallDPrime||0), 0) / s.length;
  },
  getHeatmapData() {
    const days = [];
    for (let i=27; i>=0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const key = d.toISOString().split('T')[0];
      const entry = this.data.daily[key];
      days.push({date:key, level: entry ? Math.min(5, Math.ceil(entry.sessions/2)) : 0});
    }
    return days;
  },
  getTimeOfDayData() {
    const buckets = Array(4).fill(0).map(() => ({count:0, dprime:0}));
    this.data.sessions.forEach(s => {
      const h = new Date(s.timestamp).getHours();
      const idx = h < 6 ? 0 : h < 12 ? 1 : h < 18 ? 2 : 3;
      buckets[idx].count++; buckets[idx].dprime += s.overallDPrime || 0;
    });
    return buckets.map(b => b.count ? b.dprime/b.count : 0);
  }
};

// ==================== CHART RENDERER ====================
const ChartRenderer = {
  drawLine(canvas, data, color, fill) {
    if (!canvas || typeof canvas.getContext !== 'function') return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width, h = rect.height;
    ctx.clearRect(0,0,w,h);
    if (!data || data.length < 2) {
      ctx.fillStyle = '#4b5563'; ctx.font = '12px JetBrains Mono';
      ctx.textAlign = 'center'; ctx.fillText('No data yet', w/2, h/2);
      return;
    }
    const pad = {t:20, r:20, b:30, l:40};
    const vals = data.map(d => d.y);
    let minY = Math.min(...vals), maxY = Math.max(...vals);
    if (maxY === minY) { maxY += 1; minY -= 1; }
    const range = maxY - minY;
    const xScale = (w - pad.l - pad.r) / (data.length - 1);
    const yScale = (h - pad.t - pad.b) / range;
    const getX = i => pad.l + i * xScale;
    const getY = v => pad.t + (maxY - v) * yScale;
    ctx.strokeStyle = '#1e2330'; ctx.lineWidth = 1;
    for (let i=0; i<=4; i++) {
      const y = pad.t + (h - pad.t - pad.b) * i / 4;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w-pad.r, y); ctx.stroke();
      ctx.fillStyle = '#4b5563'; ctx.font = '10px JetBrains Mono'; ctx.textAlign = 'right';
      ctx.fillText((maxY - range * i / 4).toFixed(1), pad.l - 6, y + 3);
    }
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    data.forEach((d,i) => { if (i===0) ctx.moveTo(getX(i), getY(d.y)); else ctx.lineTo(getX(i), getY(d.y)); });
    ctx.stroke();
    if (fill) {
      ctx.fillStyle = color + '1a';
      ctx.beginPath(); ctx.moveTo(getX(0), getY(data[0].y));
      data.forEach((d,i) => ctx.lineTo(getX(i), getY(d.y)));
      ctx.lineTo(getX(data.length-1), h-pad.b); ctx.lineTo(getX(0), h-pad.b); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = color;
    data.forEach((d,i) => { ctx.beginPath(); ctx.arc(getX(i), getY(d.y), 3, 0, Math.PI*2); ctx.fill(); });
    ctx.fillStyle = '#4b5563'; ctx.font = '10px JetBrains Mono'; ctx.textAlign = 'center';
    const step = Math.ceil(data.length / 6);
    data.forEach((d,i) => { if (i % step === 0) ctx.fillText(d.x, getX(i), h - 8); });
  },
  drawBars(canvas, labels, values, colors) {
    if (!canvas || typeof canvas.getContext !== 'function') return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width || canvas.clientWidth || 1));
    const h = Math.max(1, Math.round(rect.height || canvas.clientHeight || 1));

    // Reset the bitmap before scaling so repeated redraws never compound
    // the Hi-DPI transform.
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const safeValues = Array.isArray(values)
      ? values.map(v => Number.isFinite(Number(v)) ? Number(v) : 0)
      : [];
    const safeLabels = Array.isArray(labels) ? labels : [];
    const safeColors = Array.isArray(colors) && colors.length ? colors : ['#00f0ff'];

    if (!safeValues.length) {
      ctx.fillStyle = '#4b5563';
      ctx.font = '12px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No data yet', w / 2, h / 2);
      return;
    }

    const pad = {
      t: 24,
      r: 18,
      b: 34,
      l: 42
    };

    const chartW = Math.max(1, w - pad.l - pad.r);
    const chartH = Math.max(1, h - pad.t - pad.b);
    const maxV = Math.max(1, ...safeValues);
    const minV = Math.min(0, ...safeValues);
    const range = Math.max(1, maxV - minV);
    const slot = chartW / safeValues.length;
    const barW = Math.max(2, slot * 0.62);

    // Baseline/grid.
    ctx.strokeStyle = '#1e2330';
    ctx.lineWidth = 1;
    ctx.font = '9px JetBrains Mono, monospace';

    for (let tick = 0; tick <= 4; tick++) {
      const y = pad.t + chartH * tick / 4;
      ctx.beginPath();
      ctx.moveTo(pad.l, y + 0.5);
      ctx.lineTo(w - pad.r, y + 0.5);
      ctx.stroke();

      const value = maxV - range * tick / 4;
      ctx.fillStyle = '#6b7280';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(value.toFixed(1), pad.l - 6, y);
    }

    safeValues.forEach((value, i) => {
      const normalized = (value - minV) / range;
      const barH = Math.max(0, normalized * chartH);
      const x = pad.l + i * slot + (slot - barW) / 2;
      const y = pad.t + chartH - barH;

      ctx.fillStyle = safeColors[i % safeColors.length];
      ctx.fillRect(x, y, barW, barH);

      ctx.fillStyle = '#e8ecf1';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(value.toFixed(1), x + barW / 2, Math.max(pad.t + 10, y - 4));

      ctx.fillStyle = '#6b7280';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textBaseline = 'top';
      const label = String(safeLabels[i] ?? '');
      ctx.fillText(label.length > 10 ? label.slice(0, 9) + '…' : label, x + barW / 2, h - pad.b + 8);
    });
  }
};

// ================================================================
// THREE.JS WEBGL 3D GRID ENGINE
// ================================================================
