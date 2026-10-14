/* Courtside – Oberfläche. Rendert die Ansichten, verwaltet Speicher, Navigation, Timer, Anmeldung und Eingaben. */
(() => {
  'use strict';
  const E = window.Engine;
  const C = window.CONTENT;
  const VERSION = '2.0.0';
  const MODE_ORDER = ['americano', 'mexicano', 'kotc', 'team'];

  /* ---------- Hilfen ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} min` : `${Math.round(m)} min`);
  const clockText = (sec) => {
    const over = sec < 0;
    const s = Math.abs(Math.round(sec));
    return (over ? '+' : '') + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  const dateDE = (iso) => { try { return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }); } catch (e) { return ''; } };
  const timeDE = (ms) => new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const shuffled = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const lvlBadge = (p) => { const l = E.levelLabel(p); return l ? `<span class="badge lvl lv-${esc(p.level || '')}">${esc(l)}</span>` : ''; };

  /* ---------- Speicher ---------- */
  const KEY = 'courtside.v1';
  const ME_KEY = 'courtside.me';
  const DEFAULT_SETTINGS = { design: 'auto', sound: true, vibrate: true, shareUrl: '', sport: 'padel' };
  // Gespeicherte Turniere früherer Versionen: nur, was mit den heutigen Modi weiterläuft.
  function compatible(t) {
    if (!t || !t.id) return false;
    if (t.mode === 'team_americano') t.mode = 'team';
    if (t.status === 'draft') return !!E.MODES[t.mode];
    return !!E.MODES[t.mode] && !!E.FORMATS[t.format] && Array.isArray(t.rounds) && !(t.mode === 'kotc' && t.options && t.options.swap);
  }
  const Store = {
    data: { tournaments: [], settings: Object.assign({}, DEFAULT_SETTINGS), seeded: false },
    persistent: true,
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return;
        const d = JSON.parse(raw);
        if (d && Array.isArray(d.tournaments)) {
          this.data.tournaments = d.tournaments.filter(compatible);
          this.data.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings || {});
          this.data.seeded = !!d.seeded;
        }
      } catch (e) { this.persistent = false; }
    },
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); this.persistent = true; }
      catch (e) {
        if (this.persistent) toast('Der Browser blockiert das Speichern. Nach dem Schließen sind die Daten weg.');
        this.persistent = false;
      }
    }
  };
  const S = () => Store.data.settings;
  const getT = (id) => Store.data.tournaments.find((t) => t.id === id);
  function replaceT(t, oldId = t.id) {
    const i = Store.data.tournaments.findIndex((x) => x.id === oldId);
    if (i >= 0) Store.data.tournaments[i] = t; else Store.data.tournaments.unshift(t);
  }
  const Me = {
    all() { try { return JSON.parse(localStorage.getItem(ME_KEY) || '{}') || {}; } catch (e) { return {}; } },
    get(eventId) { return this.all()[eventId] || null; },
    set(eventId, v) {
      const all = this.all();
      if (v) all[eventId] = v; else delete all[eventId];
      try { localStorage.setItem(ME_KEY, JSON.stringify(all)); } catch (e) { /* nur für diese Sitzung */ }
    }
  };

  /* ---------- Rückgängig ---------- */
  const undoStacks = new Map();
  function snapshot(t, label) {
    const s = undoStacks.get(t.id) || [];
    s.push({ json: JSON.stringify(t), label });
    if (s.length > 30) s.shift();
    undoStacks.set(t.id, s);
  }
  const canUndo = (t) => (undoStacks.get(t.id) || []).length > 0;
  function undo(t) {
    const s = t && undoStacks.get(t.id);
    if (!s || !s.length) return;
    const { json, label } = s.pop();
    replaceT(JSON.parse(json));
    Store.save();
    render();
    toast(`Rückgängig: ${label}`);
    haptic();
  }
  // Ändert ein Turnier mit Undo-Punkt. fn darf {ok:false, error} liefern.
  function mutate(t, label, fn) {
    snapshot(t, label);
    let r;
    try { r = fn(t); } catch (e) { r = { ok: false, error: e.message || 'Das hat nicht geklappt.' }; }
    if (r && r.ok === false) {
      undoStacks.get(t.id).pop();
      toast(r.error || 'Das hat nicht geklappt.');
      return r;
    }
    t.updatedAt = new Date().toISOString();
    Store.save();
    render();
    haptic();
    return r || { ok: true };
  }

  /* ---------- Plattform ---------- */
  let PLATFORM = 'ios';
  function detectPlatform() {
    const ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'android';
    if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Mac OS X/.test(ua)) return 'ios';
    return 'android';
  }
  let robotoLoaded = false;
  function applyPlatform() {
    const d = S().design;
    PLATFORM = d === 'ios' || d === 'android' ? d : detectPlatform();
    const root = document.documentElement;
    if (root.dataset.platform !== PLATFORM) root.dataset.platform = PLATFORM;
    if (PLATFORM === 'android' && !robotoLoaded && !/android/i.test(navigator.userAgent)) {
      robotoLoaded = true;
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap';
      document.head.appendChild(l);
    }
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    if (metas[0]) metas[0].content = PLATFORM === 'android' ? '#F9F9FF' : '#F2F2F7';
    if (metas[1]) metas[1].content = PLATFORM === 'android' ? '#111318' : '#000000';
  }
  const icon = (name, cls = '') => {
    const v = name === 'back' || name === 'share' || name === 'more' ? `${name}-${PLATFORM}` : name;
    return `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${v}"/></svg>`;
  };

  /* ---------- Spielfeld-Grafik (Maße in Dezimetern, Länge waagerecht) ---------- */
  const COURTS = {
    padel: { w: 200, h: 100 },          // 20 × 10 m
    pickleball: { w: 134.1, h: 61 },    // 13,41 × 6,10 m
    tennis: { w: 237.7, h: 109.7 }      // 23,77 × 10,97 m
  };
  function courtLines(sport) {
    const { w, h } = COURTS[sport] || COURTS.padel;
    const L = (x1, y1, x2, y2, c = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${c ? ` class="${c}"` : ''}/>`;
    const n = w / 2;
    const box = `<rect x="0" y="0" width="${w}" height="${h}" class="wall"/>` + L(n, 0, n, h, 'net');
    if (sport === 'pickleball') return box + L(n - 21.3, 0, n - 21.3, h) + L(n + 21.3, 0, n + 21.3, h) + L(0, h / 2, n - 21.3, h / 2) + L(n + 21.3, h / 2, w, h / 2);
    if (sport === 'tennis') return box + L(0, 13.7, w, 13.7) + L(0, h - 13.7, w, h - 13.7) + L(n - 64, 13.7, n - 64, h - 13.7) + L(n + 64, 13.7, n + 64, h - 13.7) + L(n - 64, h / 2, n + 64, h / 2);
    return box + L(n - 69.5, 0, n - 69.5, h) + L(n + 69.5, 0, n + 69.5, h) + L(n - 69.5, h / 2, n + 69.5, h / 2);
  }
  const linesSVG = (sport, cls = 'lines') => {
    const { w, h } = COURTS[sport] || COURTS.padel;
    return `<svg class="${cls}" viewBox="-2 -2 ${w + 4} ${h + 4}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${courtLines(sport)}</svg>`;
  };
  const courtRatio = (sport) => { const { w, h } = COURTS[sport] || COURTS.padel; return `${w} / ${h}`; };
  const sportMark = (sport) => `<span class="sport-mark c-${sport}" aria-hidden="true">${linesSVG(sport, '')}</span>`;

  /* ---------- Signale: Ton, Vibration, Sprache, Bildschirm an ---------- */
  function haptic(pattern = 8) {
    if (!S().vibrate || !navigator.vibrate) return;
    try { navigator.vibrate(pattern); } catch (e) { /* nicht unterstützt */ }
  }
  const Sound = {
    ctx: null,
    unlock() {
      try {
        if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) this.ctx = new AC(); }
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) { this.ctx = null; }
    },
    beep(freq, dur, when = 0, vol = 0.3) {
      if (!S().sound || !this.ctx) return;
      try {
        const t0 = this.ctx.currentTime + when;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = 'sine'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(t0); o.stop(t0 + dur + 0.05);
      } catch (e) { /* Audio nicht verfügbar */ }
    },
    warn() { this.beep(880, 0.2); this.beep(880, 0.2, 0.3); },
    end() { this.beep(988, 0.35, 0, 0.4); this.beep(988, 0.35, 0.45, 0.4); this.beep(1318, 0.8, 0.9, 0.45); }
  };
  function speak(text) {
    if (!('speechSynthesis' in window)) { toast('Vorlesen wird von diesem Browser nicht unterstützt.'); return; }
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'de-DE';
      const v = speechSynthesis.getVoices().find((x) => x.lang && x.lang.toLowerCase().startsWith('de'));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) { toast('Vorlesen hat nicht geklappt.'); }
  }
  let wakeLock = null, wantWake = false;
  async function syncWake() {
    try {
      if (wantWake && !wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!wantWake && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) { wakeLock = null; }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { syncWake(); tick(); } });

  /* ---------- Ebenen: Sheets, Dialoge, Menüs, Toasts ---------- */
  const overlays = [];
  let histOK = true, ignorePops = 0, pendingRender = false;
  function openLayer(html, { cls = '', onClose, dismissable = true } = {}) {
    const el = document.createElement('div');
    el.className = 'layer ' + cls;
    el.innerHTML = html;
    $('#layers').appendChild(el);
    const o = { el, onClose, closed: false, hist: false };
    overlays.push(o);
    if (histOK) { try { history.pushState({ cs: 'o' }, ''); o.hist = true; } catch (e) { histOK = false; } }
    const scrim = el.querySelector('.scrim');
    if (scrim && dismissable) scrim.addEventListener('click', () => closeLayer(o));
    return o;
  }
  function removeOverlay(o) {
    const i = overlays.indexOf(o);
    if (i >= 0) overlays.splice(i, 1);
    if (o.closed) return;
    o.closed = true;
    o.el.classList.add('out');
    setTimeout(() => o.el.remove(), 240);
    if (o.onClose) o.onClose();
    if (o.resolve) o.resolve();
    if (pendingRender && !overlays.length) { pendingRender = false; render(); }
  }
  function closeLayer(o) {
    return new Promise((res) => {
      if (!o || o.closed) { res(); return; }
      o.resolve = res;
      if (o.hist && histOK) {
        history.back();
        // Falls der Browser kein popstate liefert, trotzdem schließen.
        setTimeout(() => { if (!o.closed) { ignorePops++; removeOverlay(o); } }, 600);
      } else removeOverlay(o);
    });
  }
  const topLayer = () => overlays[overlays.length - 1];

  let toastTimer = null;
  function toast(msg, action) {
    document.querySelectorAll('.toast').forEach((x) => x.remove());
    const el = document.createElement('div');
    el.className = 'toast' + (PLATFORM === 'ios' ? ' glass' : '');
    el.setAttribute('role', 'status');
    el.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button class="btn-text" type="button">${esc(action.label)}</button>` : '');
    document.body.appendChild(el);
    if (action) el.querySelector('button').addEventListener('click', () => { el.remove(); action.fn(); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), action ? 5000 : 2800);
  }

  // Dialog mit frei wählbaren Aktionen. Liefert den value der gewählten Aktion (oder null).
  function dialog({ title, text = '', body = '', actions, onOpen, collect }) {
    return new Promise((resolve) => {
      const acts = actions || [{ label: 'OK', value: true, kind: 'filled' }];
      const stack = PLATFORM === 'ios' && acts.length > 2;
      const html = `<div class="scrim"></div><div class="dialog" role="alertdialog" aria-modal="true" aria-label="${esc(title)}">
        <h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${body}
        <div class="acts${stack ? ' stack' : ''}">${acts.map((a, i) => `<button class="btn ${a.kind || ''}" data-i="${i}" type="button">${esc(a.label)}</button>`).join('')}</div></div>`;
      let result = null;
      const o = openLayer(html, { onClose: () => resolve(result) });
      o.el.querySelectorAll('.acts button').forEach((b) => b.addEventListener('click', () => {
        const a = acts[Number(b.dataset.i)];
        result = a.value;
        if (a.value && collect) { const c = collect(o.el); if (c === false) return; result = c; }
        closeLayer(o);
      }));
      if (onOpen) onOpen(o.el);
    });
  }
  const confirmDialog = (title, text, okLabel = 'OK', danger = false) => dialog({
    title, text, actions: [{ label: 'Abbrechen', value: false }, { label: okLabel, value: true, kind: danger ? 'danger' : 'filled' }]
  });
  function promptDialog(title, value = '', { placeholder = '', ok = 'Sichern', multiline = false, text = '' } = {}) {
    const field = multiline
      ? `<textarea class="input" id="dlg-in" placeholder="${esc(placeholder)}" rows="6">${esc(value)}</textarea>`
      : `<input class="input" id="dlg-in" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off" enterkeyhint="done">`;
    return dialog({
      title, text, body: field,
      actions: [{ label: 'Abbrechen', value: null }, { label: ok, value: true, kind: 'filled' }],
      collect: (el) => el.querySelector('#dlg-in').value,
      onOpen: (el) => {
        const inp = el.querySelector('#dlg-in');
        setTimeout(() => { inp.focus(); if (!multiline) inp.select(); }, 60);
        if (!multiline) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.querySelector('.acts button:last-child').click(); });
      }
    });
  }

  function menu(anchor, items) {
    const r = anchor.getBoundingClientRect();
    const html = `<div class="scrim" style="background:transparent"></div><div class="menu" role="menu">${items.map((it, i) => it === '-' ? '<hr>' :
      `<button role="menuitem" data-i="${i}" class="${it.danger ? 'danger' : ''}" type="button"><span>${esc(it.label)}</span>${it.icon ? icon(it.icon, 'sm') : ''}</button>`).join('')}</div>`;
    const o = openLayer(html);
    const m = o.el.querySelector('.menu');
    const w = Math.max(230, m.offsetWidth);
    const left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8);
    let top = r.bottom + 6;
    if (top + m.offsetHeight > window.innerHeight - 8) top = Math.max(8, window.innerHeight - m.offsetHeight - 8);
    m.style.left = left + 'px';
    m.style.top = top + 'px';
    m.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      const it = items[Number(b.dataset.i)];
      closeLayer(o).then(() => it.fn());
    }));
  }

  function sheet({ title, body, foot = '', onClose, cancelLabel = 'Abbrechen', doneLabel = '' }) {
    const html = `<div class="scrim"></div><section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="grabber"></div>
      <div class="sheet-h"><div class="l"><button class="btn-text" data-sheet="close" type="button">${esc(cancelLabel)}</button></div><div class="t">${esc(title)}</div>
        <div class="r">${doneLabel && PLATFORM === 'ios' ? `<button class="btn-text" data-sheet="done" type="button" style="font-weight:600">${esc(doneLabel)}</button>` : `<button class="iconbtn" data-sheet="close" type="button" aria-label="Schließen" ${PLATFORM === 'ios' ? 'hidden' : ''}>${icon('close')}</button>`}</div></div>
      <div class="sheet-b">${body}</div>${foot ? `<div class="sheet-f">${foot}</div>` : ''}</section>`;
    const o = openLayer(html, { onClose });
    o.el.querySelectorAll('[data-sheet="close"]').forEach((b) => b.addEventListener('click', () => closeLayer(o)));
    return o;
  }

  async function copyText(text, msg = 'Kopiert') {
    try {
      await navigator.clipboard.writeText(text);
      toast(msg);
    } catch (e) {
      dialog({
        title: 'Zum Kopieren markieren', text: 'Automatisches Kopieren ist hier gesperrt. Text antippen, alles markieren, kopieren.',
        body: `<textarea class="input" readonly rows="7" id="cp">${esc(text)}</textarea>`,
        actions: [{ label: 'Fertig', value: true, kind: 'filled' }],
        onOpen: (el) => { const ta = el.querySelector('#cp'); setTimeout(() => { ta.focus(); ta.select(); }, 60); }
      });
    }
  }
  function shareOut(text, title, url) {
    if (navigator.share) {
      navigator.share(url ? { title, text, url } : { title, text }).catch((e) => {
        if (!e || e.name !== 'AbortError') copyText(url ? `${text}\n${url}` : text, 'In die Zwischenablage kopiert');
      });
      return;
    }
    copyText(url ? `${text}\n${url}` : text, 'In die Zwischenablage kopiert');
  }

  /* ---------- Online-Anmeldung (Server unter /api) ---------- */
  const embedded = () => { try { return window.self !== window.top; } catch (e) { return true; } };
  const API = {
    available: () => !embedded() && /^https?:$/.test(location.protocol),
    async call(method, path, body, key) {
      const headers = { 'content-type': 'application/json' };
      if (key) headers.authorization = `Bearer ${key}`;
      let res;
      try { res = await fetch('/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); }
      catch (e) { throw new Error('Keine Verbindung. Bitte Internet prüfen und erneut versuchen.'); }
      let data = null;
      try { data = await res.json(); } catch (e) { data = null; }
      if (!res.ok) throw new Error((data && data.error) || (res.status === 404 ? 'Die Online-Anmeldung ist hier nicht eingerichtet.' : `Fehler ${res.status}`));
      return data;
    }
  };
  const appBase = () => {
    const own = (S().shareUrl || '').trim();
    if (own) return own.split('#')[0].split('?')[0];
    return location.origin + location.pathname;
  };
  const regUrl = (eventId) => `${appBase()}?anmeldung=${encodeURIComponent(eventId)}`;
  const personalUrl = (eventId, me) => `${regUrl(eventId)}&ich=${encodeURIComponent(me.pid)}#k=${encodeURIComponent(me.token)}`;
  const personPayload = (p) => ({ name: p.name, level: p.level, rating: p.rating == null ? null : p.rating });

  /* ---------- Navigation ---------- */
  const nav = { tab: 'turniere', stack: [], modeSport: null };
  const route = () => nav.stack[nav.stack.length - 1] || null;
  function go(r) {
    nav.stack.push(r);
    if (histOK) { try { history.pushState({ cs: 'v' }, ''); } catch (e) { histOK = false; } }
    window.scrollTo(0, 0);
    render('push');
  }
  function popView() {
    if (!nav.stack.length) return;
    nav.stack.pop();
    render('pop');
    window.scrollTo(0, 0);
  }
  function uiBack() { if (histOK) history.back(); else popView(); }
  window.addEventListener('popstate', () => {
    if (ignorePops > 0) { ignorePops--; return; }
    const top = topLayer();
    if (top) { removeOverlay(top); return; }
    popView();
  });
  function setTab(tab) {
    if (nav.tab === tab && !nav.stack.length) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    nav.tab = tab;
    nav.stack = [];
    window.scrollTo(0, 0);
    render('tab');
  }

  /* ---------- Rendern ---------- */
  const TABS = [
    { id: 'turniere', label: 'Turniere', icon: 'trophy', view: () => viewTournaments() },
    { id: 'modi', label: 'Modi', icon: 'book', view: () => viewModes() },
    { id: 'teilen', label: 'Teilen', icon: 'qr', view: () => viewShare() },
    { id: 'einstellungen', label: 'Einstellungen', icon: 'gear', view: () => viewSettings() }
  ];
  let currentView = null;
  function render(anim) {
    applyPlatform();
    if (Player.eventId) return Player.render();
    const r = route();
    let v;
    if (r && r.name === 't') {
      const t = getT(r.id);
      if (!t) { nav.stack.pop(); return render(); }
      v = t.status === 'draft' ? viewDraft(t) : viewTournament(t, r);
    } else if (r && r.name === 'mode') v = viewMode(r.id, r.sport);
    else v = TABS.find((x) => x.id === nav.tab).view();
    paint(v, { anim, back: !!r, tabs: !r });
    wantWake = !!(r && r.name === 't' && getT(r.id) && getT(r.id).status === 'running');
    syncWake();
    tick();
  }
  function paint(v, { anim, back, tabs }) {
    currentView = v;
    document.body.classList.toggle('no-tabs', !tabs);
    const bar = $('#topbar');
    bar.querySelector('.tb-left').innerHTML = back ? `<button class="navbtn icon" data-act="back" type="button" aria-label="Zurück">${icon('back')}</button>` : '';
    bar.querySelector('.tb-title').textContent = v.title;
    bar.querySelector('.tb-right').innerHTML = v.right || '';
    bar.classList.toggle('solid', !v.large);
    const view = $('#view');
    view.innerHTML = (v.large ? `<h1 class="large-title">${esc(v.title)}</h1>` : '') + v.body;
    if (anim) {
      view.classList.remove('view-enter-push', 'view-enter-pop', 'view-enter-tab');
      void view.offsetWidth;
      view.classList.add('view-enter-' + anim);
    }
    $('#tabbar').innerHTML = tabs ? TABS.map((x) => `<button class="tab${x.id === nav.tab ? ' on' : ''}" data-act="tab" data-tab="${x.id}" type="button" aria-current="${x.id === nav.tab ? 'page' : 'false'}"><span class="pill">${icon(x.icon)}</span><span>${x.label}</span></button>`).join('') : '';
    $('#tabbar').classList.toggle('glass', PLATFORM === 'ios');
    const fab = $('#fab');
    fab.hidden = !(PLATFORM === 'android' && tabs && nav.tab === 'turniere');
    fab.innerHTML = `${icon('plus')}<span>Neues Turnier</span>`;
    onScroll();
    if (v.after) v.after();
  }
  function onScroll() {
    $('#topbar').classList.toggle('scrolled', window.scrollY > (currentView && currentView.large ? 36 : 2));
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Level-Eingabe (Turnierleitung und Spielerseite) ---------- */
  function personFields(p = {}, prefix = 'pf') {
    const cards = Object.values(E.LEVELS).map((l) => `<button type="button" class="lvl-card lv-${l.id}" data-level="${l.id}" aria-pressed="${p.level === l.id}">
      <span class="lt">${esc(l.name)}</span><span class="ld">${esc(C.levels[l.id])}</span><span class="lh">${esc(l.hint)}</span></button>`).join('');
    return `<div class="field"><label for="${prefix}-name">Name</label><input class="input" id="${prefix}-name" value="${esc(p.name || '')}" maxlength="40" autocomplete="name" autocapitalize="words" enterkeyhint="next" placeholder="Vorname und Initiale, z. B. Anna B."></div>
      <div class="field"><span class="lbl">Wie stark spielst du?</span><div class="lvl-pick" role="radiogroup">${cards}</div></div>
      <div class="field"><label for="${prefix}-rating">Playtomic-Level (falls vorhanden)</label><input class="input" id="${prefix}-rating" inputmode="decimal" maxlength="4" value="${p.rating != null ? String(p.rating).replace('.', ',') : ''}" placeholder="z. B. 3,2" autocomplete="off"><p class="foot" style="padding:0 4px">Mit Playtomic-Level teilt die App genauer ein.</p></div>`;
  }
  // Liest die Felder aus; liefert {error} oder die Person.
  function readPerson(root, prefix = 'pf') {
    const name = root.querySelector(`#${prefix}-name`).value.trim();
    const sel = root.querySelector('.lvl-card[aria-pressed="true"]');
    const rawRating = root.querySelector(`#${prefix}-rating`).value.trim();
    const rating = E.parseRating(rawRating);
    if (!name) return { error: 'Bitte einen Namen eingeben.' };
    if (rawRating && rating == null) return { error: 'Das Playtomic-Level liegt zwischen 0 und 7, z. B. 3,2.' };
    const level = sel ? sel.dataset.level : rating != null ? E.levelFromRating(rating) : null;
    if (!level) return { error: 'Bitte ein Level wählen.' };
    return { name: name.slice(0, 40), level, rating };
  }
  function bindLevelCards(root) {
    root.addEventListener('click', (ev) => {
      const b = ev.target.closest('.lvl-card');
      if (!b) return;
      root.querySelectorAll('.lvl-card').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      haptic(5);
    });
  }
  // Sheet zum Anlegen/Ändern einer Person. onSave darf ein Promise liefern und mit Error ablehnen.
  function openPersonSheet({ title, person = {}, onSave, onDelete, saveLabel = 'Sichern' }) {
    const o = sheet({
      title, body: `${personFields(person, 'ps')}<p class="note err" id="ps-err" hidden></p>`,
      foot: `${onDelete ? `<button class="btn danger" type="button" data-del>${icon('trash', 'sm')}Entfernen</button>` : ''}<button class="btn filled big" type="button" data-save>${esc(saveLabel)}</button>`,
      doneLabel: saveLabel
    });
    const root = o.el;
    bindLevelCards(root);
    const err = root.querySelector('#ps-err');
    const save = async () => {
      const p = readPerson(root, 'ps');
      if (p.error) { err.textContent = p.error; err.hidden = false; return; }
      root.querySelectorAll('[data-save],[data-sheet="done"]').forEach((b) => { b.disabled = true; });
      try { await onSave(p); closeLayer(o); }
      catch (e) { err.textContent = e.message; err.hidden = false; root.querySelectorAll('[data-save],[data-sheet="done"]').forEach((b) => { b.disabled = false; }); }
    };
    root.querySelectorAll('[data-save],[data-sheet="done"]').forEach((b) => b.addEventListener('click', save));
    const del = root.querySelector('[data-del]');
    if (del) del.addEventListener('click', async () => {
      try { await onDelete(); closeLayer(o); } catch (e) { err.textContent = e.message; err.hidden = false; }
    });
    if (!person.name) setTimeout(() => { const i = root.querySelector('#ps-name'); if (i) i.focus(); }, 300);
  }

  /* ---------- Teambildung ---------- */
  const TEAM_STRATEGIES = [
    ['similar', 'Gleich stark', 'Gut spielt mit gut. Die stärksten Teams starten oben.'],
    ['balanced', 'Ausgeglichen', 'Eine stärkere mit einer schwächeren Person – alle Teams etwa gleich stark.'],
    ['random', 'Zufall', 'Teams werden ausgelost, das Level spielt keine Rolle.']
  ];
  const fmtStrength = (s) => (s == null ? '' : `Ø ${s.toFixed(1).replace('.', ',')}`);
  // Zeigt die Teams, lässt Personen tauschen und liefert die Teams an onStart.
  function openTeamBuilder({ people, mode, onStart }) {
    let strategy = E.MODES[mode].teams || 'balanced';
    let res = E.buildTeams(people, strategy);
    let pick = null; // [teamIndex, memberIndex]
    const body = () => {
      const st = TEAM_STRATEGIES.find((x) => x[0] === strategy);
      const rows = res.teams.map((tm, ti) => `<div class="team-row"><span class="tn">${ti + 1}</span><span class="members">${tm.map((p, mi) =>
        `<button type="button" class="member${pick && pick[0] === ti && pick[1] === mi ? ' picked' : ''}" data-t="${ti}" data-m="${mi}"><span>${esc(p.name)}</span>${lvlBadge(p)}</button>`).join('')}</span>
        <span class="ts">${fmtStrength(E.strengthOf({ members: tm }))}</span></div>`).join('');
      return `<div class="seg">${TEAM_STRATEGIES.map(([k, l]) => `<button type="button" data-strat="${k}" aria-pressed="${k === strategy}">${l}</button>`).join('')}</div>
        <p class="foot">${esc(st[2])} Zum Tauschen zwei Namen nacheinander antippen.</p>
        <div class="teams">${rows}</div>
        ${res.leftover ? `<p class="note warn">${esc(res.leftover.name)} hat noch kein Team. Ergänze eine Person oder nimm jemanden heraus.</p>` : ''}`;
    };
    const ok = () => !res.leftover && res.teams.length >= E.MODES[mode].min;
    const o = sheet({
      title: 'Teams bilden', body: body(),
      foot: `<button class="btn tonal" type="button" data-reroll>${icon('shuffle', 'sm')}Neu mischen</button><button class="btn filled big" type="button" data-go>Turnier starten</button>`
    });
    const sb = o.el.querySelector('.sheet-b');
    const refresh = () => {
      sb.innerHTML = body();
      o.el.querySelector('[data-go]').disabled = !ok();
    };
    refresh();
    if (res.teams.length < E.MODES[mode].min) toast(`Für diesen Modus braucht es mindestens ${E.MODES[mode].min} Teams.`);
    o.el.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b || !o.el.contains(b)) return;
      if (b.dataset.strat) { strategy = b.dataset.strat; res = E.buildTeams(people, strategy); pick = null; refresh(); }
      else if (b.dataset.reroll !== undefined) { res = E.buildTeams(people, strategy); pick = null; refresh(); haptic(); }
      else if (b.dataset.t !== undefined) {
        const here = [Number(b.dataset.t), Number(b.dataset.m)];
        if (!pick) pick = here;
        else if (pick[0] === here[0] && pick[1] === here[1]) pick = null;
        else {
          const a = res.teams[pick[0]][pick[1]];
          res.teams[pick[0]][pick[1]] = res.teams[here[0]][here[1]];
          res.teams[here[0]][here[1]] = a;
          pick = null;
          haptic();
        }
        refresh();
      } else if (b.dataset.go !== undefined && ok()) {
        const entrants = res.teams.map((tm) => ({ name: tm.map((p) => p.name).join(' / '), members: tm.map((p) => ({ name: p.name, level: p.level, rating: p.rating })) }));
        closeLayer(o).then(() => onStart(entrants));
      }
    });
  }

  /* ---------- Turnier-Liste ---------- */
  function statusLine(t) {
    const info = C.modes[t.mode];
    if (t.status === 'draft') return `${info.name} · ${(t.players || []).length} angemeldet`;
    if (t.status === 'finished') {
      const p = E.podium(t);
      return `${info.name} · ${p.length ? `Sieg: ${p[0].join(', ')}` : 'Beendet'}`;
    }
    const planned = t.mode === 'team' ? t.rounds.length : t.options.rounds;
    return `${info.name} · Runde ${t.cur + 1} von ${planned}`;
  }
  function tournamentCell(t) {
    const trail = t.status === 'draft' ? '<span class="badge warn">Anmeldung</span>' : t.status === 'running' ? '<span class="badge live">läuft</span>' : esc(dateDE(t.finishedAt || t.updatedAt));
    return `<button class="cell tappable" data-act="open-t" data-id="${t.id}" type="button">
      ${sportMark(t.sport)}
      <span class="body"><span class="t1">${esc(t.name)}${t.demo ? ' <span class="badge tint">Beispiel</span>' : ''}</span><span class="t2">${esc(statusLine(t))}</span></span>
      <span class="trail">${trail}${icon('chev', 'sm chev')}</span></button>`;
  }
  function viewTournaments() {
    const list = Store.data.tournaments.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const group = (title, items) => (items.length ? `<section class="section"><div class="section-h"><h2>${title}</h2></div><div class="list">${items.map(tournamentCell).join('')}</div></section>` : '');
    let body;
    if (!list.length) {
      body = `<div class="empty card">${sportMark('padel')}<h2>Noch kein Turnier</h2>
        <p>Lege ein Americano, Mexicano oder King of the Court an. Spieler melden sich per Link selbst an, die App bildet Teams nach Level und sagt dir, was als Nächstes dran ist.</p>
        <div class="row" style="justify-content:center"><button class="btn filled big" data-act="new" type="button">${icon('plus')}Neues Turnier</button>
        <button class="btn" data-act="demo" type="button">Beispiel ansehen</button></div></div>`;
    } else {
      body = group('In Anmeldung', list.filter((t) => t.status === 'draft')) + group('Laufend', list.filter((t) => t.status === 'running')) + group('Beendet', list.filter((t) => t.status === 'finished'));
    }
    if (!Store.persistent) body += '<p class="note warn">Dieser Browser speichert nichts dauerhaft. Sichere wichtige Turniere über Einstellungen → Sicherung kopieren.</p>';
    return {
      title: 'Turniere', large: true, body,
      right: PLATFORM === 'ios' ? `<button class="navbtn icon tint" data-act="new" type="button" aria-label="Neues Turnier">${icon('plus')}</button>` : ''
    };
  }

  /* ---------- Anmeldung (Turnierleitung) ---------- */
  const draftSync = new Map(); // id → {at, busy, error}
  async function refreshDraft(t, { quiet = true } = {}) {
    const sync = draftSync.get(t.id) || {};
    if (sync.busy || !t.reg || !API.available()) return;
    sync.busy = true;
    draftSync.set(t.id, sync);
    try {
      const { event } = await API.call('GET', `/events/${t.reg.eventId}`, null, t.reg.adminKey);
      const cur = getT(t.id);
      if (cur) { cur.players = event.players; cur.reg.open = event.open; Store.save(); }
      sync.error = null;
      sync.at = Date.now();
    } catch (e) {
      sync.error = e.message;
      if (!quiet) toast(e.message);
    }
    sync.busy = false;
    const r = route();
    if (r && r.id === t.id) { if (overlays.length) pendingRender = true; else render(); }
  }
  async function adminCall(t, method, path, body) {
    const res = await API.call(method, `/events/${t.reg.eventId}${path}`, body, t.reg.adminKey);
    await refreshDraft(t);
    return res;
  }

  function viewDraft(t) {
    const players = t.players || [];
    const m = E.MODES[t.mode];
    const info = C.modes[t.mode];
    const teamMode = m.unit === 'team' && t.cfg.discipline !== 'singles';
    const need = teamMode ? m.min * 2 : m.min;
    const sync = draftSync.get(t.id) || {};
    const url = regUrl(t.reg.eventId);
    const svg = qrSVG(url);
    const rows = players.map((p) => `<button class="cell tappable" type="button" data-act="d-edit" data-pid="${p.id}"><span class="body"><span class="t1">${esc(p.name)}</span></span>${lvlBadge(p)}${icon('chev', 'sm chev')}</button>`).join('');
    const enough = players.length >= need;
    const body = `
      <section class="card next"><div class="state"><span class="badge ${t.reg.open ? 'live' : 'warn'}">${t.reg.open ? 'Anmeldung offen' : 'Anmeldung geschlossen'}</span></div>
        <h2>${players.length} angemeldet</h2>
        <p>${esc(info.name)} · ${esc(E.SPORTS[t.sport].name)}${t.reg.when ? ' · ' + esc(t.reg.when) : ''}. ${enough ? (teamMode ? 'Die App bildet die Teams nach Level.' : 'Bereit zum Start.') : `Es fehlen noch ${need - players.length}.`}</p>
        <div class="actions"><button class="btn filled big" type="button" data-act="d-start" ${enough ? '' : 'disabled'}>${teamMode ? 'Teams bilden & starten' : 'Turnier starten'}</button></div></section>
      <section class="card qr-card"><div class="qr">${svg || '<p class="qr-empty">QR-Code nicht verfügbar.</p>'}</div><p class="url">${esc(url)}</p>
        <div class="row" style="justify-content:center"><button class="btn filled" type="button" data-act="d-share">${icon('share', 'sm')}Einladung teilen</button><button class="btn tonal" type="button" data-act="d-copy">${icon('copy', 'sm')}Link kopieren</button></div>
        <p class="foot" style="padding:0">Alle bekommen denselben Link. Wer sich einträgt, erhält einen eigenen Link, um Name und Level später zu ändern.</p></section>
      <section class="section"><div class="section-h"><h2>Angemeldet</h2><button class="btn-text" type="button" data-act="d-refresh">${icon('reset', 'sm')}Aktualisieren</button></div>
        ${players.length ? `<div class="list">${rows}</div>` : '<p class="foot">Noch niemand. Teile den Link in der Gruppe oder zeig den QR-Code.</p>'}
        <button class="btn tonal" type="button" data-act="d-add">${icon('plus', 'sm')}Person eintragen</button>
        <p class="foot">${sync.error ? esc(sync.error) : sync.at ? `Stand ${timeDE(sync.at)} · aktualisiert sich alle 15 Sekunden.` : 'Lädt …'}</p></section>
      <section class="section"><div class="section-h"><h2>Einstellungen</h2></div><div class="list"><button type="button" class="cell tappable" data-act="t-settings"><span class="body"><span class="t1">${esc(info.name)} · ${esc((E.FORMATS[t.cfg.format] || {}).name || '')}</span><span class="t2">${t.cfg.courts} ${t.cfg.courts === 1 ? 'Platz' : 'Plätze'}${t.cfg.options.roundMinutes ? ` · Timer ${t.cfg.options.roundMinutes} Min.` : ''}${t.cfg.options.rounds ? ` · ${t.cfg.options.rounds} Runden` : ''}</span></span><span class="trail">Ändern${icon('chev', 'sm chev')}</span></button></div></section>
      <section class="section"><div class="list"><label class="cell"><span class="body"><span class="t1">Anmeldung offen</span><span class="t2">Geschlossen kannst nur du noch Personen eintragen</span></span><input type="checkbox" class="switch" data-on="d-open" ${t.reg.open ? 'checked' : ''}></label></div></section>`;
    return {
      title: t.name, large: false, body,
      right: `<button class="navbtn icon" data-act="d-more" type="button" aria-label="Mehr">${icon('more')}</button>`,
      after: () => { const s = draftSync.get(t.id); if (!s || !s.at) refreshDraft(t); }
    };
  }

  function inviteText(t) {
    const info = C.modes[t.mode];
    return `Anmeldung: ${t.name}${t.reg.when ? ` (${t.reg.when})` : ''}\n${info.name} – ${info.tag}\nHier mit Name und Level eintragen:`;
  }

  async function startFromDraft(t) {
    try { await refreshDraft(t, { quiet: false }); } catch (e) { /* Fehler schon gemeldet */ }
    t = getT(t.id);
    const players = (t.players || []).map((p) => ({ name: p.name, level: p.level, rating: p.rating }));
    const m = E.MODES[t.mode];
    const launch = async (entrants) => {
      const cfg = Object.assign({}, t.cfg, { name: t.name, sport: t.sport, mode: t.mode, entrants, reg: { eventId: t.reg.eventId, adminKey: t.reg.adminKey } });
      let nt;
      try { nt = E.create(cfg); } catch (e) { toast(e.message); return; }
      API.call('PATCH', `/events/${t.reg.eventId}`, { open: false }, t.reg.adminKey).catch(() => {});
      replaceT(nt, t.id);
      Store.save();
      nav.stack[nav.stack.length - 1] = { name: 't', id: nt.id, seg: 'now' };
      render('push');
      haptic([10, 40, 10]);
    };
    if (m.unit === 'team' && t.cfg.discipline !== 'singles') openTeamBuilder({ people: players, mode: t.mode, onStart: launch });
    else launch(players);
  }

  /* ---------- Turnier-Ansicht ---------- */
  function viewTournament(t, r) {
    const seg = r.seg || 'now';
    const segs = [['now', 'Jetzt'], ['table', 'Tabelle'], ['plan', 'Plan']];
    const segHTML = `<div class="${PLATFORM === 'ios' ? 'seg' : 'tabs'}" role="tablist">${segs.map(([k, l]) => `<button type="button" role="tab" data-act="seg" data-seg="${k}" aria-pressed="${k === seg}">${l}</button>`).join('')}</div>`;
    let body = segHTML;
    if (t.demo) body += `<div class="banner">${icon('info', 'sm')}<span>Beispiel-Turnier zum Ausprobieren. Löschen über das Menü oben rechts.</span></div>`;
    body += seg === 'now' ? nowSection(t) : seg === 'table' ? tableSection(t) : planSection(t, r);
    const right = (canUndo(t) ? `<button class="navbtn icon" data-act="undo" type="button" aria-label="Rückgängig">${icon('undo')}</button>` : '') +
      `<button class="navbtn icon" data-act="t-more" type="button" aria-label="Mehr">${icon('more')}</button>`;
    return { title: t.name, large: false, body, right };
  }

  function rulesChips(t) {
    const fmt = E.fmtOf(t);
    const chips = [fmt.name];
    const R = E.RULES[t.sport];
    const ro = R.options.find((o) => o.id === (t.rules[R.key] || R.def));
    if (ro) chips.push(ro.name);
    const serve = E.MODES[t.mode].engine === 'rotation' ? E.serveHint(fmt) : null;
    return `<div class="chips">${chips.map((c) => `<span class="chip static">${esc(c)}</span>`).join('')}</div>` +
      `<p class="foot">${esc([ro && ro.hint, serve].filter(Boolean).join(' '))}</p>` +
      `<button type="button" class="btn-text" data-act="t-settings">${icon('gear', 'sm')}Einstellungen ändern</button>`;
  }

  function timerBlock(t) {
    if (!E.roundTimed(t) || !t.timer || !t.timer.dur) return '';
    const run = !!t.timer.endsAt;
    return `<div class="timer">
      <button type="button" class="clock num" data-clock data-act="timer-edit" aria-live="off" aria-label="Rundenzeit ändern">${clockText(t.timer.dur)}</button>
      <div class="ctl">
        <button class="iconbtn ${run ? 'stop' : 'go'}" data-act="timer-toggle" type="button" aria-label="${run ? 'Pause' : 'Start'}">${icon(run ? 'pause' : 'play')}</button>
        <button class="iconbtn" data-act="timer-plus" type="button" aria-label="Eine Minute mehr"><span class="num" style="font-weight:700;font-size:15px">+1</span></button>
        <button class="iconbtn" data-act="timer-reset" type="button" aria-label="Zurücksetzen">${icon('reset')}</button>
      </div>
      <div class="bar"><span data-bar style="width:100%"></span></div>
      <button type="button" class="btn-text" data-act="timer-edit">${icon('timer', 'sm')}Zeit ändern · ${Math.round(t.timer.dur / 60)} Min. pro Runde</button></div>`;
  }

  // Rundenzeit ändern; eine laufende Runde behält die schon gespielte Zeit.
  function applyRoundMinutes(t, min) {
    const T = t.timer || (t.timer = { dur: 0, endsAt: null, left: null });
    t.options.roundMinutes = min;
    if (!min) { Object.assign(T, { dur: 0, endsAt: null, left: null, warned: false, rang: false }); return; }
    const dur = min * 60;
    if (T.dur && T.endsAt) T.endsAt = Date.now() + (dur - (T.dur - (T.endsAt - Date.now()) / 1000)) * 1000;
    else if (T.dur && T.left != null) T.left = dur - (T.dur - T.left);
    T.dur = dur;
    const left = remaining(t);
    T.warned = left <= 60;
    T.rang = left <= 0;
  }
  function openTimerSheet(t) {
    let min = t.timer && t.timer.dur ? Math.round(t.timer.dur / 60) : 12;
    const has = !!(t.timer && t.timer.dur);
    const required = E.MODES[t.mode].engine === 'ladder' || !!E.fmtOf(t).timed;
    const running = has && !!t.timer.endsAt;
    const body = () => `<div class="timer-pick"><span class="big num">${min} Min.</span>
        <span class="stepper"><button type="button" data-d="-1" aria-label="Eine Minute weniger">${icon('minus', 'sm')}</button><button type="button" data-d="1" aria-label="Eine Minute mehr">${icon('plus', 'sm')}</button></span></div>
      <div class="chips">${[5, 8, 10, 12, 15, 20, 25, 30].map((v) => `<button class="chip" type="button" data-v="${v}" aria-pressed="${v === min}">${v} Min.</button>`).join('')}</div>
      <p class="foot">${running ? 'Die laufende Runde wird angepasst, die schon gespielte Zeit zählt mit. ' : ''}Gilt für diese und alle folgenden Runden.</p>`;
    const o = sheet({
      title: 'Rundenzeit', body: body(), doneLabel: 'Fertig',
      foot: `${has && !required ? `<button class="btn danger" type="button" data-off>Timer aus</button>` : ''}<button class="btn filled big" type="button" data-save>Übernehmen</button>`
    });
    const apply = (value) => {
      applyRoundMinutes(t, value);
      Store.save();
      closeLayer(o).then(() => { render(); toast(value ? `Rundenzeit: ${value} Min.` : 'Timer ausgeschaltet'); });
    };
    o.el.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b || !o.el.contains(b)) return;
      if (b.dataset.d) { min = Math.max(1, Math.min(90, min + Number(b.dataset.d))); haptic(4); }
      else if (b.dataset.v) min = Number(b.dataset.v);
      else if (b.dataset.save !== undefined || b.dataset.sheet === 'done') return apply(min);
      else if (b.dataset.off !== undefined) return apply(0);
      else return;
      o.el.querySelector('.sheet-b').innerHTML = body();
    });
  }

  function nextCard(t) {
    const n = E.next(t);
    const badge = { ready: '<span class="badge tint">Bereit</span>', live: '<span class="badge live">Läuft</span>', between: '<span class="badge warn">Weiter geht’s</span>', last: '<span class="badge warn">Fertig?</span>' }[n.state] || '';
    const acts = [];
    if (n.action) acts.push(`<button class="btn filled big" data-act="next" data-id="${n.action.id}"${n.action.match ? ` data-match="${n.action.match}"` : ''} type="button">${esc(n.action.label)}</button>`);
    if (n.alt) acts.push(`<button class="btn tonal big" data-act="next" data-id="${n.alt.id}" type="button">${esc(n.alt.label)}</button>`);
    const addTimer = t.status === 'running' && !(E.roundTimed(t) && t.timer && t.timer.dur) ? `<button type="button" class="btn-text" data-act="timer-edit">${icon('timer', 'sm')}Timer hinzufügen</button>` : '';
    return `<section class="card next"><div class="state">${badge}</div><h2>${esc(n.title)}</h2><p>${esc(n.text)}</p>${timerBlock(t)}${acts.length ? `<div class="actions">${acts.join('')}</div>` : ''}${addTimer}</section>`;
  }

  function moveHint(t, m) {
    const r = t.rounds[t.cur];
    const k = m.court, last = r.matches.length - 1;
    const up = k === 0 ? `bleibt auf ${t.courts[0]}` : `↑ ${t.courts[k - 1]}`;
    const down = k === last ? (r.byes.length ? 'wartet' : `bleibt auf ${t.courts[k]}`) : `↓ ${t.courts[k + 1]}`;
    return `Sieger ${up} · Verlierer ${down}`;
  }

  function matchCard(t, m, { label, hint = '' } = {}) {
    const fmt = E.fmtOf(t);
    const winnerOnly = fmt.kind === 'winner';
    const done = !!m.w;
    const cls = (s) => (done && m.w !== 'd' ? (m.w === s ? 'win' : 'lose') : '');
    const names = (ids) => ids.map((id) => `<span class="pn">${esc(E.nameOf(t, id))}</span>`).join('');
    const lines = linesSVG(t.sport);
    const center = done
      ? `<span class="net-score">${winnerOnly ? '✓' : esc(E.scoreText(fmt, m.score))}</span>`
      : `<span class="net-score empty">${winnerOnly ? 'Sieger<br>antippen' : 'Ergebnis'}</span>`;
    const style = `style="aspect-ratio:${courtRatio(t.sport)}"`;
    let court;
    if (winnerOnly && !done) {
      const side = (s, ids) => `<button class="side ${s}" type="button" data-act="win" data-match="${m.id}" data-side="${s}" aria-label="Sieg für ${esc(E.sideName(t, ids))}">${names(ids)}</button>`;
      court = `<div class="field-court" ${style}>${lines}${side('a', m.a)}${center}${side('b', m.b)}</div>`;
    } else {
      court = `<button class="field-court" type="button" data-act="result" data-match="${m.id}" aria-label="Ergebnis ${esc(label || '')} eintragen" ${style}>${lines}<span class="side a ${cls('a')}">${names(m.a)}</span>${center}<span class="side b ${cls('b')}">${names(m.b)}</span></button>`;
    }
    const edit = done ? `<button class="btn-text" data-act="result" data-match="${m.id}" type="button">Ändern</button>` : '';
    return `<article class="match c-${t.sport}${done ? ' done' : ''}"><div class="match-h"><span class="name">${esc(label || '')}</span>${edit}</div>${court}${hint ? `<p class="hint">${esc(hint)}</p>` : ''}</article>`;
  }

  function nowSection(t) {
    const m = E.MODES[t.mode];
    let out = t.status === 'finished' ? podiumCard(t) : nextCard(t);
    out += `<section class="section">${rulesChips(t)}</section>`;
    const r = t.rounds[t.cur];
    if (r && t.status === 'running') {
      const cards = r.matches.map((x) => matchCard(t, x, { label: t.courts[x.court], hint: m.engine === 'ladder' && x.w ? moveHint(t, x) : '' })).join('');
      out += `<section class="section"><div class="section-h"><h2>Runde ${t.cur + 1}</h2><button class="btn-text" data-act="speak" type="button">${icon('speaker', 'sm')}Vorlesen</button></div>
        <div class="courts${r.matches.length > 1 ? ' two' : ''}">${cards}</div>
        ${r.byes.length ? `<div class="byes"><strong>${m.engine === 'ladder' ? 'Wartet' : 'Pause'}:</strong> ${r.byes.map((id) => `<span class="chip static">${esc(E.nameOf(t, id))}</span>`).join('')}</div>` : ''}</section>`;
      out += upcomingPreview(t);
    }
    return out;
  }

  function upcomingPreview(t) {
    const m = E.MODES[t.mode];
    if (m.engine !== 'rotation' || m.pairing === 'dynamic') return '';
    const nx = t.rounds[t.cur + 1];
    if (!nx) return '';
    const rows = nx.matches.map((x) => `<div class="pline"><span class="c">${esc(t.courts[x.court])}</span><span>${esc(E.sideName(t, x.a))}</span><span class="s muted">–</span><span class="tb">${esc(E.sideName(t, x.b))}</span></div>`).join('');
    const byes = nx.byes.length ? `<div class="pline byes-line"><span class="c">Pause</span><span>${esc(nx.byes.map((id) => E.nameOf(t, id)).join(', '))}</span></div>` : '';
    return `<section class="section"><div class="section-h"><h2>Danach: Runde ${t.cur + 2}</h2></div><div class="list round">${rows}${byes}</div></section>`;
  }

  function podiumCard(t) {
    const p = E.podium(t);
    if (!p.length) return '<section class="card next"><h2>Turnier beendet</h2><p>Es wurden keine Ergebnisse eingetragen.</p></section>';
    const step = (i, cls) => (p[i] ? `<div class="step ${cls}"><span class="who">${esc(p[i].join(', '))}</span><span class="block">${i + 1}</span></div>` : `<div class="step ${cls}"></div>`);
    return `<section class="card next"><div class="state"><span class="badge tint">${icon('medal', 'sm')} Siegerehrung</span></div><h2>${esc(p[0].join(', '))} gewinnt</h2>
      <div class="podium">${step(1, 'p2')}${step(0, 'p1')}${step(2, 'p3')}</div>
      <div class="actions"><button class="btn filled" data-act="share-table" type="button">${icon('share', 'sm')}Endstand teilen</button><button class="btn tonal" data-act="next" data-id="addRound" type="button">Zusatzrunde</button></div></section>`;
  }

  function tableSection(t) {
    const st = E.standings(t);
    const head = `<tr><th class="r">#</th><th>Name</th>${st.cols.map((c) => `<th>${esc(c.h)}</th>`).join('')}</tr>`;
    const val = (r, c) => { const v = r[c.k]; return c.k === 'diff' && v > 0 ? `+${v}` : esc(v); };
    const body = st.rows.map((r) => `<tr class="${r.active === false ? 'off' : ''}"><td class="r">${r.rank <= 3 ? `<span class="rank r${r.rank}">${r.rank}</span>` : r.rank}</td><td class="n">${esc(r.name)}${r.active === false ? ' <span class="badge">raus</span>' : ''}</td>${st.cols.map((c) => `<td class="${c.strong ? 'strong' : ''}">${val(r, c)}</td>`).join('')}</tr>`).join('');
    return `<section class="section"><div class="table-wrap"><table class="st">${head}${body}</table></div></section>
      <p class="foot">${esc(st.note)}</p>
      <div class="row"><button class="btn tonal" data-act="share-table" type="button">${icon('share', 'sm')}Stand teilen</button></div>`;
  }

  function planSection(t, r) {
    const m = E.MODES[t.mode];
    const fmt = E.fmtOf(t);
    const me = r.me || '';
    const people = t.entrants.slice().sort((a, b) => a.name.localeCompare(b.name, 'de'));
    const mark = (id) => (id === me ? `<span class="me">${esc(E.nameOf(t, id))}</span>` : esc(E.nameOf(t, id)));
    const line = (x, editable) => {
      const nm = (ids, side) => `<span class="${side === 'b' ? 'tb' : ''}${x.w === side ? ' w' : ''}">${ids.map(mark).join(' & ')}</span>`;
      const sc = x.w ? (fmt.kind === 'winner' ? '✓' : esc(E.scoreText(fmt, x.score))) : '–';
      const tag = editable ? 'button' : 'div';
      return `<${tag} class="pline"${editable ? ` type="button" data-act="result" data-match="${x.id}"` : ''}><span class="c">${esc(t.courts[x.court])}</span>${nm(x.a, 'a')}<span class="s">${sc}</span>${nm(x.b, 'b')}</${tag}>`;
    };
    const pick = `<div class="field"><label for="plan-me">Plan für eine Person hervorheben</label><select class="input" id="plan-me" data-on="plan-me"><option value="">Alle anzeigen</option>${people.map((p) => `<option value="${p.id}"${p.id === me ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>`;
    const rounds = t.rounds.map((rd, i) => {
      const state = i < t.cur || t.status === 'finished' ? 'fertig' : i === t.cur ? 'läuft' : 'geplant';
      const editable = i <= t.cur && (m.engine !== 'ladder' || i === t.cur);
      const hasMe = !me || rd.matches.some((x) => x.a.concat(x.b).includes(me)) || rd.byes.includes(me);
      return `<div class="list round" style="${hasMe ? '' : 'opacity:.45'}"><div class="round-h"><span class="t">Runde ${i + 1}</span><span class="badge${state === 'läuft' ? ' live' : ''}">${state}</span></div>
        ${rd.matches.map((x) => line(x, editable)).join('')}
        ${rd.byes.length ? `<div class="pline byes-line"><span class="c">${m.engine === 'ladder' ? 'Wartet' : 'Pause'}</span><span>${rd.byes.map(mark).join(', ')}</span></div>` : ''}</div>`;
    }).join('');
    const hint = t.status !== 'running' ? '' : m.pairing === 'dynamic' ? '<p class="foot">Mexicano: Die nächste Runde entsteht erst nach allen Ergebnissen.</p>' : m.engine === 'ladder' ? '<p class="foot">Die nächste Runde hängt von den Siegern ab.</p>' : '';
    return `<section class="section">${pick}</section><section class="section">${rounds}${hint}</section>`;
  }

  /* ---------- Ergebnis-Eingabe ---------- */
  function openScore(t, matchId) {
    const f = E.findMatch(t, matchId);
    if (!f) return;
    const ce = E.canEdit(t, matchId);
    if (!ce.ok) { toast(ce.reason); return; }
    const m = f.m;
    const fmt = E.fmtOf(t);
    const allowDraw = E.allowDraw(t);
    const nameA = E.sideName(t, m.a), nameB = E.sideName(t, m.b);
    const st = { a: m.score ? m.score.a : null, b: m.score ? m.score.b : null, w: m.score ? m.score.w : null, active: 'a' };
    if (st.a === undefined) st.a = null;
    if (st.b === undefined) st.b = null;
    const max = fmt.total || (fmt.target ? fmt.target + 6 : fmt.kind === 'games' ? 15 : 40);
    const scoreObj = () => (fmt.kind === 'winner' ? (st.w ? { w: st.w } : null) : st.a == null || st.b == null ? null : { a: Number(st.a), b: Number(st.b) });
    const body = () => {
      let h;
      if (fmt.kind === 'winner') {
        h = `<p class="foot">Wer hat gewonnen?</p><div class="winpick"><button type="button" data-w="a" aria-pressed="${st.w === 'a'}">${esc(nameA)}</button><button type="button" data-w="b" aria-pressed="${st.w === 'b'}">${esc(nameB)}</button></div>`;
      } else {
        const who = esc(st.active === 'a' ? nameA : nameB);
        h = `<div class="score-head"><button type="button" class="score-side" data-pick="a" aria-pressed="${st.active === 'a'}"><span class="tn">${esc(nameA)}</span><span class="v num">${st.a == null ? '–' : st.a}</span></button><span class="colon">:</span><button type="button" class="score-side" data-pick="b" aria-pressed="${st.active === 'b'}"><span class="tn">${esc(nameB)}</span><span class="v num">${st.b == null ? '–' : st.b}</span></button></div>
          <p class="foot">${fmt.total ? `Punkte für ${who} antippen. Die Gegenseite ergibt sich aus ${fmt.total}.` : `${fmt.kind === 'games' ? 'Games' : 'Punkte'} für ${who} antippen.`}</p>
          <div class="numgrid">${Array.from({ length: max + 1 }, (_, i) => `<button type="button" data-n="${i}" aria-pressed="${st[st.active] === i}">${i}</button>`).join('')}</div>`;
      }
      const sc = scoreObj();
      const chk = sc ? E.checkScore(fmt, sc, allowDraw) : null;
      if (chk && chk.error) h += `<p class="note err">${esc(chk.error)}</p>`;
      else if (chk && chk.warn) h += `<p class="note warn">${esc(chk.warn)}</p>`;
      return h;
    };
    const canSave = () => { const sc = scoreObj(); return !!sc && !E.checkScore(fmt, sc, allowDraw).error; };
    const foot = `${m.score ? `<button class="btn danger" type="button" data-clear>${icon('trash', 'sm')}Löschen</button>` : ''}<button class="btn filled big" type="button" data-save>Speichern</button>`;
    const o = sheet({ title: t.courts[m.court], body: body(), foot, doneLabel: 'Sichern' });
    const sb = o.el.querySelector('.sheet-b');
    const refresh = () => {
      sb.innerHTML = body();
      const ok = canSave();
      o.el.querySelectorAll('[data-save], [data-sheet="done"]').forEach((b) => { b.disabled = !ok; });
    };
    const save = () => {
      if (!canSave()) return;
      const sc = scoreObj();
      closeLayer(o).then(() => {
        const res = mutate(t, 'Ergebnis', () => E.setResult(t, m.id, sc));
        if (res && res.ok) toast(res.warn ? `Gespeichert. ${res.warn}` : 'Gespeichert', { label: 'Rückgängig', fn: () => undo(getT(t.id)) });
      });
    };
    o.el.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b || !o.el.contains(b)) return;
      if (b.dataset.save !== undefined || b.dataset.sheet === 'done') { save(); return; }
      if (b.dataset.clear !== undefined) { closeLayer(o).then(() => mutate(t, 'Ergebnis gelöscht', () => E.clearResult(t, m.id))); return; }
      if (b.dataset.w) { st.w = b.dataset.w; refresh(); haptic(); return; }
      if (b.dataset.pick) { st.active = b.dataset.pick; refresh(); return; }
      if (b.dataset.n !== undefined) {
        const n = Number(b.dataset.n);
        haptic(5);
        st[st.active] = n;
        if (fmt.total) st[st.active === 'a' ? 'b' : 'a'] = fmt.total - n;
        else if (st.active === 'a' && st.b == null) st.active = 'b';
        else if (st.active === 'b' && st.a == null) st.active = 'a';
        refresh();
      }
    });
    refresh();
  }

  /* ---------- Turnier-Aktionen ---------- */
  function roundSpeech(t) {
    const r = t.rounds[t.cur];
    const join = (ids) => ids.map((id) => E.nameOf(t, id)).join(' und ');
    const parts = [`Runde ${t.cur + 1}.`];
    r.matches.forEach((x) => parts.push(`${t.courts[x.court]}: ${join(x.a)} gegen ${join(x.b)}.`));
    if (r.byes.length) parts.push(`${E.MODES[t.mode].engine === 'ladder' ? 'Es warten' : 'Pause haben'}: ${r.byes.map((id) => E.nameOf(t, id)).join(', ')}.`);
    return parts.join(' ');
  }

  function timerStart(t) {
    Sound.unlock();
    const T = t.timer;
    const left = T.left != null ? T.left : T.dur;
    T.endsAt = Date.now() + left * 1000;
    T.left = null;
    T.warned = left <= 60;
    T.rang = left <= 0;
    E.startRound(t);
    Store.save();
  }
  function timerPause(t) {
    const T = t.timer;
    if (!T.endsAt) return;
    T.left = Math.round((T.endsAt - Date.now()) / 1000);
    T.endsAt = null;
    Store.save();
  }
  function remaining(t) {
    const T = t.timer;
    if (!T || !T.dur) return null;
    if (T.endsAt) return (T.endsAt - Date.now()) / 1000;
    return T.left != null ? T.left : T.dur;
  }

  async function deleteTournament(t) {
    if (!(await confirmDialog('Turnier löschen?', `„${t.name}“ wird von diesem Gerät entfernt${t.reg ? ', die Online-Anmeldung ebenfalls' : ''}.`, 'Löschen', true))) return;
    if (t.reg && API.available()) API.call('DELETE', `/events/${t.reg.eventId}`, null, t.reg.adminKey).catch(() => {});
    Store.data.tournaments = Store.data.tournaments.filter((x) => x.id !== t.id);
    undoStacks.delete(t.id);
    Store.save();
    uiBack();
    toast('Gelöscht');
  }

  function tournamentMenu(anchor, t) {
    const items = [
      { label: 'Einstellungen ändern', icon: 'gear', fn: () => openWizard({ edit: t }) },
      { label: 'Teilnehmende', icon: 'people', fn: () => openRoster(t) },
      { label: 'Umbenennen', icon: 'edit', fn: async () => {
        const n = await promptDialog('Turnier umbenennen', t.name);
        if (n && n.trim()) mutate(t, 'Umbenannt', () => { t.name = n.trim(); return { ok: true }; });
      } },
      { label: 'Runde teilen', icon: 'share', fn: () => shareOut(E.shareText(t, 'round'), t.name) },
      { label: 'Stand teilen', icon: 'list', fn: () => shareOut(E.shareText(t, 'table'), t.name) },
      { label: 'So läuft der Modus', icon: 'info', fn: () => openModeInfo(t.mode, t.sport) }
    ];
    if (t.status === 'running') items.push({ label: 'Zusatzrunde anhängen', icon: 'plus', fn: () => mutate(t, 'Zusatzrunde', () => E.addRound(t)) });
    items.push('-');
    if (t.status === 'running') items.push({ label: 'Turnier beenden', icon: 'flag', fn: async () => {
      if (await confirmDialog('Turnier beenden?', 'Die aktuelle Tabelle wird zum Endstand.', 'Beenden')) mutate(t, 'Beendet', () => { E.finish(t); return { ok: true }; });
    } });
    items.push({ label: 'Löschen', icon: 'trash', danger: true, fn: () => deleteTournament(t) });
    menu(anchor, items);
  }

  function draftMenu(anchor, t) {
    menu(anchor, [
      { label: 'Einstellungen ändern', icon: 'gear', fn: () => openWizard({ edit: t }) },
      { label: 'Umbenennen', icon: 'edit', fn: async () => {
        const n = await promptDialog('Turnier umbenennen', t.name);
        if (!n || !n.trim()) return;
        try { await adminCall(t, 'PATCH', '', { name: n.trim() }); t.name = n.trim(); Store.save(); render(); } catch (e) { toast(e.message); }
      } },
      { label: 'Termin ändern', icon: 'timer', fn: async () => {
        const n = await promptDialog('Termin', t.reg.when || '', { placeholder: 'z. B. Fr 18:00, Halle 2' });
        if (n == null) return;
        try { await adminCall(t, 'PATCH', '', { when: n.trim() }); t.reg.when = n.trim(); Store.save(); render(); } catch (e) { toast(e.message); }
      } },
      { label: 'So läuft der Modus', icon: 'info', fn: () => openModeInfo(t.mode, t.sport) },
      '-',
      { label: 'Löschen', icon: 'trash', danger: true, fn: () => deleteTournament(t) }
    ]);
  }

  function openRoster(t) {
    const editable = E.rosterEditable(t);
    const html = () => {
      const rows = t.entrants.map((e) => `<div class="cell"><span class="body"><span class="t1">${esc(e.name)} ${e.members ? '' : lvlBadge(e)}</span>${e.members ? `<span class="t2">${e.members.map((p) => `${esc(p.name)}${E.levelLabel(p) ? ' (' + esc(E.levelLabel(p)) + ')' : ''}`).join(' · ')}</span>` : ''}${e.active === false ? '<span class="t2">zieht zurück</span>' : ''}</span>
        <button class="iconbtn" type="button" data-ren="${e.id}" aria-label="${esc(e.name)} umbenennen">${icon('edit', 'sm')}</button>
        ${editable ? `<input type="checkbox" class="switch" data-act-on="${e.id}" aria-label="${esc(e.name)} spielt mit" ${e.active !== false ? 'checked' : ''}>` : ''}</div>`).join('');
      const add = editable ? `<button class="btn tonal" type="button" data-add>${icon('plus', 'sm')}Person hinzufügen</button>` : '';
      const note = editable ? 'Änderungen gelten ab der nächsten Runde, die noch nicht begonnen hat. Die App lost diese neu aus.' : 'Bei festen Teams lassen sich nur Namen ändern. Die Auslosung bleibt bestehen.';
      return `<div class="list">${rows}</div>${add}<p class="foot">${note}</p>`;
    };
    const o = sheet({ title: 'Teilnehmende', body: html(), cancelLabel: 'Fertig' });
    const sb = o.el.querySelector('.sheet-b');
    const redraw = () => { t = getT(t.id); sb.innerHTML = html(); };
    sb.addEventListener('click', async (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.ren) {
        const e = E.ent(t, b.dataset.ren);
        const n = await promptDialog('Name ändern', e.name);
        if (n != null) { mutate(getT(t.id), 'Umbenannt', (tt) => E.rename(tt, e.id, n)); redraw(); }
      } else if (b.dataset.add !== undefined) {
        openPersonSheet({
          title: 'Person hinzufügen', saveLabel: 'Hinzufügen',
          onSave: async (p) => { const r = mutate(getT(t.id), 'Hinzugefügt', (tt) => E.addEntrant(tt, p)); if (!r.ok) throw new Error(r.error); redraw(); }
        });
      }
    });
    sb.addEventListener('change', (ev) => {
      const id = ev.target.dataset.actOn;
      if (!id) return;
      const r = mutate(getT(t.id), ev.target.checked ? 'Wieder dabei' : 'Zieht zurück', (tt) => E.setActive(tt, id, ev.target.checked));
      if (!r.ok) ev.target.checked = !ev.target.checked;
      redraw();
    });
  }

  /* ---------- Modi ---------- */
  function sportSeg(cur, act) {
    return `<div class="seg" role="tablist">${Object.values(E.SPORTS).map((s) => `<button type="button" data-act="${act}" data-sport="${s.id}" aria-pressed="${s.id === cur}">${s.name}</button>`).join('')}</div>`;
  }
  function viewModes() {
    const sport = nav.modeSport || S().sport || 'padel';
    const cells = MODE_ORDER.map((id) => {
      const c = C.modes[id];
      return `<button class="cell tappable" type="button" data-act="open-mode" data-id="${id}" data-sport="${sport}"><span class="lead">${icon(c.icon)}</span>
        <span class="body"><span class="t1">${esc(c.name)}</span><span class="t2">${esc(c.tag)}</span></span>${icon('chev', 'sm chev')}</button>`;
    }).join('');
    const rules = C.sports[sport].rules.map(([h, p]) => `<div class="cell"><span class="body"><span class="t1" style="font-weight:600">${esc(h)}</span><span class="t2">${esc(p)}</span></span></div>`).join('');
    const body = `${sportSeg(sport, 'modes-sport')}
      <section class="section"><div class="section-h"><h2>Turniermodi</h2></div><div class="list icons">${cells}</div>
      <p class="foot">Jede Erklärung lässt sich direkt an die Spieler weitergeben.</p></section>
      <section class="section"><div class="section-h"><h2>Regeln & Zählweise</h2></div><div class="list">${rules}</div><p class="foot">Stand 2026 (FIP, USA Pickleball, ITF, Tennis Australia). Im Club gelten oft eigene Absprachen.</p></section>`;
    return { title: 'Modi', large: true, body };
  }
  function modeText(id) {
    const c = C.modes[id];
    return `${c.name}: ${c.tag}\n\n${c.about}\n\nSo läuft’s:\n${c.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nWertung: ${c.scoring}`;
  }
  function modeDetail(id, sport, { inSheet = false } = {}) {
    const c = C.modes[id];
    return `<div class="mode-hero">${sportMark(sport)}<div><h1>${esc(c.name)}</h1>${c.aka ? `<p class="muted">Auch: ${esc(c.aka)}</p>` : ''}</div></div>
      <p class="prose">${esc(c.about)}</p>
      <dl class="facts" style="margin:0"><div><dt>Für</dt><dd>${esc(c.who)}</dd></div><div><dt>Dauer</dt><dd>${esc(c.time)}</dd></div></dl>
      <section class="section"><div class="section-h"><h2>So läuft’s</h2></div><div class="card"><ol class="steps">${c.steps.map((s) => `<li><span>${esc(s)}</span></li>`).join('')}</ol></div></section>
      <section class="section"><div class="section-h"><h2>Wertung</h2></div><div class="card"><p>${esc(c.scoring)}</p></div></section>
      ${c.tips.length ? `<section class="section"><div class="section-h"><h2>Tipps</h2></div><div class="card"><ul class="bullets">${c.tips.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div></section>` : ''}
      ${inSheet ? '' : `<div class="stack"><button class="btn filled big block" type="button" data-act="new-with" data-id="${id}" data-sport="${sport}">${icon('plus')}Mit diesem Modus starten</button>
        <button class="btn tonal big block" type="button" data-act="share-mode" data-id="${id}">${icon('share', 'sm')}An Spieler weitergeben</button></div>`}`;
  }
  const viewMode = (id, sport) => ({ title: C.modes[id].name, large: false, body: modeDetail(id, sport) });
  function openModeInfo(id, sport, onPick) {
    const o = sheet({
      title: C.modes[id].name, body: modeDetail(id, sport, { inSheet: true }), cancelLabel: 'Schließen',
      foot: onPick ? '<button class="btn filled big" type="button" data-pick>Diesen Modus wählen</button>' : `<button class="btn tonal big" type="button" data-share>${icon('share', 'sm')}An Spieler weitergeben</button>`
    });
    const pickBtn = o.el.querySelector('[data-pick]');
    if (pickBtn) pickBtn.addEventListener('click', () => closeLayer(o).then(onPick));
    const shareBtn = o.el.querySelector('[data-share]');
    if (shareBtn) shareBtn.addEventListener('click', () => shareOut(modeText(id), C.modes[id].name));
  }

  /* ---------- Teilen ---------- */
  let installEvent = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; if (!route() && nav.tab === 'teilen') render(); });
  const standalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  function appUrl() {
    const own = (S().shareUrl || '').trim();
    if (own) return own;
    if (!embedded() && /^https?:$/.test(location.protocol) && !/^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname)) return location.origin + location.pathname;
    return '';
  }
  function qrSVG(text) {
    if (typeof window.qrcode !== 'function' || !text) return null;
    try {
      window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8'];
      const q = window.qrcode(0, 'M');
      q.addData(text);
      q.make();
      const n = q.getModuleCount();
      let d = '';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
      return `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="QR-Code für ${esc(text)}"><path d="${d}" fill="var(--qr-fg)"/></svg>`;
    } catch (e) { return null; }
  }
  function viewShare() {
    const url = appUrl();
    const svg = qrSVG(url);
    const steps = PLATFORM === 'ios'
      ? ['In Safari öffnen.', `Unten auf ${icon('share', 'sm')} Teilen tippen.`, '„Zum Home-Bildschirm“ wählen.']
      : ['In Chrome öffnen.', `Oben rechts ${icon('more', 'sm')} antippen.`, '„App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen.'];
    const qr = url
      ? `<div class="qr">${svg || '<p class="qr-empty">QR-Code konnte nicht erzeugt werden. Den Link kannst du trotzdem kopieren.</p>'}</div><p class="url">${esc(url)}</p>
         <div class="row" style="justify-content:center"><button class="btn filled" type="button" data-act="copy-link">${icon('copy', 'sm')}Link kopieren</button>${navigator.share ? `<button class="btn tonal" type="button" data-act="share-link">${icon('share', 'sm')}Teilen</button>` : ''}</div>`
      : '<div class="qr"><p class="qr-empty">Trag unten die öffentliche Adresse der App ein. Dann erscheint hier der QR-Code.</p></div>';
    const body = `<section class="card qr-card">${qr}<p class="foot" style="padding:0">Dieser Code führt zur App selbst, zum Beispiel für Kolleginnen und Kollegen. Für die Anmeldung zu einem Turnier hat jedes Turnier einen eigenen Code.</p></section>
      <section class="section"><div class="section-h"><h2>Adresse der App</h2></div><div class="field"><input class="input" id="share-url" type="url" inputmode="url" placeholder="https://…" value="${esc(S().shareUrl || '')}" data-on="share-url" autocomplete="off"><p class="foot">${embedded() ? 'Diese Ansicht läuft eingebettet. Trag die Adresse ein, unter der die App veröffentlicht ist.' : 'Leer lassen, dann gilt die aktuelle Adresse.'}</p></div></section>
      <section class="section"><div class="section-h"><h2>Als App installieren</h2></div>
        ${standalone() ? `<div class="banner">${icon('check', 'sm')}<span>Läuft bereits als installierte App.</span></div>` : `<div class="card"><ol class="steps">${steps.map((s) => `<li><span>${s}</span></li>`).join('')}</ol>${installEvent ? `<button class="btn filled" type="button" data-act="install">${icon('install', 'sm')}Jetzt installieren</button>` : ''}</div>`}</section>`;
    return { title: 'Teilen', large: true, body };
  }

  /* ---------- Einstellungen ---------- */
  function viewSettings() {
    const s = S();
    const detected = detectPlatform() === 'ios' ? 'iOS' : 'Android';
    const body = `<section class="section"><div class="section-h"><h2>Design</h2></div>
        <div class="seg">${[['auto', 'Automatisch'], ['ios', 'iOS'], ['android', 'Android']].map(([k, l]) => `<button type="button" data-act="design" data-v="${k}" aria-pressed="${s.design === k}">${l}</button>`).join('')}</div>
        <p class="foot">Automatisch folgt dem Gerät. Erkannt: ${detected}. iOS nutzt Apples Human Interface Guidelines (Liquid Glass), Android Material 3 Expressive.</p></section>
      <section class="section"><div class="section-h"><h2>Signale</h2></div><div class="list">
        <label class="cell"><span class="body"><span class="t1">Ton bei Zeitablauf</span><span class="t2">Kurz vor Schluss und beim Abpfiff</span></span><input type="checkbox" class="switch" data-on="set-sound" ${s.sound ? 'checked' : ''}></label>
        <label class="cell"><span class="body"><span class="t1">Vibration</span><span class="t2">${navigator.vibrate ? 'Bei Eingaben und Zeitablauf' : 'Von diesem Gerät nicht unterstützt'}</span></span><input type="checkbox" class="switch" data-on="set-vibrate" ${s.vibrate ? 'checked' : ''}></label>
      </div><p class="foot">Solange ein laufendes Turnier offen ist, bleibt der Bildschirm an.</p></section>
      <section class="section"><div class="section-h"><h2>Standard-Sportart</h2></div>${sportSeg(s.sport, 'default-sport')}</section>
      <section class="section"><div class="section-h"><h2>Daten</h2></div><div class="list">
        <button class="cell tappable" type="button" data-act="backup-copy"><span class="body"><span class="t1">Sicherung kopieren</span><span class="t2">Alle Turniere als Text, z. B. für ein anderes Gerät</span></span>${icon('copy', 'sm chev')}</button>
        <button class="cell tappable" type="button" data-act="backup-paste"><span class="body"><span class="t1">Sicherung einfügen</span><span class="t2">Turniere aus einer Sicherung übernehmen</span></span>${icon('install', 'sm chev')}</button>
        <button class="cell tappable" type="button" data-act="demo"><span class="body"><span class="t1">Beispiel-Turnier anlegen</span></span>${icon('plus', 'sm chev')}</button>
        <button class="cell tappable" type="button" data-act="wipe"><span class="body"><span class="t1" style="color:var(--danger)">Alle Turniere löschen</span></span></button>
      </div><p class="foot">Turniere bleiben auf diesem Gerät. Nur die Anmeldelisten liegen online, damit sich Spieler von ihrem Handy aus eintragen können.</p></section>
      <p class="foot" style="text-align:center">Courtside ${VERSION}</p>`;
    return { title: 'Einstellungen', large: true, body };
  }

  /* ---------- Neues Turnier (4 Schritte) ---------- */
  const WIZARD_STEPS = ['Sport & Modus', 'Teilnehmende', 'Spielablauf', 'Überblick'];
  function openWizard(preset = {}) {
    const sport = preset.sport || S().sport || 'padel';
    const online = API.available();
    const W = {
      step: 0, sport, discipline: 'doubles', mode: preset.mode || 'americano', people: [], courts: 2, format: null,
      rules: {}, options: {}, name: '', rounds: null, signup: online, teamsFixed: false, when: '', stepError: ''
    };
    const setMode = (id) => {
      W.mode = id;
      W.format = E.defaultFormat(id, W.sport);
      W.rounds = null;
      const m = E.MODES[id];
      W.options = { byePoints: 'avg', roundMinutes: 0 };
      if (id === 'americano') W.options.balance = true;
      if (id === 'mexicano') { W.options.scheme = '14'; W.options.firstRound = 'level'; }
      if (m.engine === 'ladder') { W.options.roundMinutes = 12; W.options.ranking = 'position'; }
    };
    setMode(W.mode);
    // Bearbeiten: vorhandenes Turnier oder offene Anmeldung übernehmen und beim Überblick einsteigen.
    const edit = preset.edit || null;
    const isDraft = !!edit && edit.status === 'draft';
    let origPeople = '';
    if (edit) {
      const c = isDraft ? edit.cfg : edit;
      Object.assign(W, {
        step: 3, sport: edit.sport, mode: edit.mode, name: edit.name, discipline: c.discipline || 'doubles', format: c.format,
        courts: isDraft ? c.courts : edit.courts.length, rules: Object.assign({}, c.rules), options: Object.assign({ byePoints: 'avg', roundMinutes: 0 }, c.options),
        rounds: edit.mode !== 'team' && c.options.rounds ? c.options.rounds : null, signup: isDraft, when: isDraft ? edit.reg.when || '' : ''
      });
      if (!isDraft) {
        const active = edit.entrants.filter((e) => e.active !== false);
        const built = E.MODES[edit.mode].unit === 'team' && active.length && active.every((e) => Array.isArray(e.members) && e.members.length);
        const person = (p) => Object.assign({ name: p.name }, p.level ? { level: p.level } : {}, typeof p.rating === 'number' ? { rating: p.rating } : {});
        W.people = built ? active.flatMap((e) => e.members.map(person)) : active.map(person);
        W.teamsFixed = E.MODES[edit.mode].unit === 'team' && !built;
        origPeople = JSON.stringify([W.people, W.teamsFixed]);
        if (edit.timer && edit.timer.dur) W.options.roundMinutes = Math.round(edit.timer.dur / 60);
      }
    }
    const m = () => E.MODES[W.mode];
    const fmt = () => E.FORMATS[W.format];
    const singles = () => W.discipline === 'singles';
    const buildTeams = () => m().unit === 'team' && !singles() && !W.teamsFixed;
    const unitWord = () => (m().unit === 'player' || singles() || buildTeams() ? 'Personen' : 'Teams');
    const timerNeeded = () => m().engine === 'ladder' || !!fmt().timed;
    const autoName = () => `${E.SPORTS[W.sport].name} ${C.modes[W.mode].name} ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`;
    const cfg = (entrants) => {
      const o = Object.assign({}, W.options);
      if (W.mode !== 'team') o.rounds = W.rounds || E.defaultRounds({ mode: W.mode, format: W.format, entrants: entrants || W.people, options: o });
      return { name: W.name.trim() || autoName(), sport: W.sport, discipline: W.discipline, mode: W.mode, format: W.format, courts: W.courts, rules: W.rules, options: o, entrants: entrants || W.people };
    };
    // Prüft alles außer der Teilnehmerzahl, die bei Online-Anmeldung noch offen ist.
    const checkBase = () => E.validateConfig(cfg(Array.from({ length: Math.max(m().min, 8) }, (_, i) => ({ name: 'x' + i }))));
    const checkPeople = () => {
      if (W.signup) return null;
      if (buildTeams()) return W.people.length < m().min * 2 ? `Für ${m().min} Teams braucht es mindestens ${m().min * 2} Personen. Bisher: ${W.people.length}.` : null;
      if (W.people.length < m().min) return `Dieser Modus braucht mindestens ${m().min} ${unitWord()}. Bisher: ${W.people.length}.`;
      return E.validateConfig(cfg());
    };
    const check = () => checkBase() || checkPeople();

    /* Bausteine */
    const stepperRow = (label, sub, key, value, min, max) => `<div class="cell"><span class="body"><span class="t1">${esc(label)}</span>${sub ? `<span class="t2">${esc(sub)}</span>` : ''}</span>
      <span class="stepper"><button type="button" data-act="w-step" data-k="${key}" data-d="-1" data-min="${min}" data-max="${max}" aria-label="${esc(label)} weniger">${icon('minus', 'sm')}</button><output class="num">${value}</output><button type="button" data-act="w-step" data-k="${key}" data-d="1" data-min="${min}" data-max="${max}" aria-label="${esc(label)} mehr">${icon('plus', 'sm')}</button></span></div>`;
    const switchRow = (label, sub, key, on) => `<label class="cell"><span class="body"><span class="t1">${esc(label)}</span>${sub ? `<span class="t2">${esc(sub)}</span>` : ''}</span><input type="checkbox" class="switch" data-w-opt="${key}" ${on ? 'checked' : ''}></label>`;
    const segRow = (label, key, opts) => `<div class="cell" style="flex-wrap:wrap"><span class="body" style="flex-basis:100%"><span class="t1">${esc(label)}</span></span><div class="seg" style="flex:1">${opts.map(([v, l]) => `<button type="button" data-act="w-opt" data-k="${key}" data-v="${v}" aria-pressed="${String(W.options[key]) === String(v)}">${esc(l)}</button>`).join('')}</div></div>`;
    const section = (title, inner, foot = '') => `<section class="section"><div class="section-h"><h2>${esc(title)}</h2></div>${inner}${foot ? `<p class="foot">${foot}</p>` : ''}</section>`;
    const radioCell = (act, id, title, sub, checked, badge = '') => `<button type="button" class="cell check tappable" role="radio" aria-checked="${checked}" data-act="${act}" data-id="${id}">
      <span class="body"><span class="t1">${esc(title)}${badge}</span>${sub ? `<span class="t2">${esc(sub)}</span>` : ''}</span>${icon('check', 'tick')}<span class="radio" aria-hidden="true"></span></button>`;

    /* Schritt 1: Sport & Modus */
    const stepMode = () => {
      const modes = MODE_ORDER.map((id) => {
        const c = C.modes[id];
        const avail = E.modeAvailable(id, W.sport, W.discipline);
        return `<div class="cell check${avail ? '' : ' dim'}" role="radio" aria-checked="${id === W.mode}" style="padding-right:8px"><button type="button" class="body" data-act="w-mode" data-id="${id}" ${avail ? '' : 'disabled'} style="text-align:left;display:flex;flex-direction:column;gap:2px;min-height:44px;justify-content:center">
          <span class="t1">${esc(c.name)}</span><span class="t2">${esc(avail ? c.tag : 'Nur im Doppel')}</span></button>
          <button type="button" class="iconbtn" data-act="w-info" data-id="${id}" aria-label="${esc(c.name)} erklärt">${icon('info', 'sm')}</button>${icon('check', 'tick')}<span class="radio" aria-hidden="true"></span></div>`;
      }).join('');
      return section('Sportart', sportSeg(W.sport, 'w-sport') + (E.SPORTS[W.sport].singles ? `<div class="seg"><button type="button" data-act="w-disc" data-v="doubles" aria-pressed="${!singles()}">Doppel</button><button type="button" data-act="w-disc" data-v="singles" aria-pressed="${singles()}">Einzel</button></div>` : ''))
        + section('Modus', `<div class="list" role="radiogroup">${modes}</div>`, `Mit ${icon('info', 'sm')} siehst du, wie ein Modus abläuft.`);
    };

    /* Schritt 2: Teilnehmende */
    const stepPeople = () => {
      if (isDraft) return section('Teilnehmende', '<div class="card"><p>Die Anmeldung läuft bereits. Wer dabei ist, siehst und änderst du in der Anmeldeliste.</p></div>');
      const signupSeg = online && !edit ? `<div class="seg"><button type="button" data-act="w-signup" data-v="1" aria-pressed="${W.signup}">Per Link anmelden</button><button type="button" data-act="w-signup" data-v="0" aria-pressed="${!W.signup}">Selbst eintragen</button></div>` : '';
      if (W.signup) {
        return section('Wie kommen die Namen rein?', `${signupSeg}<div class="card"><p>Du bekommst einen Link und QR-Code. Jede Person trägt sich mit Name und Level ein${buildTeams() ? ', die App bildet daraus die Teams' : ''}. Du siehst die Liste live und startest, wenn alle da sind.</p>
          <div class="field"><label for="w-when">Termin (optional)</label><input class="input" id="w-when" value="${esc(W.when)}" placeholder="z. B. Fr 18:00, Halle 2" maxlength="60" autocomplete="off"></div></div>`);
      }
      const fixedSeg = m().unit === 'team' && !singles()
        ? `<div class="seg"><button type="button" data-act="w-teams" data-v="0" aria-pressed="${!W.teamsFixed}">Nach Level bilden</button><button type="button" data-act="w-teams" data-v="1" aria-pressed="${W.teamsFixed}">Feste Teams</button></div>` : '';
      const rows = W.people.map((p, i) => `<div class="cell ent-row"><span class="nr">${i + 1}</span><span class="nm">${esc(p.name)}</span>
        <button type="button" class="lvl-chip lv-${esc(p.level || 'none')}" data-act="w-lvl" data-i="${i}">${esc(E.levelLabel(p) || 'Level')}</button>
        <button type="button" class="iconbtn" data-act="w-del" data-i="${i}" aria-label="${esc(p.name)} entfernen">${icon('close', 'sm')}</button></div>`).join('');
      const placeholder = unitWord() === 'Teams' ? 'Teamname, z. B. Anna / Ben' : 'Name';
      return (signupSeg || fixedSeg ? section(signupSeg ? 'Wie kommen die Namen rein?' : 'Teilnehmende', signupSeg + fixedSeg) : '')
        + section(`${unitWord()} (${W.people.length})`, `<div class="addrow"><input class="input" id="w-add" placeholder="${placeholder}" autocomplete="off" autocapitalize="words" enterkeyhint="next">
          <button class="iconbtn tint" type="button" data-act="w-add" aria-label="Hinzufügen">${icon('plus')}</button></div>
          <div class="chips"><button class="chip" type="button" data-act="w-paste">${icon('list', 'sm')}Liste einfügen</button><button class="chip" type="button" data-act="w-fill">${icon('people', 'sm')}Mit Platzhaltern füllen</button></div>
          ${W.people.length ? `<div class="list">${rows}</div>` : ''}`, W.people.length ? 'Level antippen, um es festzulegen. Ohne Angabe zählt „Mittel“.' : '');
    };

    /* Schritt 3: Spielablauf */
    const stepPlay = () => {
      const o = W.options;
      const f = fmt();
      const formats = E.formatsFor(W.mode, W.sport).map((k, i) => {
        const x = E.FORMATS[k];
        return radioCell('w-format', k, x.name, `${x.desc}${x.timed || k === 'win' ? '' : ` Etwa ${x.min} Min.`}`, k === W.format, i === 0 ? ' <span class="badge tint">Standard</span>' : '');
      }).join('');
      const pointsHint = E.formatsFor(W.mode, W.sport).some((k) => E.FORMATS[k].total) ? 'Americano und Mexicano zählen nicht 15–30–40, sondern jeden Ballwechsel als einen Punkt.' : '';
      const minutes = o.roundMinutes || 0;
      const timer = timerNeeded()
        ? `<div class="list">${stepperRow('Minuten pro Runde', 'Signal eine Minute vor Schluss und beim Abpfiff', 'roundMinutes', minutes || 12, 3, 60)}</div>`
        : `<div class="list">${switchRow('Mit Timer spielen', minutes ? 'Endet die Runde nach Zeit, zählt der Stand beim Abpfiff' : 'Aus – gespielt wird bis zur Punktzahl', 'timer', minutes > 0)}${minutes ? stepperRow('Minuten pro Runde', '', 'roundMinutes', minutes, 3, 60) : ''}</div>`;
      const rows = [];
      if (W.mode !== 'team') {
        const def = E.defaultRounds({ mode: W.mode, format: W.format, entrants: W.people, options: o }) || 6;
        const n = W.people.length;
        const sub = W.signup && !W.rounds ? 'Automatisch passend zur Teilnehmerzahl'
          : W.mode === 'americano' && n >= 4 ? `Bei ${n} Personen spielt mit ${n - 1} Runden jede Person einmal mit jeder anderen.` : '';
        rows.push(stepperRow('Runden', sub, 'rounds', W.rounds || (W.signup ? 'Auto' : def), 1, 40));
      }
      if (W.mode === 'americano') rows.push(switchRow('Ausgeglichene Spiele', 'Beide Teams eines Spiels möglichst gleich stark (nach Level)', 'balance', o.balance !== false));
      if (W.mode === 'mexicano') {
        rows.push(segRow('Erste Runde', 'firstRound', [['level', 'Nach Level'], ['random', 'Zufall']]));
        rows.push(segRow('Paarung auf jedem Platz', 'scheme', [['14', '1+4 gegen 2+3'], ['13', '1+3 gegen 2+4']]));
      }
      if (m().engine === 'rotation') rows.push(switchRow('Pausen ausgleichen', 'Wer aussetzt, bekommt den eigenen Punkteschnitt', 'byePoints', o.byePoints !== 'none'));
      if (m().engine === 'ladder') rows.push(segRow('Wertung', 'ranking', [['position', 'Position'], ['points', 'Punkte je Platz']]));
      const R = E.RULES[W.sport];
      const cur = W.rules[R.key] || R.def;
      return section('Plätze', `<div class="list">${stepperRow('Anzahl Plätze', m().engine === 'ladder' ? 'Platz 1 ist der Königsplatz.' : '', 'courts', W.courts, 1, 16)}</div>`)
        + section('Zählweise', `<div class="list" role="radiogroup">${formats}</div>`, esc(pointsHint))
        + section('Timer', timer, f.timed ? 'Diese Zählweise braucht einen Timer.' : '')
        + section('Ablauf', `<div class="list">${rows.join('')}</div>`)
        + section(R.label, `<div class="seg">${R.options.map((x) => `<button type="button" data-act="w-rule" data-v="${x.id}" aria-pressed="${x.id === cur}">${esc(x.name)}</button>`).join('')}</div>`, esc(R.options.find((x) => x.id === cur).hint));
    };

    /* Schritt 4: Überblick */
    const stepCheck = () => {
      const c = cfg(buildTeams() ? W.people.slice(0, Math.floor(W.people.length / 2)) : null);
      const est = W.signup ? null : E.estimate(c);
      const R = E.RULES[W.sport];
      const people = W.signup ? 'Anmeldung per Link' : buildTeams() ? `${W.people.length} Personen → ${Math.floor(W.people.length / 2)} Teams nach Level` : `${W.people.length} ${unitWord()}`;
      const minutes = W.options.roundMinutes || 0;
      const rows = [
        ['Sport & Modus', `${E.SPORTS[W.sport].name}${singles() ? ' (Einzel)' : ''} · ${C.modes[W.mode].name}`, 0],
        ['Teilnehmende', people + (W.signup && W.when ? ` · ${W.when}` : ''), 1],
        ['Plätze', String(W.courts), 2],
        ['Zählweise', fmt().name, 2],
        ['Timer', minutes ? `${minutes} Min. pro Runde` : 'aus', 2],
        ['Runden', W.mode === 'team' ? 'Jeder gegen jeden' : W.rounds ? String(W.rounds) : W.signup ? 'automatisch' : String(c.options.rounds), 2],
        [R.label, R.options.find((x) => x.id === (W.rules[R.key] || R.def)).name, 2]
      ];
      return section('Name', `<input class="input" id="w-name" value="${esc(W.name)}" placeholder="${esc(autoName())}" maxlength="80" autocomplete="off">`)
        + section('Alles im Blick', `<div class="list">${rows.map(([k, v, s]) => `<button type="button" class="cell tappable" data-act="w-goto" data-step="${s}"><span class="body"><span class="t2">${esc(k)}</span><span class="t1">${esc(v)}</span></span><span class="trail">Ändern${icon('chev', 'sm chev')}</span></button>`).join('')}</div>`,
          est && est.minutes ? `Geschätzte Dauer: etwa ${fmtMin(est.minutes)}${est.rounds ? ` für ${est.rounds} Runden` : ''}.` : '');
    };

    const STEP_VIEWS = [stepMode, stepPeople, stepPlay, stepCheck];
    const finalLabel = () => (edit ? 'Übernehmen' : W.signup ? 'Anmeldung öffnen' : buildTeams() ? 'Teams bilden' : 'Turnier starten');
    const html = `<div class="scrim"></div><section class="page" role="dialog" aria-modal="true" aria-label="${edit ? 'Turnier einstellen' : 'Neues Turnier'}">
      <div class="sheet-h"><div class="l">${PLATFORM === 'ios' ? '<button class="btn-text" type="button" data-act="w-close">Abbrechen</button>' : ''}</div><div class="t">${edit ? 'Einstellungen' : 'Neues Turnier'}</div>
      <div class="r">${PLATFORM === 'ios' ? '' : `<button class="iconbtn" type="button" data-act="w-close" aria-label="Schließen">${icon('close')}</button>`}</div></div>
      <div class="wsteps" id="w-steps"></div>
      <div class="page-scroll"><div class="page-b"><div class="inner" id="w-body"></div></div><button type="button" class="more-hint" id="w-more" hidden>${icon('chevd', 'sm')}Weitere Einstellungen</button></div>
      <div class="page-f"><div class="inner"><p class="summary" id="w-sum"></p><div class="row nowrap" id="w-nav"></div></div></div></section>`;
    const o = openLayer(html, { dismissable: false });
    const el = o.el;
    const renderNav = () => {
      const last = W.step === STEP_VIEWS.length - 1;
      const sum = el.querySelector('#w-sum');
      let text = '', err = false;
      if (W.stepError) { text = W.stepError; err = true; }
      else if (W.step === 1 && !W.signup) text = `${W.people.length} ${unitWord()} eingetragen`;
      else if (last) { const e = check(); if (e) { text = e; err = true; } }
      sum.textContent = text;
      sum.hidden = !text;
      sum.classList.toggle('err', err);
      el.querySelector('#w-nav').innerHTML = (W.step > 0 ? `<button class="btn tonal big" type="button" data-act="w-back">${icon('back', 'sm')}Zurück</button>` : '')
        + `<button class="btn filled big grow" type="button" data-act="w-next">${last ? finalLabel() : 'Weiter'}</button>`;
    };
    // Zeigt deutlich, wenn unterhalb noch Einstellungen folgen.
    const updateMore = () => {
      const sc = el.querySelector('.page-b');
      const more = sc.scrollHeight - sc.scrollTop - sc.clientHeight > 40;
      sc.classList.toggle('more', more);
      el.querySelector('#w-more').hidden = !more || sc.scrollTop > 40;
    };
    const renderAll = ({ focusAdd = false, top = false } = {}) => {
      const scroller = el.querySelector('.page-b');
      const scroll = scroller.scrollTop;
      el.querySelector('#w-steps').innerHTML = `<div class="wsteps-bar">${WIZARD_STEPS.map((_, i) => `<span class="${i <= W.step ? 'on' : ''}"></span>`).join('')}</div><p>Schritt ${W.step + 1} von ${WIZARD_STEPS.length} · <strong>${esc(WIZARD_STEPS[W.step])}</strong></p>`;
      el.querySelector('#w-body').innerHTML = STEP_VIEWS[W.step]();
      scroller.scrollTop = top ? 0 : scroll;
      renderNav();
      requestAnimationFrame(updateMore);
      if (focusAdd) { const a = el.querySelector('#w-add'); if (a) a.focus({ preventScroll: true }); }
    };
    const goStep = (i) => { W.step = Math.max(0, Math.min(STEP_VIEWS.length - 1, i)); W.stepError = ''; renderAll({ top: true }); };
    const addNames = (names) => {
      let added = 0, dup = 0;
      names.map((n) => n.trim()).filter(Boolean).forEach((n) => {
        if (W.people.some((p) => p.name.toLowerCase() === n.toLowerCase())) { dup++; return; }
        W.people.push({ name: n.slice(0, 60) });
        added++;
      });
      if (dup) toast(`${dup} ${dup === 1 ? 'Name war' : 'Namen waren'} schon in der Liste.`);
      if (added) W.stepError = '';
      return added;
    };
    renderAll();
    el.querySelector('.page-b').addEventListener('scroll', updateMore, { passive: true });
    el.querySelector('#w-more').addEventListener('click', () => { const sc = el.querySelector('.page-b'); sc.scrollBy({ top: sc.clientHeight * 0.7, behavior: 'smooth' }); });

    const launchLocal = async (entrants) => {
      let t;
      try { t = E.create(cfg(entrants)); } catch (e) { toast(e.message); return; }
      Store.data.tournaments.unshift(t);
      S().sport = W.sport;
      Store.save();
      haptic([10, 40, 10]);
      await closeLayer(o);
      nav.tab = 'turniere';
      nav.stack = [];
      go({ name: 't', id: t.id, seg: 'now' });
    };
    const openSignup = async (btn) => {
      const c = cfg([]);
      if (!W.rounds) delete c.options.rounds; // passt die App beim Start an die Teilnehmerzahl an
      btn.disabled = true;
      btn.textContent = 'Wird angelegt …';
      try {
        const res = await API.call('POST', '/events', { name: c.name, sport: c.sport, mode: c.mode, when: W.when.trim(), note: '' });
        const draft = {
          id: 'd' + res.event.id, status: 'draft', name: c.name, sport: c.sport, mode: c.mode,
          cfg: { discipline: c.discipline, format: c.format, courts: c.courts, rules: c.rules, options: c.options },
          reg: { eventId: res.event.id, adminKey: res.adminKey, open: true, when: W.when.trim() }, players: [],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        };
        Store.data.tournaments.unshift(draft);
        S().sport = W.sport;
        Store.save();
        await closeLayer(o);
        nav.tab = 'turniere';
        nav.stack = [];
        go({ name: 't', id: draft.id });
      } catch (e) {
        toast(e.message);
        renderNav();
      }
    };

    // Änderungen übernehmen: offene Anmeldung direkt, laufendes Turnier ohne Neuauslosung, wenn möglich.
    const applyEdit = async () => {
      const c = cfg(buildTeams() ? null : W.people);
      if (isDraft) {
        if (!W.rounds) delete c.options.rounds;
        try { await API.call('PATCH', `/events/${edit.reg.eventId}`, { name: c.name, sport: c.sport, mode: c.mode, when: W.when.trim() }, edit.reg.adminKey); }
        catch (e) { toast(e.message); return; }
        Object.assign(edit, { name: c.name, sport: c.sport, mode: c.mode, updatedAt: new Date().toISOString() });
        edit.cfg = { discipline: c.discipline, format: c.format, courts: c.courts, rules: c.rules, options: c.options };
        edit.reg.when = W.when.trim();
        Store.save();
        await closeLayer(o);
        render();
        toast('Einstellungen gespeichert');
        return;
      }
      const t = edit;
      const structural = c.sport !== t.sport || c.discipline !== t.discipline || c.mode !== t.mode || c.format !== t.format
        || c.courts !== t.courts.length || JSON.stringify([W.people, W.teamsFixed]) !== origPeople;
      if (!structural) {
        await closeLayer(o);
        mutate(t, 'Einstellungen', () => {
          t.name = c.name;
          t.rules = c.rules;
          ['byePoints', 'balance', 'scheme', 'firstRound', 'ranking'].forEach((k) => { if (k in c.options) t.options[k] = c.options[k]; });
          applyRoundMinutes(t, Number(c.options.roundMinutes) || (timerNeeded() ? 12 : 0));
          if (t.mode !== 'team' && W.rounds && W.rounds !== t.options.rounds) return E.setPlannedRounds(t, W.rounds);
          return { ok: true };
        });
        toast('Einstellungen gespeichert', { label: 'Rückgängig', fn: () => undo(getT(t.id)) });
        return;
      }
      const played = t.rounds.some((r) => r.startedAt || r.matches.some((x) => x.score));
      if (played && !(await confirmDialog('Neu auslosen?', 'Diese Änderung braucht eine neue Auslosung. Bisherige Ergebnisse werden gelöscht. Mit „Rückgängig“ kommst du zurück.', 'Neu auslosen', true))) return;
      const rebuild = async (entrants) => {
        await closeLayer(o);
        const r = mutate(t, 'Neu ausgelost', () => {
          const nt = E.create(cfg(entrants));
          const keep = { id: t.id, createdAt: t.createdAt, reg: t.reg };
          Object.keys(t).forEach((k) => { delete t[k]; });
          Object.assign(t, nt, keep);
          if (!keep.reg) delete t.reg;
          return { ok: true };
        });
        if (r.ok) toast('Neu ausgelost', { label: 'Rückgängig', fn: () => undo(getT(t.id)) });
      };
      if (buildTeams()) openTeamBuilder({ people: W.people, mode: W.mode, onStart: rebuild });
      else rebuild(W.people);
    };

    el.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && ev.target.id === 'w-add') {
        ev.preventDefault();
        if (addNames([ev.target.value])) { haptic(5); renderAll({ focusAdd: true }); }
      }
    });
    el.addEventListener('input', (ev) => {
      if (ev.target.id === 'w-name') W.name = ev.target.value;
      if (ev.target.id === 'w-when') W.when = ev.target.value;
    });
    el.addEventListener('change', (ev) => {
      const k = ev.target.dataset.wOpt;
      if (!k) return;
      if (k === 'byePoints') W.options.byePoints = ev.target.checked ? 'avg' : 'none';
      else if (k === 'timer') W.options.roundMinutes = ev.target.checked ? 12 : 0;
      else W.options[k] = ev.target.checked;
      renderAll();
    });
    el.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b || !el.contains(b)) return;
      const a = b.dataset.act;
      if (a === 'w-close') {
        if (!edit && (W.people.length || W.step > 0) && !(await confirmDialog('Verwerfen?', 'Die Eingaben gehen verloren.', 'Verwerfen', true))) return;
        closeLayer(o);
      } else if (a === 'w-back') goStep(W.step - 1);
      else if (a === 'w-goto') goStep(Number(b.dataset.step));
      else if (a === 'w-next') {
        if (W.step === 1) {
          const err = checkPeople();
          if (err) { W.stepError = err; renderNav(); haptic([30, 40, 30]); return; }
        }
        if (W.step < STEP_VIEWS.length - 1) { goStep(W.step + 1); return; }
        const err = check();
        if (err) { toast(err); return; }
        if (edit) { applyEdit(); return; }
        if (W.signup) openSignup(b);
        else if (buildTeams()) openTeamBuilder({ people: W.people, mode: W.mode, onStart: launchLocal });
        else launchLocal(W.people);
      } else if (a === 'w-sport') {
        W.sport = b.dataset.sport;
        if (!E.SPORTS[W.sport].singles) W.discipline = 'doubles';
        W.format = E.defaultFormat(W.mode, W.sport);
        W.rules = {};
        renderAll();
      } else if (a === 'w-disc') {
        W.discipline = b.dataset.v;
        if (!E.modeAvailable(W.mode, W.sport, W.discipline)) setMode('team');
        renderAll();
      } else if (a === 'w-mode') { setMode(b.dataset.id); renderAll(); }
      else if (a === 'w-info') openModeInfo(b.dataset.id, W.sport, E.modeAvailable(b.dataset.id, W.sport, W.discipline) ? () => { setMode(b.dataset.id); renderAll(); } : null);
      else if (a === 'w-signup') { W.signup = b.dataset.v === '1'; W.stepError = ''; renderAll(); }
      else if (a === 'w-teams') { W.teamsFixed = b.dataset.v === '1'; W.stepError = ''; renderAll(); }
      else if (a === 'w-add') {
        const inp = el.querySelector('#w-add');
        if (addNames([inp.value])) { haptic(5); renderAll({ focusAdd: true }); } else inp.focus();
      } else if (a === 'w-lvl') {
        const i = Number(b.dataset.i);
        openPersonSheet({
          title: 'Level', person: W.people[i],
          onSave: async (p) => {
            if (W.people.some((x, j) => j !== i && x.name.toLowerCase() === p.name.toLowerCase())) throw new Error('Den Namen gibt es schon.');
            W.people[i] = p;
            renderAll();
          }
        });
      } else if (a === 'w-del') { W.people.splice(Number(b.dataset.i), 1); renderAll(); }
      else if (a === 'w-paste') {
        const txt = await promptDialog('Liste einfügen', '', { multiline: true, ok: 'Übernehmen', placeholder: 'Ein Name pro Zeile oder mit Komma getrennt', text: 'Zum Beispiel aus dem Gruppenchat kopiert.' });
        if (txt) { const n = addNames(txt.split(/[\n,;]+/).map((x) => x.replace(/^\s*(\d+[.)]|[-*•])\s*/, ''))); toast(`${n} hinzugefügt`); renderAll(); }
      } else if (a === 'w-fill') {
        const word = unitWord() === 'Teams' ? 'Team' : 'Spieler';
        let target = Math.max(8, W.people.length + 1);
        if (m().unit === 'player' || buildTeams()) target = Math.ceil(target / 4) * 4;
        let i = 1;
        while (W.people.length < target) {
          const name = `${word} ${i++}`;
          if (!W.people.some((p) => p.name === name)) W.people.push({ name });
        }
        W.stepError = '';
        toast('Platzhalter lassen sich später im Turnier umbenennen.');
        renderAll();
      } else if (a === 'w-step') {
        const k = b.dataset.k, d = Number(b.dataset.d), min = Number(b.dataset.min), max = Number(b.dataset.max);
        if (k === 'courts') W.courts = Math.max(min, Math.min(max, W.courts + d));
        else if (k === 'rounds') {
          const cur = W.rounds || (W.signup ? 6 - d : E.defaultRounds({ mode: W.mode, format: W.format, entrants: W.people, options: W.options }) || 6);
          W.rounds = Math.max(min, Math.min(max, cur + d));
        } else {
          const cur = Number(W.options[k]) || 12;
          W.options[k] = Math.max(min, Math.min(max, cur + d));
        }
        haptic(4);
        renderAll();
      } else if (a === 'w-opt') { W.options[b.dataset.k] = b.dataset.v; renderAll(); }
      else if (a === 'w-format') {
        W.format = b.dataset.id;
        if (fmt().timed && !W.options.roundMinutes) W.options.roundMinutes = 12;
        W.rounds = null;
        renderAll();
      } else if (a === 'w-rule') { W.rules[E.RULES[W.sport].key] = b.dataset.v; renderAll(); }
    });
  }

  /* ---------- Spielerseite: Anmeldung per Link ---------- */
  const Player = {
    eventId: null, event: null, error: null, me: null, editing: false, busy: false, timer: null,
    init() {
      const q = new URLSearchParams(location.search);
      const id = q.get('anmeldung');
      if (!id) return false;
      this.eventId = id.slice(0, 20);
      const pid = q.get('ich');
      const key = new URLSearchParams(location.hash.slice(1)).get('k');
      if (pid && key) Me.set(this.eventId, { pid, token: key });
      this.me = Me.get(this.eventId);
      try { history.replaceState(null, '', `${location.pathname}?anmeldung=${encodeURIComponent(this.eventId)}`); } catch (e) { /* Adresse bleibt */ }
      this.load();
      this.timer = setInterval(() => { if (document.visibilityState === 'visible' && !this.busy && !overlays.length && !this.editing) this.load(); }, 20000);
      return true;
    },
    async load() {
      try {
        const { event } = await API.call('GET', `/events/${encodeURIComponent(this.eventId)}`);
        this.event = event;
        this.error = null;
        if (this.me) {
          const p = event.players.find((x) => x.id === this.me.pid);
          if (p) this.me = Object.assign({}, this.me, { name: p.name });
          else { Me.set(this.eventId, null); this.me = null; }
        }
      } catch (e) { this.error = e.message; }
      render();
    },
    render() {
      const ev = this.event;
      let body;
      if (!ev) {
        body = this.error ? `<div class="empty card"><h2>Anmeldung nicht verfügbar</h2><p>${esc(this.error)}</p><button class="btn filled" type="button" data-act="p-reload">Erneut versuchen</button></div>` : '<div class="empty card"><p>Lädt …</p></div>';
        paint({ title: 'Anmeldung', large: false, body }, { tabs: false });
        return;
      }
      const info = C.modes[ev.mode] || { name: ev.mode, tag: '', steps: [] };
      const mine = this.me && ev.players.find((p) => p.id === this.me.pid);
      let main;
      if (mine && !this.editing) {
        const link = personalUrl(ev.id, this.me);
        main = `<section class="card next"><div class="state"><span class="badge live">Du bist dabei</span></div><h2>${esc(mine.name)}</h2><p>${esc(E.levelLabel(mine) || '')}</p>
          <div class="actions"><button class="btn tonal" type="button" data-act="p-edit">${icon('edit', 'sm')}Ändern</button><button class="btn danger" type="button" data-act="p-leave">Abmelden</button></div></section>
          <section class="section"><div class="section-h"><h2>Dein persönlicher Link</h2></div><div class="card"><p class="url" style="text-align:left">${esc(link)}</p>
          <div class="row"><button class="btn filled" type="button" data-act="p-copy">${icon('copy', 'sm')}Kopieren</button>${navigator.share ? `<button class="btn tonal" type="button" data-act="p-share">${icon('share', 'sm')}An mich senden</button>` : ''}</div>
          <p class="foot" style="padding:0">Mit diesem Link änderst du Name oder Level später, auch von einem anderen Gerät.</p></div></section>`;
      } else if (ev.open || mine) {
        main = `<section class="section"><div class="section-h"><h2>${mine ? 'Angaben ändern' : 'Jetzt anmelden'}</h2></div><div class="card" id="p-form">${personFields(mine || {}, 'pp')}<p class="note err" id="pp-err" hidden></p>
          <div class="row">${mine ? '<button class="btn" type="button" data-act="p-cancel">Abbrechen</button>' : ''}<button class="btn filled big grow" type="button" data-act="p-submit">${mine ? 'Speichern' : 'Anmelden'}</button></div></div></section>`;
      } else {
        main = '<section class="card"><p>Die Anmeldung ist geschlossen. Bitte direkt an die Turnierleitung wenden.</p></section>';
      }
      const list = ev.players.map((p) => `<div class="cell"><span class="body"><span class="t1">${esc(p.name)}${mine && p.id === mine.id ? ' <span class="badge tint">du</span>' : ''}</span></span>${lvlBadge(p)}</div>`).join('');
      body = `<section class="card player-hero">${sportMark(ev.sport)}<div><h1>${esc(ev.name)}</h1><p class="muted">${esc(info.name)}${ev.when ? ' · ' + esc(ev.when) : ''}</p></div></section>
        ${main}
        <section class="section"><div class="section-h"><h2>So läuft ${esc(info.name)}</h2></div><div class="card"><p>${esc(info.tag)}</p><ol class="steps">${info.steps.map((s) => `<li><span>${esc(s)}</span></li>`).join('')}</ol></div></section>
        <section class="section"><div class="section-h"><h2>Angemeldet (${ev.players.length})</h2></div>${ev.players.length ? `<div class="list">${list}</div>` : '<p class="foot">Noch niemand – sei die oder der Erste.</p>'}</section>
        <p class="foot" style="text-align:center">Turnierorganisation mit Courtside</p>`;
      const keep = document.activeElement && document.activeElement.closest && document.activeElement.closest('#p-form');
      if (keep) return; // Nicht neu zeichnen, während jemand tippt.
      paint({ title: 'Anmeldung', large: false, body }, { tabs: false });
      const form = $('#p-form');
      if (form) bindLevelCards(form);
    },
    async submit() {
      const form = $('#p-form');
      const p = readPerson(form, 'pp');
      const err = $('#pp-err');
      if (p.error) { err.textContent = p.error; err.hidden = false; return; }
      this.busy = true;
      form.querySelectorAll('button').forEach((x) => { x.disabled = true; });
      try {
        if (this.me && this.editing) {
          await API.call('PUT', `/events/${this.eventId}/players/${this.me.pid}`, personPayload(p), this.me.token);
          toast('Gespeichert');
        } else {
          const res = await API.call('POST', `/events/${this.eventId}/players`, personPayload(p));
          this.me = { pid: res.player.id, token: res.token, name: res.player.name };
          Me.set(this.eventId, this.me);
          haptic([10, 40, 10]);
          toast('Angemeldet – bis bald auf dem Platz!');
        }
        this.editing = false;
        if (document.activeElement) document.activeElement.blur();
        await this.load();
      } catch (e) {
        err.textContent = e.message;
        err.hidden = false;
        form.querySelectorAll('button').forEach((x) => { x.disabled = false; });
      }
      this.busy = false;
    },
    async leave() {
      if (!(await confirmDialog('Abmelden?', 'Dein Platz wird frei.', 'Abmelden', true))) return;
      try {
        await API.call('DELETE', `/events/${this.eventId}/players/${this.me.pid}`, null, this.me.token);
        Me.set(this.eventId, null);
        this.me = null;
        toast('Abgemeldet');
        this.load();
      } catch (e) { toast(e.message); }
    }
  };

  /* ---------- Beispiel ---------- */
  function createDemo() {
    const people = [['Anna', 'pro'], ['Ben', 'intermediate'], ['Carla', 'intermediate'], ['David', 'beginner'], ['Elif', 'pro'], ['Finn', 'beginner'], ['Greta', 'intermediate'], ['Hannes', 'intermediate']];
    const t = E.create({
      name: 'Padel Americano Donnerstag', sport: 'padel', discipline: 'doubles', mode: 'americano', format: 'p24', courts: 2,
      entrants: people.map(([name, level]) => ({ name, level })), rules: { deuce: 'golden' }, options: { rounds: 7, byePoints: 'avg', balance: true }, demo: true
    });
    const scores = [[15, 9], [11, 13], [16, 8], [12, 12]];
    let k = 0;
    for (let r = 0; r < 2; r++) {
      t.rounds[t.cur].matches.forEach((m) => { const [a, b] = scores[k++ % scores.length]; E.setResult(t, m.id, { a, b }); });
      E.advance(t);
    }
    Store.data.tournaments.unshift(t);
    Store.save();
    return t;
  }

  /* ---------- Taktgeber: Timer, Anmeldelisten ---------- */
  function tick() {
    const now = Date.now();
    Store.data.tournaments.forEach((t) => {
      if (t.status !== 'running' || !t.timer || !t.timer.endsAt) return;
      const left = (t.timer.endsAt - now) / 1000;
      if (left <= 60 && !t.timer.warned) {
        t.timer.warned = true;
        Store.save();
        Sound.warn(); haptic([120, 80, 120]);
        toast(`${t.name}: noch 1 Minute`);
      }
      if (left <= 0 && !t.timer.rang) {
        t.timer.rang = true;
        Store.save();
        Sound.end(); haptic([400, 150, 400, 150, 700]);
        showTimeUp(t);
      }
    });
    const r = route();
    const t = r && r.name === 't' ? getT(r.id) : null;
    if (!t) return;
    if (t.status === 'draft') {
      const s = draftSync.get(t.id);
      if (document.visibilityState === 'visible' && !overlays.length && (!s || (s.at && now - s.at > 15000))) refreshDraft(t);
      return;
    }
    const clockEl = document.querySelector('[data-clock]');
    if (clockEl) {
      const left = remaining(t);
      clockEl.textContent = clockText(left);
      clockEl.classList.toggle('warn', left <= 60 && left > 0);
      clockEl.classList.toggle('over', left <= 0 && !!t.timer.endsAt);
      const bar = document.querySelector('[data-bar]');
      if (bar) bar.style.width = Math.max(0, Math.min(100, (left / t.timer.dur) * 100)) + '%';
    }
  }
  setInterval(tick, 250);

  function showTimeUp(t) {
    const r = route();
    if (!r || r.id !== t.id) { toast(`${t.name}: Zeit ist um!`); return; }
    const el = document.createElement('button');
    el.className = 'timeup';
    el.type = 'button';
    el.innerHTML = '<span><strong>Zeit!</strong><p>Ballwechsel zu Ende spielen.<br>Bei Gleichstand entscheidet der nächste Punkt.</p><p style="font-size:15px;margin-top:24px;opacity:.8">Tippen zum Schließen</p></span>';
    el.addEventListener('click', () => el.remove());
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 12000);
  }

  /* ---------- Aktionen ---------- */
  const curT = () => { const r = route(); return r && r.name === 't' ? getT(r.id) : null; };
  const A = {
    tab: (b) => setTab(b.dataset.tab),
    back: () => uiBack(),
    new: () => openWizard(),
    'new-with': (b) => openWizard({ mode: b.dataset.id, sport: b.dataset.sport }),
    'open-t': (b) => go({ name: 't', id: b.dataset.id, seg: 'now' }),
    'open-mode': (b) => go({ name: 'mode', id: b.dataset.id, sport: b.dataset.sport }),
    'modes-sport': (b) => { nav.modeSport = b.dataset.sport; render(); },
    'share-mode': (b) => shareOut(modeText(b.dataset.id), C.modes[b.dataset.id].name),
    demo: () => { const t = createDemo(); nav.tab = 'turniere'; nav.stack = []; go({ name: 't', id: t.id, seg: 'now' }); },
    seg: (b) => { route().seg = b.dataset.seg; render(); window.scrollTo(0, 0); },
    undo: () => undo(curT()),
    't-more': (b) => { const t = curT(); if (t) tournamentMenu(b, t); },
    'd-more': (b) => { const t = curT(); if (t) draftMenu(b, t); },
    't-settings': () => { const t = curT(); if (t) openWizard({ edit: t }); },
    'd-start': async () => {
      const t = curT();
      if (!t) return;
      if (t.reg.open && !(await confirmDialog('Anmeldung schließen?', 'Danach kann sich niemand mehr selbst eintragen. Das Turnier startet mit den Angemeldeten.', 'Schließen & weiter'))) return;
      startFromDraft(t);
    },
    'd-share': () => { const t = curT(); if (t) shareOut(inviteText(t), t.name, regUrl(t.reg.eventId)); },
    'd-copy': () => { const t = curT(); if (t) copyText(regUrl(t.reg.eventId), 'Link kopiert'); },
    'd-refresh': () => { const t = curT(); if (t) refreshDraft(t, { quiet: false }); },
    'd-add': () => {
      const t = curT();
      if (!t) return;
      openPersonSheet({ title: 'Person eintragen', saveLabel: 'Eintragen', onSave: (p) => adminCall(t, 'POST', '/players', personPayload(p)) });
    },
    'd-edit': (b) => {
      const t = curT();
      const p = t && (t.players || []).find((x) => x.id === b.dataset.pid);
      if (!p) return;
      openPersonSheet({
        title: p.name, person: p,
        onSave: (np) => adminCall(t, 'PUT', `/players/${p.id}`, personPayload(np)),
        onDelete: async () => { if (await confirmDialog('Entfernen?', `${p.name} wird von der Liste genommen.`, 'Entfernen', true)) await adminCall(t, 'DELETE', `/players/${p.id}`); }
      });
    },
    result: (b) => { const t = curT(); if (t) openScore(t, b.dataset.match); },
    win: (b) => {
      const t = curT();
      if (!t) return;
      const f = E.findMatch(t, b.dataset.match);
      const side = b.dataset.side;
      const res = mutate(t, 'Sieger', () => E.setResult(t, b.dataset.match, { w: side }));
      if (res.ok && f) toast(`Sieg: ${E.sideName(t, side === 'a' ? f.m.a : f.m.b)}`, { label: 'Rückgängig', fn: () => undo(getT(t.id)) });
    },
    next: (b) => {
      const t = curT();
      if (!t) return;
      const id = b.dataset.id;
      if (id === 'start') {
        if (E.roundTimed(t)) timerStart(t); else { E.startRound(t); Store.save(); }
        haptic([10, 30, 10]);
        render();
      } else if (id === 'result') openScore(t, b.dataset.match);
      else if (id === 'advance') { if (mutate(t, 'Nächste Runde', () => E.advance(t)).ok) window.scrollTo({ top: 0, behavior: 'smooth' }); }
      else if (id === 'addRound') mutate(t, 'Zusatzrunde', () => E.addRound(t));
    },
    'timer-edit': () => { const t = curT(); if (t) openTimerSheet(t); },
    'timer-toggle': () => { const t = curT(); if (!t) return; if (t.timer.endsAt) timerPause(t); else timerStart(t); haptic(); render(); },
    'timer-plus': () => {
      const t = curT();
      if (!t) return;
      if (t.timer.endsAt) t.timer.endsAt += 60000; else t.timer.left = (t.timer.left != null ? t.timer.left : t.timer.dur) + 60;
      if (remaining(t) > 60) { t.timer.warned = false; t.timer.rang = false; }
      Store.save();
      tick();
    },
    'timer-reset': async () => {
      const t = curT();
      if (!t) return;
      if (t.timer.endsAt && !(await confirmDialog('Timer zurücksetzen?', 'Die Zeit dieser Runde beginnt von vorn.', 'Zurücksetzen'))) return;
      Object.assign(t.timer, { endsAt: null, left: null, warned: false, rang: false });
      Store.save();
      render();
    },
    speak: () => { const t = curT(); if (t) speak(roundSpeech(t)); },
    'share-table': () => { const t = curT(); if (t) shareOut(E.shareText(t, 'table'), t.name); },
    'copy-link': () => copyText(appUrl(), 'Link kopiert'),
    'share-link': () => { if (navigator.share) navigator.share({ title: 'Courtside', text: 'Turnier-App für Padel, Pickleball und Tennis', url: appUrl() }).catch(() => {}); },
    install: async () => { if (!installEvent) return; installEvent.prompt(); try { await installEvent.userChoice; } catch (e) { /* abgebrochen */ } installEvent = null; render(); },
    design: (b) => { S().design = b.dataset.v; Store.save(); render(); },
    'default-sport': (b) => { S().sport = b.dataset.sport; Store.save(); render(); },
    'backup-copy': () => copyText(JSON.stringify({ app: 'courtside', v: 2, tournaments: Store.data.tournaments }), 'Sicherung kopiert'),
    'backup-paste': async () => {
      const txt = await promptDialog('Sicherung einfügen', '', { multiline: true, ok: 'Übernehmen', placeholder: 'Kopierten Sicherungstext hier einfügen' });
      if (!txt) return;
      try {
        const d = JSON.parse(txt);
        const list = (Array.isArray(d) ? d : d.tournaments || []).filter(compatible);
        if (!list.length) throw new Error('leer');
        list.forEach((t) => replaceT(t));
        Store.save();
        toast(`${list.length} ${list.length === 1 ? 'Turnier' : 'Turniere'} übernommen`);
        render();
      } catch (e) { toast('Das ist keine gültige Sicherung. Bitte den ganzen Text einfügen.'); }
    },
    wipe: async () => {
      if (!(await confirmDialog('Alle Turniere löschen?', 'Das lässt sich nicht rückgängig machen.', 'Alle löschen', true))) return;
      Store.data.tournaments = [];
      undoStacks.clear();
      Store.save();
      toast('Alle Turniere gelöscht');
      render();
    },
    'p-reload': () => Player.load(),
    'p-submit': () => Player.submit(),
    'p-edit': () => { Player.editing = true; render(); },
    'p-cancel': () => { Player.editing = false; if (document.activeElement) document.activeElement.blur(); render(); },
    'p-leave': () => Player.leave(),
    'p-copy': () => copyText(personalUrl(Player.eventId, Player.me), 'Link kopiert'),
    'p-share': () => shareOut('Mein Link zur Turnier-Anmeldung', Player.event ? Player.event.name : 'Anmeldung', personalUrl(Player.eventId, Player.me))
  };

  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]');
    if (!b || b.closest('.layer')) return;
    const fn = A[b.dataset.act];
    if (fn) { ev.preventDefault(); fn(b, ev); }
  });
  document.addEventListener('change', async (ev) => {
    const on = ev.target.dataset && ev.target.dataset.on;
    if (!on || ev.target.closest('.layer')) return;
    if (on === 'set-sound') { S().sound = ev.target.checked; if (ev.target.checked) { Sound.unlock(); Sound.beep(880, 0.15); } }
    else if (on === 'set-vibrate') { S().vibrate = ev.target.checked; haptic(20); }
    else if (on === 'share-url') {
      const v = ev.target.value.trim();
      if (v && !/^https?:\/\/\S+$/i.test(v)) { toast('Bitte eine vollständige Adresse mit https:// eingeben.'); return; }
      S().shareUrl = v; Store.save(); render(); return;
    } else if (on === 'plan-me') { route().me = ev.target.value; render(); return; }
    else if (on === 'd-open') {
      const t = curT();
      const want = ev.target.checked;
      try { await adminCall(t, 'PATCH', '', { open: want }); t.reg.open = want; Store.save(); toast(want ? 'Anmeldung geöffnet' : 'Anmeldung geschlossen'); }
      catch (e) { ev.target.checked = !want; toast(e.message); }
      render();
      return;
    }
    Store.save();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && Player.eventId && ev.target.closest && ev.target.closest('#p-form') && ev.target.tagName === 'INPUT') { ev.preventDefault(); Player.submit(); }
  });
  document.addEventListener('pointerdown', () => Sound.unlock(), { passive: true });
  window.addEventListener('storage', (ev) => {
    if (ev.key !== KEY || overlays.length || Player.eventId) return;
    Store.load();
    render();
  });

  /* ---------- Start ---------- */
  Store.load();
  const playerMode = API.available() && Player.init();
  if (!playerMode && !Store.data.seeded) {
    Store.data.seeded = true;
    if (!Store.data.tournaments.length) createDemo(); else Store.save();
  }
  try { history.replaceState({ cs: 'root' }, ''); } catch (e) { histOK = false; }
  render();
  if ('serviceWorker' in navigator && !embedded() && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* Offline-Modus nicht verfügbar */ });
  }
})();
