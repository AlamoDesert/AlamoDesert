/* Courtside – Oberfläche. Rendert die Ansichten, verwaltet Speicher, Navigation, Timer und Eingaben. */
(() => {
  'use strict';
  const E = window.Engine;
  const C = window.CONTENT;
  const VERSION = '1.0.0';

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
  const MODE_ORDER = {
    padel: ['americano', 'mexicano', 'kotc', 'team_americano', 'mixed', 'team_mexicano', 'groups_ko', 'knockout', 'round_robin', 'winner_stays', 'rally_king', 'compass'],
    pickleball: ['americano', 'kotc', 'winner_stays', 'round_robin', 'groups_ko', 'knockout', 'team_americano', 'mexicano', 'mixed', 'team_mexicano', 'rally_king', 'compass'],
    tennis: ['round_robin', 'knockout', 'compass', 'groups_ko', 'americano', 'kotc', 'winner_stays', 'team_americano', 'mexicano', 'mixed', 'team_mexicano', 'rally_king']
  };

  /* ---------- Speicher ---------- */
  const KEY = 'courtside.v1';
  const DEFAULT_SETTINGS = { design: 'auto', sound: true, vibrate: true, shareUrl: '', sport: 'padel' };
  const Store = {
    data: { tournaments: [], settings: Object.assign({}, DEFAULT_SETTINGS), seeded: false },
    persistent: true,
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return;
        const d = JSON.parse(raw);
        if (d && Array.isArray(d.tournaments)) {
          this.data.tournaments = d.tournaments.filter((t) => t && t.id && E.MODES[t.mode]);
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
  function replaceT(t) {
    const i = Store.data.tournaments.findIndex((x) => x.id === t.id);
    if (i >= 0) Store.data.tournaments[i] = t; else Store.data.tournaments.unshift(t);
  }

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
    const s = undoStacks.get(t.id);
    if (!s || !s.length) return;
    const { json, label } = s.pop();
    replaceT(JSON.parse(json));
    Store.save();
    render();
    toast(`Rückgängig: ${label}`);
    haptic();
  }
  // Ändert ein Turnier mit Undo-Punkt. fn darf {ok:false, error} liefern.
  function mutate(t, label, fn, { quiet = false } = {}) {
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
    if (!quiet) haptic();
    return r || { ok: true };
  }
  function saveQuiet() { Store.save(); }

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

  /* ---------- Spielfeld-Grafik ---------- */
  function courtLines(sport) {
    const L = (x1, y1, x2, y2, c = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${c ? ` class="${c}"` : ''}/>`;
    const box = '<rect x="0" y="0" width="200" height="100" class="wall"/>';
    if (sport === 'pickleball') return box + L(100, 0, 100, 100, 'net') + L(68.2, 0, 68.2, 100) + L(131.8, 0, 131.8, 100) + L(0, 50, 68.2, 50) + L(131.8, 50, 200, 50);
    if (sport === 'tennis') return box + L(0, 12.5, 200, 12.5) + L(0, 87.5, 200, 87.5) + L(100, 0, 100, 100, 'net') + L(46.2, 12.5, 46.2, 87.5) + L(153.8, 12.5, 153.8, 87.5) + L(46.2, 50, 153.8, 50);
    return box + L(100, 0, 100, 100, 'net') + L(30.5, 0, 30.5, 100) + L(169.5, 0, 169.5, 100) + L(30.5, 50, 169.5, 50);
  }
  const linesSVG = (sport, cls = 'lines') => `<svg class="${cls}" viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true"><g style="vector-effect:non-scaling-stroke">${courtLines(sport)}</g></svg>`;
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
  let histOK = true, ignorePops = 0;
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
    title, text,
    actions: [{ label: 'Abbrechen', value: false }, { label: okLabel, value: true, kind: danger ? 'danger' : 'filled' }]
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

  function sheet({ title, body, foot = '', cls = '', onClose, cancelLabel = 'Abbrechen', doneLabel = '' }) {
    const html = `<div class="scrim"></div><section class="sheet ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
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
  function shareOut(text, title) {
    if (navigator.share) {
      navigator.share({ title, text }).catch((e) => { if (!e || e.name !== 'AbortError') copyText(text, 'In die Zwischenablage kopiert'); });
      return;
    }
    copyText(text, 'In die Zwischenablage kopiert');
  }

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
    const r = route();
    let v;
    if (r && r.name === 't') {
      const t = getT(r.id);
      if (!t) { nav.stack.pop(); return render(); }
      v = viewTournament(t, r);
    } else if (r && r.name === 'mode') v = viewMode(r.id, r.sport);
    else v = TABS.find((x) => x.id === nav.tab).view();
    currentView = v;
    document.body.classList.toggle('no-tabs', !!r);

    const bar = $('#topbar');
    bar.querySelector('.tb-left').innerHTML = r ? `<button class="navbtn icon" data-act="back" type="button" aria-label="Zurück">${icon('back')}</button>` : '';
    bar.querySelector('.tb-title').textContent = v.title;
    bar.querySelector('.tb-right').innerHTML = v.right || '';
    bar.classList.toggle('solid', !v.large);

    const view = $('#view');
    view.innerHTML = (v.large ? `<h1 class="large-title" id="large-title">${esc(v.title)}</h1>` : '') + v.body;
    if (anim) {
      view.classList.remove('view-enter-push', 'view-enter-pop', 'view-enter-tab');
      void view.offsetWidth;
      view.classList.add('view-enter-' + anim);
    }
    $('#tabbar').innerHTML = TABS.map((x) => `<button class="tab${x.id === nav.tab ? ' on' : ''}" data-act="tab" data-tab="${x.id}" type="button" aria-current="${x.id === nav.tab ? 'page' : 'false'}"><span class="pill">${icon(x.icon)}</span><span>${x.label}</span></button>`).join('');
    $('#tabbar').classList.toggle('glass', PLATFORM === 'ios');
    const fab = $('#fab');
    fab.hidden = !(PLATFORM === 'android' && !r && nav.tab === 'turniere');
    fab.innerHTML = `${icon('plus')}<span>Neues Turnier</span>`;
    onScroll();
    if (v.after) v.after();
    wantWake = !!(r && r.name === 't' && getT(r.id) && getT(r.id).status === 'running');
    syncWake();
    tick();
  }
  function onScroll() {
    const bar = $('#topbar');
    bar.classList.toggle('scrolled', window.scrollY > (currentView && currentView.large ? 36 : 2));
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Turnier-Liste ---------- */
  function statusLine(t) {
    const m = E.MODES[t.mode];
    const info = C.modes[t.mode];
    let s;
    if (t.status === 'finished') {
      const p = E.podium(t);
      s = p.length ? `Sieg: ${p[0].join(', ')}` : 'Beendet';
    } else if (m.engine === 'rotation' || m.engine === 'ladder') {
      const planned = m.engine === 'rotation' && m.pairing === 'circle' ? t.rounds.length : t.options.rounds;
      s = `Runde ${t.cur + 1} von ${planned}`;
    } else if (m.engine === 'pool') {
      const real = t.matches.filter((x) => !x.bye);
      s = `${real.filter((x) => x.w).length} von ${real.length} Spielen`;
    } else if (m.engine === 'queue') s = `${t.matches.filter((x) => x.w).length} Spiele gespielt`;
    else s = `${t.rally.rallies} Ballwechsel`;
    return `${info.name} · ${s}`;
  }
  function tournamentCell(t) {
    return `<button class="cell tappable" data-act="open-t" data-id="${t.id}" type="button">
      ${sportMark(t.sport)}
      <span class="body"><span class="t1">${esc(t.name)}${t.demo ? ' <span class="badge tint">Beispiel</span>' : ''}</span><span class="t2">${esc(statusLine(t))}</span></span>
      <span class="trail">${t.status === 'running' ? '<span class="badge live">läuft</span>' : esc(dateDE(t.finishedAt || t.updatedAt))}${icon('chev', 'sm chev')}</span></button>`;
  }
  function viewTournaments() {
    const list = Store.data.tournaments.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const running = list.filter((t) => t.status === 'running');
    const done = list.filter((t) => t.status !== 'running');
    let body = '';
    if (!list.length) {
      body = `<div class="empty card">${sportMark('padel')}<h2>Noch kein Turnier</h2>
        <p>Lege ein Americano, Mexicano oder King of the Court an. Die App lost aus, stoppt die Zeit und sagt dir, was als Nächstes dran ist.</p>
        <div class="row" style="justify-content:center"><button class="btn filled big" data-act="new" type="button">${icon('plus')}Neues Turnier</button>
        <button class="btn" data-act="demo" type="button">Beispiel ansehen</button></div></div>`;
    } else {
      if (running.length) body += `<section class="section"><div class="section-h"><h2>Laufend</h2></div><div class="list">${running.map(tournamentCell).join('')}</div></section>`;
      if (done.length) body += `<section class="section"><div class="section-h"><h2>Beendet</h2></div><div class="list">${done.map(tournamentCell).join('')}</div></section>`;
    }
    if (!Store.persistent) body += '<p class="note warn">Dieser Browser speichert nichts dauerhaft. Sichere wichtige Turniere über Einstellungen → Sicherung kopieren.</p>';
    return {
      title: 'Turniere', large: true, body,
      right: PLATFORM === 'ios' ? `<button class="navbtn icon tint" data-act="new" type="button" aria-label="Neues Turnier">${icon('plus')}</button>` : ''
    };
  }

  /* ---------- Turnier-Ansicht ---------- */
  function segsFor(t) {
    const m = E.MODES[t.mode];
    const s = [['now', 'Jetzt'], ['table', 'Tabelle']];
    if (m.engine === 'rotation' || m.engine === 'ladder') s.push(['plan', 'Plan']);
    else if (m.engine === 'pool') s.push(['plan', m.structure === 'rr' ? 'Spielplan' : m.structure === 'groups' ? 'Spiele' : 'Turnierbaum']);
    else if (m.engine === 'queue') s.push(['plan', 'Verlauf']);
    return s;
  }
  function viewTournament(t, r) {
    const seg = r.seg || 'now';
    const segs = segsFor(t);
    const segHTML = PLATFORM === 'ios'
      ? `<div class="seg" role="tablist">${segs.map(([k, l]) => `<button type="button" role="tab" data-act="seg" data-seg="${k}" aria-pressed="${k === seg}">${l}</button>`).join('')}</div>`
      : `<div class="tabs" role="tablist">${segs.map(([k, l]) => `<button type="button" role="tab" data-act="seg" data-seg="${k}" aria-pressed="${k === seg}">${l}</button>`).join('')}</div>`;
    let body = segHTML;
    if (t.demo) body += `<div class="banner">${icon('info', 'sm')}<span>Beispiel-Turnier zum Ausprobieren. Löschen über das Menü oben rechts.</span></div>`;
    if (seg === 'now') body += nowSection(t);
    else if (seg === 'table') body += tableSection(t);
    else body += planSection(t, r);
    const right = (canUndo(t) ? `<button class="navbtn icon" data-act="undo" type="button" aria-label="Rückgängig">${icon('undo')}</button>` : '') +
      `<button class="navbtn icon" data-act="t-more" type="button" aria-label="Mehr">${icon('more')}</button>`;
    return { title: t.name, large: false, body, right };
  }

  function rulesChips(t) {
    const m = E.MODES[t.mode];
    const fmt = E.fmtOf(t);
    const chips = [];
    if (m.formats) chips.push(fmt.name);
    if (m.engine === 'rally') chips.push(`Ziel: ${t.options.target} Punkte`);
    if (m.engine === 'queue' && Number(t.options.maxStreak) > 0) chips.push(`max. ${t.options.maxStreak} Siege in Folge`);
    const R = E.RULES[t.sport];
    const ro = R.options.find((o) => o.id === (t.rules[R.key] || R.def));
    if (ro) chips.push(ro.name);
    const serve = m.engine === 'rotation' ? E.serveHint(fmt) : null;
    return `<div class="chips">${chips.map((c) => `<span class="chip static">${esc(c)}</span>`).join('')}</div>` +
      (ro || serve ? `<p class="foot">${esc([ro && ro.hint, serve].filter(Boolean).join(' '))}</p>` : '');
  }

  function timerBlock(t) {
    if (!E.roundTimed(t) || !t.timer || !t.timer.dur) return '';
    const st = t.timer.endsAt ? 'run' : t.timer.left != null ? 'pause' : 'idle';
    return `<div class="timer" data-timer="${t.id}">
      <div class="clock num" data-clock aria-live="off">${clockText(t.timer.dur)}</div>
      <div class="ctl">
        <button class="iconbtn ${st === 'run' ? 'stop' : 'go'}" data-act="timer-toggle" type="button" aria-label="${st === 'run' ? 'Pause' : 'Start'}">${icon(st === 'run' ? 'pause' : 'play')}</button>
        <button class="iconbtn" data-act="timer-plus" type="button" aria-label="Eine Minute mehr"><span class="num" style="font-weight:700;font-size:15px">+1</span></button>
        <button class="iconbtn" data-act="timer-reset" type="button" aria-label="Zurücksetzen">${icon('reset')}</button>
      </div>
      <div class="bar"><span data-bar style="width:100%"></span></div></div>`;
  }

  function nextCard(t) {
    const n = E.next(t);
    const badge = { ready: '<span class="badge tint">Bereit</span>', live: '<span class="badge live">Läuft</span>', between: '<span class="badge warn">Weiter geht’s</span>', last: '<span class="badge warn">Fertig?</span>', wait: '<span class="badge">Wartet</span>' }[n.state] || '';
    const acts = [];
    if (n.action) acts.push(`<button class="btn filled big" data-act="next" data-id="${n.action.id}"${n.action.match ? ` data-match="${n.action.match}"` : ''} type="button">${esc(n.action.label)}</button>`);
    if (n.alt) acts.push(`<button class="btn tonal big" data-act="next" data-id="${n.alt.id}" type="button">${esc(n.alt.label)}</button>`);
    return `<section class="card next"><div class="state">${badge}</div><h2>${esc(n.title)}</h2><p>${esc(n.text)}</p>${timerBlock(t)}${acts.length ? `<div class="actions">${acts.join('')}</div>` : ''}</section>`;
  }

  function sinceMeta(t, m) {
    if (!m.calledAt || m.w) return '';
    const cap = Number(t.options.timeCap) || 0;
    return `<span class="meta" data-since="${esc(m.calledAt)}" data-cap="${cap}" data-mid="${m.id}">${icon('timer', 'sm')}<span class="num">0:00</span></span>`;
  }

  function moveHint(t, m) {
    const C2 = t.rounds[t.cur].matches.length;
    const k = m.court;
    const up = k === 0 ? `bleibt auf ${t.courts[0]}` : `↑ ${t.courts[k - 1]}`;
    const waiting = t.rounds[t.cur].byes.length > 0;
    const down = k === C2 - 1 ? (waiting ? 'wartet' : `bleibt auf ${t.courts[k]}`) : `↓ ${t.courts[k + 1]}`;
    return `Sieger ${up} · Verlierer ${down}`;
  }

  function matchCard(t, m, { label, meta = '', hint = '' } = {}) {
    const fmt = E.fmtOf(t);
    const winnerOnly = fmt.kind === 'winner';
    const done = !!m.w;
    const cls = (s) => (done && m.w !== 'd' ? (m.w === s ? 'win' : 'lose') : '');
    const names = (ids) => (Array.isArray(ids) ? ids.map((id) => `<span class="pn">${esc(E.nameOf(t, id))}</span>`).join('') : '<span class="pn">offen</span>');
    const lines = linesSVG(t.sport);
    let center;
    if (done) center = winnerOnly ? '<span class="net-score">✓</span>' : `<span class="net-score${fmt.kind === 'sets' ? ' sets' : ''}">${esc(E.scoreText(fmt, m.score)).replace(/ {2}/g, '<br>')}</span>`;
    else center = `<span class="net-score empty">${winnerOnly ? 'Sieger<br>antippen' : 'Ergebnis'}</span>`;
    let court;
    if (winnerOnly && !done) {
      const side = (s, ids) => `<button class="side ${s}" type="button" data-act="win" data-match="${m.id}" data-side="${s}" aria-label="Sieg für ${esc(E.sideName(t, ids))}">${names(ids)}</button>`;
      court = `<div class="field-court">${lines}${side('a', m.a)}${center}${side('b', m.b)}</div>`;
    } else {
      court = `<button class="field-court" type="button" data-act="result" data-match="${m.id}" aria-label="Ergebnis ${esc(label || '')} eintragen" style="width:calc(100% - 12px)">${lines}<span class="side a ${cls('a')}">${names(m.a)}</span>${center}<span class="side b ${cls('b')}">${names(m.b)}</span></button>`;
    }
    const edit = done ? `<button class="btn-text" data-act="result" data-match="${m.id}" type="button">Ändern</button>` : '';
    return `<article class="match c-${t.sport}${done ? ' done' : ''}"><div class="match-h"><span class="name">${esc(label || '')}</span>${meta}${edit}</div>${court}${hint ? `<p class="hint">${esc(hint)}</p>` : ''}</article>`;
  }

  function nowSection(t) {
    const m = E.MODES[t.mode];
    let out = '';
    if (t.status === 'finished') {
      out += podiumCard(t);
    } else {
      out += nextCard(t);
    }
    out += `<section class="section">${rulesChips(t)}</section>`;
    if (m.engine === 'rotation' || m.engine === 'ladder') {
      const r = t.rounds[t.cur];
      if (r && t.status === 'running') {
        const cards = r.matches.map((x) => matchCard(t, x, { label: t.courts[x.court], hint: m.engine === 'ladder' && x.w ? moveHint(t, x) : '' })).join('');
        out += `<section class="section"><div class="section-h"><h2>Runde ${t.cur + 1}</h2><button class="btn-text" data-act="speak" type="button">${icon('speaker', 'sm')}Vorlesen</button></div>
          <div class="courts${r.matches.length > 1 ? ' two' : ''}">${cards}</div>
          ${r.byes.length ? `<div class="byes"><strong>${m.engine === 'ladder' ? 'Wartet' : 'Pause'}:</strong> ${r.byes.map((id) => `<span class="chip static">${esc(E.nameOf(t, id))}</span>`).join('')}</div>` : ''}</section>`;
        out += upcomingPreview(t);
      }
    } else if (m.engine === 'queue') {
      const live = E.liveMatches(t);
      if (t.status === 'running') {
        out += `<section class="section"><div class="section-h"><h2>Auf dem Platz</h2><button class="btn-text" data-act="speak" type="button">${icon('speaker', 'sm')}Vorlesen</button></div><div class="courts${live.length > 1 ? ' two' : ''}">${live.map((x) => matchCard(t, x, { label: t.courts[x.court] + (x.king ? ' · König: ' + E.nameOf(t, x.king) : ''), meta: sinceMeta(t, x) })).join('')}</div></section>`;
        out += `<section class="section"><div class="section-h"><h2>Warteschlange</h2></div><div class="queue-list">${t.queue.waiting.map((id, i) => `<span class="q"><b>${i + 1}</b>${esc(E.nameOf(t, id))}</span>`).join('') || '<span class="muted">niemand</span>'}</div><p class="foot">Nummer 1 macht sich bereit. Verlierer stellen sich hinten an.</p></section>`;
      }
    } else if (m.engine === 'rally') {
      out += rallySection(t);
    } else if (m.engine === 'pool') {
      const live = E.liveMatches(t);
      const waiting = t.matches.filter((x) => Array.isArray(x.a) && Array.isArray(x.b) && !x.w && x.court == null).sort((a, b) => a.depth - b.depth || a.order - b.order);
      if (live.length) out += `<section class="section"><div class="section-h"><h2>Auf den Plätzen</h2><button class="btn-text" data-act="speak" type="button">${icon('speaker', 'sm')}Vorlesen</button></div><div class="courts${live.length > 1 ? ' two' : ''}">${live.map((x) => matchCard(t, x, { label: `${t.courts[x.court]} · ${x.label || ''}`, meta: sinceMeta(t, x) })).join('')}</div></section>`;
      if (waiting.length) out += `<section class="section"><div class="section-h"><h2>Als Nächstes</h2></div><div class="list">${waiting.slice(0, 6).map((x) => `<button class="cell tappable" type="button" data-act="result" data-match="${x.id}"><span class="body"><span class="t1">${esc(E.sideName(t, x.a))} – ${esc(E.sideName(t, x.b))}</span><span class="t2">${esc(x.label || '')} · wartet auf freien Platz</span></span></button>`).join('')}</div></section>`;
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

  function rallySection(t) {
    const R = t.rally;
    if (t.status !== 'running') return '';
    const st = E.standings(t);
    return `<section class="section"><div class="rally c-${t.sport}">
        <button class="side-card king" type="button" data-act="rally" data-who="king"><span class="role">${icon('crown', 'sm')} Königsseite · ${R.pts[R.king] || 0} Pkt.</span><span class="who">${esc(E.nameOf(t, R.king))}</span><span class="act">${icon('plus', 'sm')}König holt den Punkt</span></button>
        <button class="side-card chal" type="button" data-act="rally" data-who="chal"><span class="role">Herausforderer</span><span class="who">${esc(E.nameOf(t, R.chal))}</span><span class="act">${icon('shuffle', 'sm')}Gewinnt & wechselt</span></button>
      </div><p class="foot">Nach jedem Ballwechsel antippen, wer ihn gewonnen hat.</p></section>
      <section class="section"><div class="section-h"><h2>Wartet</h2></div><div class="queue-list">${R.waiting.map((id, i) => `<span class="q"><b>${i + 1}</b>${esc(E.nameOf(t, id))}</span>`).join('') || '<span class="muted">niemand</span>'}</div></section>
      <section class="section"><div class="section-h"><h2>Punkte</h2></div>${standingsTable(t, st)}</section>`;
  }

  function podiumCard(t) {
    const p = E.podium(t);
    if (!p.length) return `<section class="card next"><h2>Turnier beendet</h2><p>Es wurden keine Ergebnisse eingetragen.</p></section>`;
    const step = (i, cls) => p[i] ? `<div class="step ${cls}"><span class="who">${esc(p[i].join(', '))}</span><span class="block">${i + 1}</span></div>` : `<div class="step ${cls}"></div>`;
    const m = E.MODES[t.mode];
    const more = (m.engine === 'rotation' || m.engine === 'ladder') ? `<button class="btn tonal" data-act="next" data-id="addRound" type="button">Zusatzrunde</button>` : '';
    return `<section class="card next"><div class="state"><span class="badge tint">${icon('medal', 'sm')} Siegerehrung</span></div><h2>${esc(p[0].join(', '))} gewinnt</h2>
      <div class="podium">${step(1, 'p2')}${step(0, 'p1')}${step(2, 'p3')}</div>
      <div class="actions"><button class="btn filled" data-act="share-table" type="button">${icon('share', 'sm')}Endstand teilen</button>${more}</div></section>`;
  }

  function standingsTable(t, st, rows) {
    rows = rows || st.rows;
    if (!rows.length) return '<p class="foot">Noch keine Ergebnisse.</p>';
    const head = `<tr><th class="r">#</th><th>Name</th>${st.cols.map((c) => `<th>${esc(c.h)}</th>`).join('')}</tr>`;
    const val = (r, c) => {
      const v = r[c.k];
      if (c.k === 'diff' || c.k === 'sdiff') return v > 0 ? `+${v}` : String(v);
      return esc(v);
    };
    const body = rows.map((r) => `<tr class="${r.active === false ? 'off' : ''}"><td class="r">${r.rank <= 3 && (r.place || !st.rows.some((x) => 'place' in x)) ? `<span class="rank r${r.rank}">${r.rank}</span>` : r.place === null ? '–' : r.rank}</td><td class="n">${esc(r.name)}${r.active === false ? ' <span class="badge">raus</span>' : ''}</td>${st.cols.map((c) => `<td class="${c.strong ? 'strong' : ''}">${val(r, c)}</td>`).join('')}</tr>`).join('');
    return `<div class="table-wrap"><table class="st">${head}${body}</table></div>`;
  }

  function tableSection(t) {
    const st = E.standings(t);
    let out = '';
    if (st.groups && (!t.koBuilt)) {
      out += st.groups.map((g) => `<section class="section"><div class="section-h"><h2>${esc(g.name)}</h2></div>${standingsTable(t, st, g.rows)}</section>`).join('');
    } else {
      out += `<section class="section">${standingsTable(t, st)}</section>`;
      if (st.groups) out += st.groups.map((g) => `<section class="section"><div class="section-h"><h2>${esc(g.name)}</h2></div>${standingsTable(t, { cols: [{ k: 'played', h: 'Sp' }, { k: 'w', h: 'S', strong: true }, { k: 'l', h: 'N' }, { k: 'diff', h: '+/−' }], rows: g.rows }, g.rows.map((r) => Object.assign({}, r, { diff: r.pf - r.pa })))}</section>`).join('');
    }
    out += `<p class="foot">${esc(st.note || '')}</p>`;
    out += `<div class="row"><button class="btn tonal" data-act="share-table" type="button">${icon('share', 'sm')}Stand teilen</button></div>`;
    return out;
  }

  function planLine(t, x, { me, editable } = {}) {
    const fmt = E.fmtOf(t);
    const nm = (ids, side) => {
      const s = Array.isArray(ids) ? ids.map((id) => (id === me ? `<span class="me">${esc(E.nameOf(t, id))}</span>` : esc(E.nameOf(t, id)))).join(' & ') : (ids === 'BYE' ? 'Freilos' : 'offen');
      return `<span class="${side === 'b' ? 'tb' : ''}${x.w === side ? ' w' : ''}">${s}</span>`;
    };
    const sc = x.w ? (fmt.kind === 'winner' ? '✓' : esc(E.scoreText(fmt, x.score))) : '–';
    const tag = editable ? 'button' : 'div';
    return `<${tag} class="pline"${editable ? ` type="button" data-act="result" data-match="${x.id}"` : ''}><span class="c">${esc(x.court != null ? t.courts[x.court] : (x.label || ''))}</span>${nm(x.a, 'a')}<span class="s">${sc}</span>${nm(x.b, 'b')}</${tag}>`;
  }

  function planSection(t, r) {
    const m = E.MODES[t.mode];
    if (m.engine === 'rotation' || m.engine === 'ladder') {
      const me = r.me || '';
      const people = t.entrants.slice().sort((a, b) => a.name.localeCompare(b.name, 'de'));
      const pick = `<div class="field"><label for="plan-me">Plan für eine Person hervorheben</label><select class="input" id="plan-me" data-on="plan-me"><option value="">Alle anzeigen</option>${people.map((p) => `<option value="${p.id}"${p.id === me ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>`;
      const rounds = t.rounds.map((rd, i) => {
        const state = i < t.cur || t.status === 'finished' ? 'fertig' : i === t.cur ? 'läuft' : 'geplant';
        const editable = (i <= t.cur) && (m.engine !== 'ladder' || i === t.cur);
        const hasMe = !me || rd.matches.some((x) => x.a.concat(x.b).includes(me)) || rd.byes.includes(me);
        const mine = me && rd.byes.includes(me);
        return `<div class="list round" style="${hasMe ? '' : 'opacity:.45'}"><div class="round-h"><span class="t">Runde ${i + 1}</span><span class="badge${state === 'läuft' ? ' live' : ''}">${state}</span></div>
          ${rd.matches.map((x) => planLine(t, x, { me, editable })).join('')}
          ${rd.byes.length ? `<div class="pline byes-line"><span class="c">${m.engine === 'ladder' ? 'Wartet' : 'Pause'}</span><span>${rd.byes.map((id) => (id === me ? `<span class="me">${esc(E.nameOf(t, id))}</span>` : esc(E.nameOf(t, id)))).join(', ')}${mine ? ' – Pause' : ''}</span></div>` : ''}</div>`;
      }).join('');
      const more = m.engine === 'rotation' && m.pairing === 'dynamic' && t.status === 'running' ? '<p class="foot">Mexicano: Die nächste Runde entsteht erst nach allen Ergebnissen.</p>' : m.engine === 'ladder' && t.status === 'running' ? '<p class="foot">Die nächste Runde hängt von den Siegern ab.</p>' : '';
      return `<section class="section">${pick}</section><section class="section">${rounds}${more}</section>`;
    }
    if (m.engine === 'queue') {
      const done = t.matches.filter((x) => x.w).reverse();
      return `<section class="section"><div class="list round">${done.map((x) => planLine(t, x)).join('') || '<p class="foot" style="padding:16px">Noch keine Spiele.</p>'}</div><p class="foot">Neueste zuerst. Korrekturen über „Rückgängig“.</p></section>`;
    }
    // Pool
    if (m.structure === 'rr' || m.structure === 'groups') {
      const ms = t.matches.filter((x) => x.stage === 'rr' || x.stage === 'group');
      const by = new Map();
      ms.forEach((x) => { const k = x.depth; if (!by.has(k)) by.set(k, []); by.get(k).push(x); });
      let out = [...by.entries()].sort((a, b) => a[0] - b[0]).map(([d, list]) => `<div class="list round"><div class="round-h"><span class="t">Runde ${d + 1}</span></div>${list.map((x) => planLine(t, Object.assign({}, x, { court: x.court != null && !x.w ? x.court : null, label: x.stage === 'group' ? 'Gr. ' + t.groups[x.group].name : '' }), { editable: true })).join('')}</div>`).join('');
      if (m.structure === 'groups' && t.koBuilt) out += bracketView(t);
      return `<section class="section">${out}</section>`;
    }
    return `<section class="section">${bracketView(t)}</section>`;
  }

  function bracketView(t) {
    const fmt = E.fmtOf(t);
    const draws = (t.draws || []);
    const third = t.matches.find((x) => x.stage === 'ko-3');
    const box = (x) => {
      if (!x) return '';
      const ln = (ids, side) => {
        const nm = Array.isArray(ids) ? E.sideName(t, ids) : ids === 'BYE' ? 'Freilos' : 'offen';
        const sc = x.score && fmt.kind !== 'winner' ? (fmt.kind === 'sets' ? x.score.sets.map((s) => s[side === 'a' ? 0 : 1]).join(' ') : x.score[side]) : '';
        return `<div class="l${x.w === side ? ' w' : ''}${Array.isArray(ids) ? '' : ' tbd'}"><span>${esc(nm)}</span><span class="sc">${esc(sc)}</span></div>`;
      };
      const ready = Array.isArray(x.a) && Array.isArray(x.b) && !x.bye;
      const tag = ready ? 'button' : 'div';
      return `<${tag} class="bm${x.court != null && !x.w ? ' live' : ''}"${ready ? ` type="button" data-act="result" data-match="${x.id}"` : ''}><div class="lab">${esc(x.label || '')}${x.court != null && !x.w ? ' · ' + esc(t.courts[x.court]) : ''}</div>${ln(x.a, 'a')}${ln(x.b, 'b')}</${tag}>`;
    };
    return draws.map((d) => {
      const cols = d.rounds.map((ids, ri) => {
        const ms = ids.map((id) => t.matches.find((x) => x.id === id));
        const title = ms[0] && ms[0].label ? ms[0].label.replace(/ \d+$/, '').replace(/^.* · /, '') : `Runde ${ri + 1}`;
        return `<div class="col"><h3>${esc(title)}</h3>${ms.map(box).join('')}${ri === d.rounds.length - 1 && d.key === 'ko' && third ? `<h3>Platz 3</h3>${box(third)}` : ''}</div>`;
      }).join('');
      return `<div class="section"><div class="section-h"><h2>${esc(d.title || 'Hauptrunde')}</h2></div><div class="bracket">${cols}</div></div>`;
    }).join('') || '<p class="foot">Der Turnierbaum entsteht nach der Gruppenphase.</p>';
  }

  /* ---------- Ergebnis-Eingabe ---------- */
  function openScore(t, matchId) {
    const f = E.findMatch(t, matchId);
    if (!f) return;
    const m = f.m;
    const ce = E.canEdit(t, matchId);
    if (!ce.ok) { toast(ce.reason); return; }
    if (!Array.isArray(m.a) || !Array.isArray(m.b)) { toast('Die Gegner stehen noch nicht fest.'); return; }
    const fmt = E.fmtOf(t);
    const allowDraw = E.allowDraw(t, m);
    const nameA = E.sideName(t, m.a), nameB = E.sideName(t, m.b);
    const st = {
      a: m.score && m.score.a != null ? m.score.a : null,
      b: m.score && m.score.b != null ? m.score.b : null,
      w: m.score && m.score.w ? m.score.w : null,
      sets: m.score && m.score.sets ? m.score.sets.map((s) => s.slice()) : [[null, null]],
      active: 'a', set: 0
    };
    if (fmt.kind === 'sets' && st.sets.length && st.sets[0][0] != null) { st.set = -1; }
    const maxFor = (setIdx) => {
      if (fmt.kind === 'points') return fmt.total || (fmt.target ? fmt.target + 6 : 40);
      if (fmt.kind === 'games') return fmt.target ? fmt.target + 3 : 15;
      if (fmt.kind === 'sets') {
        if (fmt.pointSets) return 21;
        if (fmt.superTB && setIdx === fmt.bestOf - 1) return 20;
        return fmt.setTo + 1;
      }
      return 0;
    };
    const scoreObj = () => {
      if (fmt.kind === 'winner') return st.w ? { w: st.w } : null;
      if (fmt.kind === 'sets') {
        const sets = st.sets.filter((s) => s[0] != null && s[1] != null).map((s) => [Number(s[0]), Number(s[1])]);
        return sets.length ? { sets } : null;
      }
      if (st.a == null || st.b == null) return null;
      return { a: Number(st.a), b: Number(st.b) };
    };
    const grid = (sel, max) => `<div class="numgrid">${Array.from({ length: max + 1 }, (_, i) => `<button type="button" data-n="${i}" aria-pressed="${sel === i}">${i}</button>`).join('')}</div>`;
    const body = () => {
      let h = '';
      if (fmt.kind === 'winner') {
        h = `<p class="foot">Wer hat gewonnen?</p><div class="winpick"><button type="button" data-w="a" aria-pressed="${st.w === 'a'}">${esc(nameA)}</button><button type="button" data-w="b" aria-pressed="${st.w === 'b'}">${esc(nameB)}</button></div>`;
      } else if (fmt.kind === 'sets') {
        const need = Math.ceil(fmt.bestOf / 2);
        let wa = 0, wb = 0;
        st.sets.forEach((s) => { if (s[0] != null && s[1] != null) { if (s[0] > s[1]) wa++; else if (s[1] > s[0]) wb++; } });
        const rows = st.sets.map((s, i) => {
          const isTB = fmt.superTB && i === fmt.bestOf - 1;
          const lbl = fmt.pointSets ? `Spiel ${i + 1}` : isTB ? 'Match-TB' : `Satz ${i + 1}`;
          return `<div class="setrow"><span class="lbl">${lbl}</span><button type="button" class="v num" data-set="${i}" data-side="0" aria-pressed="${st.set === i && st.active === 'a'}">${s[0] == null ? '–' : s[0]}</button><span class="colon muted">:</span><button type="button" class="v num" data-set="${i}" data-side="1" aria-pressed="${st.set === i && st.active === 'b'}">${s[1] == null ? '–' : s[1]}</button>${i > 0 ? `<button type="button" class="iconbtn" data-delset="${i}" aria-label="Satz entfernen">${icon('close', 'sm')}</button>` : '<span></span>'}</div>`;
        }).join('');
        const canAdd = st.sets.length < fmt.bestOf && wa < need && wb < need;
        const cur = st.set >= 0 ? st.sets[st.set] : null;
        h = `<div class="score-head" style="grid-template-columns:1fr 1fr"><div class="score-side"><span class="tn">${esc(nameA)}</span><span class="v num" style="font-size:36px">${wa}</span></div><div class="score-side"><span class="tn">${esc(nameB)}</span><span class="v num" style="font-size:36px">${wb}</span></div></div>
          <div class="sets">${rows}</div>${canAdd ? `<button class="btn tonal" type="button" data-addset>${icon('plus', 'sm')}${fmt.pointSets ? 'Spiel' : 'Satz'} hinzufügen</button>` : ''}
          ${cur ? `<p class="foot">${st.active === 'a' ? esc(nameA) : esc(nameB)} – ${fmt.pointSets ? 'Punkte' : 'Spiele'} in ${fmt.superTB && st.set === fmt.bestOf - 1 ? 'Match-Tiebreak' : (fmt.pointSets ? 'Spiel ' : 'Satz ') + (st.set + 1)}</p>${grid(cur[st.active === 'a' ? 0 : 1], maxFor(st.set))}` : ''}`;
      } else {
        const fixed = fmt.kind === 'points' && fmt.total;
        const unit = fmt.kind === 'games' ? 'Spiele' : 'Punkte';
        h = `<div class="score-head"><button type="button" class="score-side" data-pick="a" aria-pressed="${st.active === 'a'}"><span class="tn">${esc(nameA)}</span><span class="v num">${st.a == null ? '–' : st.a}</span></button><span class="colon">:</span><button type="button" class="score-side" data-pick="b" aria-pressed="${st.active === 'b'}"><span class="tn">${esc(nameB)}</span><span class="v num">${st.b == null ? '–' : st.b}</span></button></div>
          <p class="foot">${fixed ? `Punkte für ${esc(st.active === 'a' ? nameA : nameB)} antippen. Die Gegenseite ergibt sich aus ${fmt.total}.` : `${unit} für ${esc(st.active === 'a' ? nameA : nameB)} antippen.`}</p>
          ${grid(st[st.active], maxFor())}`;
      }
      const sc = scoreObj();
      const chk = sc ? E.checkScore(fmt, sc, allowDraw) : null;
      if (chk && chk.error && (fmt.kind !== 'sets' || st.sets.every((s) => s[0] != null && s[1] != null))) h += `<p class="note err">${esc(chk.error)}</p>`;
      else if (chk && chk.warn) h += `<p class="note warn">${esc(chk.warn)}</p>`;
      return h;
    };
    const canSave = () => { const sc = scoreObj(); return !!sc && !E.checkScore(fmt, sc, allowDraw).error; };
    const foot = `${m.score ? `<button class="btn danger" type="button" data-clear>${icon('trash', 'sm')}Löschen</button>` : ''}<button class="btn filled big" type="button" data-save>Speichern</button>`;
    const title = f.round ? `${t.courts[m.court]}` : (m.label || 'Ergebnis');
    const o = sheet({ title, body: body(), foot, doneLabel: 'Sichern' });
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
      if (b.dataset.save !== undefined || b.dataset.sheet === 'done') return save();
      if (b.dataset.clear !== undefined) {
        closeLayer(o).then(() => mutate(t, 'Ergebnis gelöscht', () => E.clearResult(t, m.id)));
        return;
      }
      if (b.dataset.w) { st.w = b.dataset.w; refresh(); haptic(); return; }
      if (b.dataset.pick) { st.active = b.dataset.pick; refresh(); return; }
      if (b.dataset.addset !== undefined) { st.sets.push([null, null]); st.set = st.sets.length - 1; st.active = 'a'; refresh(); return; }
      if (b.dataset.delset) { st.sets.splice(Number(b.dataset.delset), 1); st.set = Math.min(st.set, st.sets.length - 1); refresh(); return; }
      if (b.dataset.set) { st.set = Number(b.dataset.set); st.active = b.dataset.side === '0' ? 'a' : 'b'; refresh(); return; }
      if (b.dataset.n !== undefined) {
        const n = Number(b.dataset.n);
        haptic(5);
        if (fmt.kind === 'sets') {
          const s = st.sets[st.set];
          s[st.active === 'a' ? 0 : 1] = n;
          if (st.active === 'a' && s[1] == null) st.active = 'b';
          else if (s[0] != null && s[1] != null) {
            const need = Math.ceil(fmt.bestOf / 2);
            let wa = 0, wb = 0;
            st.sets.forEach((x) => { if (x[0] != null && x[1] != null) { if (x[0] > x[1]) wa++; else if (x[1] > x[0]) wb++; } });
            if (wa < need && wb < need && st.sets.length < fmt.bestOf && st.set === st.sets.length - 1 && s[0] !== s[1]) { st.sets.push([null, null]); st.set = st.sets.length - 1; st.active = 'a'; }
            else if (wa >= need || wb >= need) st.set = -1;
          }
        } else if (fmt.kind === 'points' && fmt.total) {
          st[st.active] = n;
          st[st.active === 'a' ? 'b' : 'a'] = fmt.total - n;
        } else {
          st[st.active] = n;
          if (st.active === 'a' && st.b == null) st.active = 'b';
          else if (st.active === 'b' && st.a == null) st.active = 'a';
        }
        refresh();
      }
    });
    refresh();
  }

  /* ---------- Turnier-Aktionen ---------- */
  function roundSpeech(t) {
    const m = E.MODES[t.mode];
    const parts = [];
    const join = (ids) => ids.map((id) => E.nameOf(t, id)).join(' und ');
    if (m.engine === 'rotation' || m.engine === 'ladder') {
      const r = t.rounds[t.cur];
      parts.push(`Runde ${t.cur + 1}.`);
      r.matches.forEach((x) => parts.push(`${t.courts[x.court]}: ${join(x.a)} gegen ${join(x.b)}.`));
      if (r.byes.length) parts.push(`${m.engine === 'ladder' ? 'Es warten' : 'Pause haben'}: ${r.byes.map((id) => E.nameOf(t, id)).join(', ')}.`);
    } else {
      E.liveMatches(t).forEach((x) => parts.push(`${t.courts[x.court]}: ${join(x.a)} gegen ${join(x.b)}.`));
      if (m.engine === 'queue' && t.queue.waiting.length) parts.push(`Bereit machen: ${E.nameOf(t, t.queue.waiting[0])}.`);
    }
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
    saveQuiet();
  }
  function timerPause(t) {
    const T = t.timer;
    if (!T.endsAt) return;
    T.left = Math.round((T.endsAt - Date.now()) / 1000);
    T.endsAt = null;
    saveQuiet();
  }
  function remaining(t) {
    const T = t.timer;
    if (!T || !T.dur) return null;
    if (T.endsAt) return (T.endsAt - Date.now()) / 1000;
    if (T.left != null) return T.left;
    return T.dur;
  }

  async function tournamentMenu(anchor, t) {
    const m = E.MODES[t.mode];
    const items = [
      { label: 'Teilnehmende', icon: 'people', fn: () => openRoster(t) },
      { label: 'Umbenennen', icon: 'edit', fn: async () => {
        const n = await promptDialog('Turnier umbenennen', t.name);
        if (n && n.trim()) mutate(t, 'Umbenannt', () => { t.name = n.trim(); return { ok: true }; });
      } },
      { label: 'Runde teilen', icon: 'share', fn: () => shareOut(E.shareText(t, 'round'), t.name) },
      { label: 'Stand teilen', icon: 'list', fn: () => shareOut(E.shareText(t, 'table'), t.name) },
      { label: 'Regeln dieses Modus', icon: 'info', fn: () => openModeInfo(t.mode, t.sport) }
    ];
    if ((m.engine === 'rotation' || m.engine === 'ladder') && t.status === 'running') items.push({ label: 'Zusatzrunde anhängen', icon: 'plus', fn: () => mutate(t, 'Zusatzrunde', () => E.addRound(t)) });
    items.push('-');
    if (t.status === 'running') items.push({ label: 'Turnier beenden', icon: 'flag', fn: async () => {
      if (await confirmDialog('Turnier beenden?', 'Die aktuelle Tabelle wird zum Endstand. Du kannst danach weiterhin Rückgängig nutzen.', 'Beenden')) mutate(t, 'Beendet', () => { E.finish(t); return { ok: true }; });
    } });
    else if (m.engine === 'queue' || m.engine === 'rally') items.push({ label: 'Fortsetzen', icon: 'play', fn: () => mutate(t, 'Fortgesetzt', () => { E.reopen(t); return { ok: true }; }) });
    items.push({ label: 'Löschen', icon: 'trash', danger: true, fn: async () => {
      if (!(await confirmDialog('Turnier löschen?', `„${t.name}“ wird von diesem Gerät entfernt.`, 'Löschen', true))) return;
      Store.data.tournaments = Store.data.tournaments.filter((x) => x.id !== t.id);
      undoStacks.delete(t.id);
      Store.save();
      uiBack();
      toast('Gelöscht');
    } });
    menu(anchor, items);
  }

  function openRoster(t) {
    const m = E.MODES[t.mode];
    const editable = E.rosterEditable(t);
    const html = () => {
      const rows = t.entrants.map((e) => `<div class="cell"><span class="body"><span class="t1">${esc(e.name)}${m.mixed ? ` <span class="badge">${e.group}</span>` : ''}</span>${e.active === false ? '<span class="t2">zieht zurück</span>' : ''}</span>
        <button class="iconbtn" type="button" data-ren="${e.id}" aria-label="${esc(e.name)} umbenennen">${icon('edit', 'sm')}</button>
        ${editable ? `<input type="checkbox" class="switch" data-act-on="${e.id}" aria-label="${esc(e.name)} spielt mit" ${e.active !== false ? 'checked' : ''}>` : ''}</div>`).join('');
      const add = editable ? `<div class="addrow"><input class="input" id="ro-add" placeholder="Name hinzufügen" autocomplete="off" enterkeyhint="done">${m.mixed ? `<div class="seg" style="flex:none"><button type="button" data-g="A" aria-pressed="true">A</button><button type="button" data-g="B" aria-pressed="false">B</button></div>` : ''}<button class="iconbtn tint" type="button" data-add aria-label="Hinzufügen">${icon('plus')}</button></div>` : '';
      const note = editable
        ? (m.engine === 'rotation' ? 'Änderungen gelten ab der nächsten Runde, die noch nicht begonnen hat. Die App lost diese neu aus.' : 'Neue stellen sich hinten an. Wer zurückzieht, wird nicht mehr aufgerufen.')
        : 'In diesem Modus kannst du nur Namen ändern. Die Auslosung bleibt bestehen.';
      return `<div class="list">${rows}</div>${add}<p class="foot">${note}</p>`;
    };
    const o = sheet({ title: 'Teilnehmende', body: html(), cancelLabel: 'Fertig' });
    const sb = o.el.querySelector('.sheet-b');
    let group = 'A';
    const doAdd = () => {
      const inp = sb.querySelector('#ro-add');
      const v = inp.value.trim();
      if (!v) return;
      const r = mutate(getT(t.id), 'Hinzugefügt', (tt) => E.addEntrant(tt, v, m.mixed ? group : null));
      if (r.ok) { t = getT(t.id); sb.innerHTML = html(); sb.querySelector('#ro-add').focus(); }
    };
    sb.addEventListener('click', async (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.ren) {
        const e = E.ent(t, b.dataset.ren);
        const n = await promptDialog('Name ändern', e.name);
        if (n != null) { mutate(getT(t.id), 'Umbenannt', (tt) => E.rename(tt, e.id, n)); t = getT(t.id); sb.innerHTML = html(); }
      } else if (b.dataset.add !== undefined) doAdd();
      else if (b.dataset.g) { group = b.dataset.g; sb.querySelectorAll('[data-g]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.g === group))); }
    });
    sb.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.id === 'ro-add') doAdd(); });
    sb.addEventListener('change', (ev) => {
      const id = ev.target.dataset.actOn;
      if (!id) return;
      const r = mutate(getT(t.id), ev.target.checked ? 'Wieder dabei' : 'Zieht zurück', (tt) => E.setActive(tt, id, ev.target.checked));
      t = getT(t.id);
      if (!r.ok) ev.target.checked = !ev.target.checked;
      sb.innerHTML = html();
    });
  }

  /* ---------- Modi ---------- */
  function modeCell(id, sport, act = 'open-mode') {
    const c = C.modes[id];
    const best = c.best.includes(sport);
    return `<button class="cell tappable" type="button" data-act="${act}" data-id="${id}" data-sport="${sport}"><span class="lead">${icon(c.icon)}</span>
      <span class="body"><span class="t1">${esc(c.name)}${best ? ' <span class="badge tint">beliebt</span>' : ''}</span><span class="t2">${esc(c.tag)}</span></span>${icon('chev', 'sm chev')}</button>`;
  }
  function sportSeg(cur, act) {
    return `<div class="seg" role="tablist">${Object.values(E.SPORTS).map((s) => `<button type="button" data-act="${act}" data-sport="${s.id}" aria-pressed="${s.id === cur}">${s.name}</button>`).join('')}</div>`;
  }
  function viewModes() {
    const sport = nav.modeSport || S().sport || 'padel';
    const rules = C.sports[sport].rules.map(([h, p]) => `<div class="cell"><span class="body"><span class="t1" style="font-weight:600">${esc(h)}</span><span class="t2">${esc(p)}</span></span></div>`).join('');
    const body = `${sportSeg(sport, 'modes-sport')}
      <section class="section"><div class="section-h"><h2>Turniermodi</h2></div><div class="list icons">${MODE_ORDER[sport].map((id) => modeCell(id, sport)).join('')}</div>
      <p class="foot">„beliebt“ markiert, was in ${esc(E.SPORTS[sport].name)} am häufigsten gespielt wird.</p></section>
      <section class="section"><div class="section-h"><h2>Regeln & Zählweise</h2></div><div class="list">${rules}</div><p class="foot">Stand 2026 (FIP, USA Pickleball, ITF, Tennis Australia). Im Club gelten oft eigene Absprachen.</p></section>`;
    return { title: 'Modi', large: true, body };
  }
  function modeDetail(id, sport, { inSheet = false } = {}) {
    const c = C.modes[id];
    return `<div class="mode-hero">${sportMark(sport)}<div><h1>${esc(c.name)}</h1>${c.aka ? `<p class="muted">Auch: ${esc(c.aka)}</p>` : ''}</div></div>
      <p class="prose" style="font-size:var(--fs-body)">${esc(c.about)}</p>
      <dl class="facts" style="margin:0"><div><dt>Für</dt><dd>${esc(c.who)}</dd></div><div><dt>Dauer</dt><dd>${esc(c.time)}</dd></div></dl>
      <section class="section"><div class="section-h"><h2>So läuft’s</h2></div><div class="card"><ol class="steps">${c.steps.map((s) => `<li><span>${esc(s)}</span></li>`).join('')}</ol></div></section>
      <section class="section"><div class="section-h"><h2>Wertung</h2></div><div class="card"><p>${esc(c.scoring)}</p></div></section>
      ${c.tips && c.tips.length ? `<section class="section"><div class="section-h"><h2>Tipps</h2></div><div class="card"><ul class="bullets">${c.tips.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div></section>` : ''}
      ${inSheet ? '' : `<button class="btn filled big block" type="button" data-act="new-with" data-id="${id}" data-sport="${sport}">${icon('plus')}Mit diesem Modus starten</button>`}`;
  }
  function viewMode(id, sport) {
    return { title: C.modes[id].name, large: false, body: modeDetail(id, sport) };
  }
  function openModeInfo(id, sport, onPick) {
    const o = sheet({
      title: C.modes[id].name, body: modeDetail(id, sport, { inSheet: true }), cancelLabel: 'Schließen',
      foot: onPick ? `<button class="btn filled big" type="button" data-pick>Diesen Modus wählen</button>` : ''
    });
    const b = o.el.querySelector('[data-pick]');
    if (b) b.addEventListener('click', () => closeLayer(o).then(onPick));
  }

  /* ---------- Teilen ---------- */
  let installEvent = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; if (!route() && nav.tab === 'teilen') render(); });
  const standalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  const embedded = () => { try { return window.self !== window.top; } catch (e) { return true; } };
  function appUrl() {
    const own = (S().shareUrl || '').trim();
    if (own) return own;
    if (!embedded() && /^https?:$/.test(location.protocol) && !/^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname)) return location.href.split('#')[0];
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
    const isIOS = PLATFORM === 'ios';
    const qr = url
      ? `<div class="qr">${svg || '<p class="qr-empty">QR-Code konnte nicht erzeugt werden. Den Link kannst du trotzdem kopieren.</p>'}</div><p class="url">${esc(url)}</p>
         <div class="row" style="justify-content:center"><button class="btn filled" type="button" data-act="copy-link">${icon('copy', 'sm')}Link kopieren</button>${navigator.share ? `<button class="btn tonal" type="button" data-act="share-link">${icon('share', 'sm')}Teilen</button>` : ''}</div>`
      : `<div class="qr"><p class="qr-empty">Trag unten die öffentliche Adresse der App ein. Dann erscheint hier der QR-Code.</p></div>`;
    const steps = isIOS
      ? ['In Safari öffnen.', `Unten auf ${icon('share', 'sm')} Teilen tippen.`, '„Zum Home-Bildschirm“ wählen.', 'Courtside startet danach wie eine App, auch ohne Netz.']
      : ['In Chrome öffnen.', `Oben rechts ${icon('more', 'sm')} antippen.`, '„App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen.', 'Courtside startet danach wie eine App, auch ohne Netz.'];
    const body = `<section class="card qr-card">${qr}<p class="foot" style="padding:0">Mitspielende scannen den Code und haben die App sofort auf dem Handy. Turniere bleiben auf dem Gerät, auf dem sie angelegt wurden.</p></section>
      <section class="section"><div class="section-h"><h2>Adresse der App</h2></div><div class="field"><input class="input" id="share-url" type="url" inputmode="url" placeholder="https://…" value="${esc(S().shareUrl || '')}" data-on="share-url" autocomplete="off"><p class="foot">${embedded() ? 'Diese Ansicht läuft eingebettet. Trag die Adresse ein, unter der du die App veröffentlicht hast.' : 'Leer lassen, dann gilt die aktuelle Adresse.'}</p></div></section>
      <section class="section"><div class="section-h"><h2>Als App installieren</h2></div>
        ${standalone() ? '<div class="banner">' + icon('check', 'sm') + '<span>Läuft bereits als installierte App.</span></div>' : `<div class="card"><ol class="steps">${steps.map((s) => `<li><span>${s}</span></li>`).join('')}</ol>${installEvent ? `<button class="btn filled" type="button" data-act="install">${icon('install', 'sm')}Jetzt installieren</button>` : ''}</div>`}</section>
      <section class="section"><div class="section-h"><h2>Ergebnisse weitergeben</h2></div><div class="card"><p>Im Turnier über ${icon('more', 'sm')} „Runde teilen“ oder „Stand teilen“. Der Text passt in jeden Gruppenchat.</p></div></section>`;
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
      </div><p class="foot">Damit der Bildschirm im Turnier nicht ausgeht, hält die App ihn wach, solange ein laufendes Turnier offen ist.</p></section>
      <section class="section"><div class="section-h"><h2>Standard-Sportart</h2></div>${sportSeg(s.sport, 'default-sport')}</section>
      <section class="section"><div class="section-h"><h2>Daten</h2></div><div class="list">
        <button class="cell tappable" type="button" data-act="backup-copy"><span class="body"><span class="t1">Sicherung kopieren</span><span class="t2">Alle Turniere als Text, z. B. für ein anderes Gerät</span></span>${icon('copy', 'sm chev')}</button>
        <button class="cell tappable" type="button" data-act="backup-paste"><span class="body"><span class="t1">Sicherung einfügen</span><span class="t2">Turniere aus einer Sicherung übernehmen</span></span>${icon('install', 'sm chev')}</button>
        <button class="cell tappable" type="button" data-act="demo"><span class="body"><span class="t1">Beispiel-Turnier anlegen</span></span>${icon('plus', 'sm chev')}</button>
        <button class="cell tappable" type="button" data-act="wipe"><span class="body"><span class="t1" style="color:var(--danger)">Alle Turniere löschen</span></span></button>
      </div><p class="foot">Alles bleibt auf diesem Gerät. Die App braucht kein Konto und funktioniert nach dem ersten Laden auch offline.</p></section>
      <p class="foot" style="text-align:center">Courtside ${VERSION}</p>`;
    return { title: 'Einstellungen', large: true, body };
  }

  /* ---------- Neues Turnier ---------- */
  function modeDefaults(mode) {
    const m = E.MODES[mode];
    const o = {};
    if (m.engine === 'rotation') { o.byePoints = 'avg'; o.roundMinutes = 0; if (m.pairing === 'dynamic') { o.scheme = '14'; o.firstRound = 'random'; } }
    if (m.engine === 'ladder') { o.roundMinutes = 12; o.swap = false; o.ranking = 'position'; o.seeding = 'order'; }
    if (m.engine === 'queue') { o.maxStreak = 2; o.timeCap = 0; }
    if (m.engine === 'rally') { o.target = 11; }
    if (m.engine === 'pool') { o.seeding = 'order'; o.timeCap = 0; }
    if (m.structure === 'ko') { o.third = true; o.consolation = false; }
    if (m.structure === 'groups') { o.groups = 2; o.advance = 2; o.third = false; }
    return o;
  }

  function openWizard(preset = {}) {
    const sport = preset.sport || S().sport || 'padel';
    const W = {
      sport, discipline: 'doubles', mode: preset.mode || 'americano', entrants: [], courts: 2,
      format: null, rules: {}, options: {}, name: '', nameTouched: false, rounds: null, showAll: false, group: 'A'
    };
    const setMode = (id) => {
      W.mode = id;
      W.options = modeDefaults(id);
      W.format = E.defaultFormat(id, W.sport);
      W.rounds = null;
      if (E.MODES[id].engine === 'rally' || E.MODES[id].engine === 'queue') W.courts = Math.min(W.courts, E.MODES[id].engine === 'rally' ? 1 : W.courts);
    };
    setMode(W.mode);
    if (!E.modeAvailable(W.mode, W.sport, W.discipline)) setMode('americano');
    const playerUnit = () => E.MODES[W.mode].unit === 'player' || (W.mode === 'kotc' && W.options.swap) || W.discipline === 'singles';
    const cfg = () => {
      const o = Object.assign({}, W.options);
      const m = E.MODES[W.mode];
      if ((m.engine === 'rotation' && m.pairing !== 'circle') || m.engine === 'ladder') o.rounds = W.rounds || E.defaultRounds({ mode: W.mode, format: W.format, entrants: W.entrants, options: o });
      if (m.engine === 'ladder') o.swap = !!o.swap;
      return {
        name: W.name.trim() || autoName(), sport: W.sport, discipline: W.discipline, mode: W.mode, format: W.format,
        courts: W.courts, entrants: W.entrants, rules: W.rules, options: o
      };
    };
    const autoName = () => `${E.SPORTS[W.sport].name} ${C.modes[W.mode].name} ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`;

    const secSport = () => `<section class="section"><div class="section-h"><h2>Sportart</h2></div>${sportSeg(W.sport, 'w-sport')}
      ${E.SPORTS[W.sport].singles ? `<div class="seg"><button type="button" data-act="w-disc" data-v="doubles" aria-pressed="${W.discipline === 'doubles'}">Doppel</button><button type="button" data-act="w-disc" data-v="singles" aria-pressed="${W.discipline === 'singles'}">Einzel</button></div>` : ''}</section>`;
    const secMode = () => {
      const all = MODE_ORDER[W.sport].filter((id) => E.modeAvailable(id, W.sport, W.discipline) && !(W.discipline === 'singles' && E.MODES[id].doublesOnly));
      const shown = W.showAll ? all : all.slice(0, 5);
      if (!shown.includes(W.mode)) shown.push(W.mode);
      const cell = (id) => {
        const c = C.modes[id];
        return `<div class="cell check" role="radio" aria-checked="${id === W.mode}" style="padding-right:8px"><button type="button" class="body" data-act="w-mode" data-id="${id}" style="text-align:left;display:flex;flex-direction:column;gap:2px;min-height:44px;justify-content:center">
          <span class="t1">${esc(c.name)}${c.best.includes(W.sport) ? ' <span class="badge tint">beliebt</span>' : ''}</span><span class="t2">${esc(c.tag)}</span></button>
          <button type="button" class="iconbtn" data-act="w-info" data-id="${id}" aria-label="${esc(c.name)} erklärt">${icon('info', 'sm')}</button>${icon('check', 'tick')}<span class="radio" aria-hidden="true"></span></div>`;
      };
      return `<section class="section"><div class="section-h"><h2>Modus</h2>${all.length > 5 ? `<button class="btn-text" type="button" data-act="w-all">${W.showAll ? 'Weniger' : `Alle ${all.length}`}</button>` : ''}</div><div class="list" role="radiogroup">${shown.map(cell).join('')}</div></section>`;
    };
    const secEnts = () => {
      const m = E.MODES[W.mode];
      const unit = playerUnit() ? 'Personen' : 'Teams';
      const teamHint = !playerUnit() && W.discipline === 'doubles' ? 'Ein Eintrag ist ein Team, z. B. „Anna / Ben“.' : '';
      const seedHint = m.engine === 'pool' && m.structure !== 'rr' ? 'Die Reihenfolge ist die Setzliste.' : m.engine === 'ladder' ? 'Die Reihenfolge bestimmt die Startplätze: oben beginnt auf Platz 1.' : m.engine === 'queue' || m.engine === 'rally' ? 'Die Reihenfolge ist die Warteschlange.' : '';
      const rows = W.entrants.map((e, i) => `<div class="cell ent-row"><span class="nr">${i + 1}</span><span class="nm">${esc(e.name)}</span>
        ${m.mixed ? `<span class="grp"><button type="button" data-act="w-grp" data-i="${i}" data-g="A" aria-pressed="${e.group === 'A'}">A</button><button type="button" data-act="w-grp" data-i="${i}" data-g="B" aria-pressed="${e.group === 'B'}">B</button></span>` : ''}
        <button type="button" class="iconbtn" data-act="w-del" data-i="${i}" aria-label="${esc(e.name)} entfernen">${icon('close', 'sm')}</button></div>`).join('');
      const mixCount = m.mixed ? ` · A: ${W.entrants.filter((e) => e.group === 'A').length}, B: ${W.entrants.filter((e) => e.group === 'B').length}` : '';
      return `<section class="section" id="w-ents"><div class="section-h"><h2>${unit} (${W.entrants.length})${mixCount}</h2></div>
        <div class="addrow"><input class="input" id="w-add" placeholder="${playerUnit() ? 'Name' : 'Teamname'} eingeben" autocomplete="off" autocapitalize="words" enterkeyhint="next">
        ${m.mixed ? `<div class="seg" style="flex:none"><button type="button" data-act="w-addgrp" data-g="A" aria-pressed="${W.group === 'A'}">A</button><button type="button" data-act="w-addgrp" data-g="B" aria-pressed="${W.group === 'B'}">B</button></div>` : ''}
        <button class="iconbtn tint" type="button" data-act="w-add" aria-label="Hinzufügen">${icon('plus')}</button></div>
        <div class="chips"><button class="chip" type="button" data-act="w-paste">${icon('list', 'sm')}Liste einfügen</button><button class="chip" type="button" data-act="w-fill">${icon('people', 'sm')}Mit Platzhaltern füllen</button>
        ${!playerUnit() && W.discipline === 'doubles' ? `<button class="chip" type="button" data-act="w-pair">${icon('shuffle', 'sm')}Teams aus Spielerliste losen</button>` : ''}
        ${W.entrants.length > 1 ? `<button class="chip" type="button" data-act="w-shuffle">${icon('shuffle', 'sm')}Mischen</button>` : ''}</div>
        ${W.entrants.length ? `<div class="list">${rows}</div>` : ''}
        ${teamHint || seedHint ? `<p class="foot">${esc([teamHint, seedHint].filter(Boolean).join(' '))}</p>` : ''}</section>`;
    };
    const stepperRow = (label, sub, key, value, min, max, step = 1) => `<div class="cell"><span class="body"><span class="t1">${esc(label)}</span>${sub ? `<span class="t2">${esc(sub)}</span>` : ''}</span>
      <span class="stepper"><button type="button" data-act="w-step" data-k="${key}" data-d="${-step}" data-min="${min}" data-max="${max}" aria-label="${esc(label)} weniger">${icon('minus', 'sm')}</button><output class="num">${value}</output><button type="button" data-act="w-step" data-k="${key}" data-d="${step}" data-min="${min}" data-max="${max}" aria-label="${esc(label)} mehr">${icon('plus', 'sm')}</button></span></div>`;
    const switchRow = (label, sub, key, on) => `<label class="cell"><span class="body"><span class="t1">${esc(label)}</span>${sub ? `<span class="t2">${esc(sub)}</span>` : ''}</span><input type="checkbox" class="switch" data-w-opt="${key}" ${on ? 'checked' : ''}></label>`;
    const segRow = (label, key, opts) => `<div class="cell" style="flex-wrap:wrap"><span class="body" style="flex-basis:100%"><span class="t1">${esc(label)}</span></span><div class="seg" style="flex:1">${opts.map(([v, l]) => `<button type="button" data-act="w-opt" data-k="${key}" data-v="${v}" aria-pressed="${String(W.options[key]) === String(v)}">${esc(l)}</button>`).join('')}</div></div>`;
    const secCourts = () => {
      const m = E.MODES[W.mode];
      if (m.engine === 'rally') return '';
      const per = m.engine === 'rotation' && m.unit === 'player' ? 4 : (W.mode === 'kotc' && W.options.swap ? 4 : 2);
      const usable = Math.floor(W.entrants.length / per);
      const sub = W.entrants.length && usable < W.courts && m.engine !== 'pool' && m.engine !== 'queue' ? `Genutzt werden ${Math.max(usable, 0)} – es fehlen Teilnehmende für mehr.` : (m.engine === 'ladder' ? 'Platz 1 ist der Königsplatz.' : '');
      return `<section class="section"><div class="list">${stepperRow('Plätze', sub, 'courts', W.courts, 1, 16)}</div></section>`;
    };
    const secFormat = () => {
      const list = E.formatsFor(W.mode, W.sport);
      if (!list.length) return '';
      const fmt = E.FORMATS[W.format];
      const serve = E.MODES[W.mode].engine === 'rotation' ? E.serveHint(fmt) : '';
      return `<section class="section"><div class="section-h"><h2>Zählweise</h2></div><div class="chips">${list.map((k) => `<button class="chip" type="button" data-act="w-format" data-v="${k}" aria-pressed="${k === W.format}">${esc(E.FORMATS[k].short)}</button>`).join('')}</div>
        <p class="foot">${esc(fmt ? fmt.name : '')}${fmt && fmt.timed ? '. Gespielt wird auf Zeit, eingetragen wird der Stand beim Abpfiff.' : ''}${serve ? ' ' + esc(serve) : ''}</p></section>`;
    };
    const secOpts = () => {
      const m = E.MODES[W.mode];
      const o = W.options;
      const rows = [];
      const fmt = E.FORMATS[W.format] || E.FORMATS.win;
      const rDefault = E.defaultRounds({ mode: W.mode, format: W.format, entrants: W.entrants, options: o });
      if ((m.engine === 'rotation' && m.pairing !== 'circle') || m.engine === 'ladder') {
        const n = W.entrants.length;
        const full = m.pairing === 'fixed' && !m.mixed && n >= 4 ? `Bei ${n} Personen spielt mit ${n - 1} Runden jede Person einmal mit jeder anderen.` : '';
        rows.push(stepperRow('Runden', full, 'rounds', W.rounds || rDefault || 6, 1, 40));
      }
      if (m.engine === 'ladder' || (m.engine === 'rotation' && (fmt.timed || o.roundMinutes > 0))) rows.push(stepperRow('Minuten pro Runde', m.engine === 'ladder' ? 'Gilt für alle Plätze gleichzeitig' : 'Timer mit Signal kurz vor Schluss', 'roundMinutes', o.roundMinutes || (fmt.timed ? 12 : 0), m.engine === 'ladder' ? 3 : 0, 60));
      else if (m.engine === 'rotation') rows.push(stepperRow('Zeitlimit pro Runde', o.roundMinutes ? '' : 'Aus – gespielt wird bis zur Punktzahl', 'roundMinutes', o.roundMinutes || 0, 0, 60));
      if (m.engine === 'rotation' && m.pairing === 'dynamic' && m.unit === 'player') {
        rows.push(segRow('Paarung auf jedem Platz', 'scheme', [['14', '1+4 gegen 2+3'], ['13', '1+3 gegen 2+4']]));
        rows.push(segRow('Erste Runde', 'firstRound', [['random', 'Zufall'], ['order', 'Reihenfolge']]));
      }
      if (m.engine === 'rotation') rows.push(switchRow('Pausen ausgleichen', 'Wer aussetzt, bekommt den eigenen Punkteschnitt', 'byePoints', o.byePoints !== 'none'));
      if (m.engine === 'ladder') {
        rows.push(switchRow('Partner wechseln', 'Teams werden nach jeder Runde neu gemischt (Einzelwertung)', 'swap', !!o.swap));
        rows.push(segRow('Wertung', 'ranking', [['position', 'Position'], ['points', 'Punkte je Platz']]));
        rows.push(segRow('Startaufstellung', 'seeding', [['order', 'Reihenfolge'], ['random', 'Zufall']]));
      }
      if (m.engine === 'queue') {
        rows.push(stepperRow('Max. Siege in Folge', o.maxStreak ? 'Danach gehen beide Teams raus' : 'Unbegrenzt', 'maxStreak', o.maxStreak || 0, 0, 9));
        rows.push(stepperRow('Zeitlimit pro Spiel (min)', o.timeCap ? 'Signal bei Ablauf' : 'Aus', 'timeCap', o.timeCap || 0, 0, 60));
      }
      if (m.engine === 'rally') rows.push(stepperRow('Zielpunkte', 'Wer zuerst so viele Punkte hat, gewinnt', 'target', o.target || 11, 3, 30));
      if (m.engine === 'pool') {
        if (m.structure === 'groups') {
          rows.push(stepperRow('Gruppen', '', 'groups', o.groups || 2, 1, 8));
          rows.push(stepperRow('Weiter pro Gruppe', '', 'advance', o.advance || 2, 1, 4));
        }
        if (m.structure === 'ko' || m.structure === 'groups') rows.push(switchRow('Spiel um Platz 3', '', 'third', !!o.third));
        if (m.structure === 'ko') rows.push(switchRow('Trostrunde', 'Für alle, die in Runde 1 verlieren', 'consolation', !!o.consolation));
        if (m.structure !== 'rr') rows.push(segRow('Setzliste', 'seeding', [['order', 'Reihenfolge'], ['random', 'Auslosen']]));
        rows.push(stepperRow('Zeitlimit pro Spiel (min)', o.timeCap ? 'Signal bei Ablauf' : 'Aus', 'timeCap', o.timeCap || 0, 0, 90));
      }
      return rows.length ? `<section class="section"><div class="section-h"><h2>Ablauf</h2></div><div class="list">${rows.join('')}</div></section>` : '';
    };
    const secRules = () => {
      const R = E.RULES[W.sport];
      const cur = W.rules[R.key] || R.def;
      const ro = R.options.find((x) => x.id === cur);
      return `<section class="section"><div class="section-h"><h2>${esc(R.label)}</h2></div><div class="seg">${R.options.map((x) => `<button type="button" data-act="w-rule" data-v="${x.id}" aria-pressed="${x.id === cur}">${esc(x.name)}</button>`).join('')}</div><p class="foot">${esc(ro.hint)} Nur als Hinweis für die Spielenden.</p></section>`;
    };
    const secName = () => `<section class="section"><div class="section-h"><h2>Name</h2></div><input class="input" id="w-name" value="${esc(W.name)}" placeholder="${esc(autoName())}" autocomplete="off" data-on="w-name"></section>`;
    const summary = () => {
      const c = cfg();
      const err = E.validateConfig(c);
      const est = err ? null : E.estimate(c);
      const parts = [];
      if (!err) {
        parts.push(`${c.entrants.length} ${playerUnit() ? 'Personen' : 'Teams'}`);
        if (E.MODES[W.mode].engine !== 'rally') parts.push(`${W.courts} ${W.courts === 1 ? 'Platz' : 'Plätze'}`);
        if (est && est.rounds) parts.push(`${est.rounds} Runden`);
        if (est && est.games) parts.push(`${est.games} Spiele`);
        if (est && est.minutes) parts.push(`ca. ${fmtMin(est.minutes)}`);
      }
      return { err, text: err || parts.join(' · ') };
    };

    const html = `<div class="scrim"></div><section class="page" role="dialog" aria-modal="true" aria-label="Neues Turnier">
      <div class="sheet-h"><div class="l">${PLATFORM === 'ios' ? '<button class="btn-text" type="button" data-act="w-close">Abbrechen</button>' : ''}</div><div class="t">Neues Turnier</div>
      <div class="r">${PLATFORM === 'ios' ? '<button class="btn-text" type="button" data-act="w-start" style="font-weight:600">Starten</button>' : '<button class="iconbtn" type="button" data-act="w-close" aria-label="Schließen">' + icon('close') + '</button>'}</div></div>
      <div class="page-b"><div class="inner" id="w-body"></div></div>
      <div class="page-f"><div class="inner"><p class="summary" id="w-sum"></p><button class="btn filled big block" type="button" data-act="w-start" id="w-go">Turnier starten</button></div></div></section>`;
    const o = openLayer(html, { dismissable: false });
    const el = o.el;
    const bodyEl = el.querySelector('#w-body');
    const renderAll = (focusAdd) => {
      const scroll = el.querySelector('.page-b').scrollTop;
      bodyEl.innerHTML = secSport() + secMode() + secEnts() + secCourts() + secFormat() + secOpts() + secRules() + secName();
      el.querySelector('.page-b').scrollTop = scroll;
      renderSum();
      if (focusAdd) { const a = el.querySelector('#w-add'); if (a) a.focus({ preventScroll: true }); }
    };
    const renderSum = () => {
      const s = summary();
      const p = el.querySelector('#w-sum');
      p.textContent = s.text;
      p.classList.toggle('err', !!s.err && W.entrants.length > 0);
      if (s.err && !W.entrants.length) p.textContent = 'Füge die Teilnehmenden hinzu.';
      el.querySelectorAll('[data-act="w-start"]').forEach((b) => { b.disabled = !!s.err; });
    };
    const addNames = (names) => {
      const m = E.MODES[W.mode];
      let added = 0, dup = 0;
      names.map((n) => n.trim()).filter(Boolean).forEach((n) => {
        if (W.entrants.some((e) => e.name.toLowerCase() === n.toLowerCase())) { dup++; return; }
        W.entrants.push({ name: n.slice(0, 60), group: m.mixed ? W.group : null });
        added++;
      });
      if (dup) toast(`${dup} ${dup === 1 ? 'Name war' : 'Namen waren'} schon in der Liste.`);
      return added;
    };
    renderAll();

    el.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && ev.target.id === 'w-add') {
        ev.preventDefault();
        const v = ev.target.value;
        if (addNames([v])) { haptic(5); renderAll(true); }
      }
    });
    el.addEventListener('input', (ev) => {
      if (ev.target.id === 'w-name') { W.name = ev.target.value; renderSum(); }
    });
    el.addEventListener('change', (ev) => {
      const k = ev.target.dataset.wOpt;
      if (!k) return;
      if (k === 'byePoints') W.options.byePoints = ev.target.checked ? 'avg' : 'none';
      else W.options[k] = ev.target.checked;
      if (k === 'swap') W.rounds = null;
      renderAll();
    });
    el.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b || !el.contains(b)) return;
      const a = b.dataset.act;
      const m = E.MODES[W.mode];
      if (a === 'w-close') {
        if (W.entrants.length && !(await confirmDialog('Verwerfen?', 'Die Eingaben gehen verloren.', 'Verwerfen', true))) return;
        closeLayer(o);
      } else if (a === 'w-sport') {
        W.sport = b.dataset.sport;
        if (!E.SPORTS[W.sport].singles) W.discipline = 'doubles';
        if (!E.modeAvailable(W.mode, W.sport, W.discipline)) setMode('americano');
        W.format = E.formatsFor(W.mode, W.sport).includes(W.format) ? W.format : E.defaultFormat(W.mode, W.sport);
        renderAll();
      } else if (a === 'w-disc') {
        W.discipline = b.dataset.v;
        if (W.discipline === 'singles' && E.MODES[W.mode].doublesOnly) setMode(W.sport === 'tennis' ? 'round_robin' : 'winner_stays');
        renderAll();
      } else if (a === 'w-mode') { setMode(b.dataset.id); renderAll(); }
      else if (a === 'w-info') openModeInfo(b.dataset.id, W.sport, () => { setMode(b.dataset.id); renderAll(); });
      else if (a === 'w-all') { W.showAll = !W.showAll; renderAll(); }
      else if (a === 'w-add') {
        const inp = el.querySelector('#w-add');
        if (addNames([inp.value])) { haptic(5); renderAll(true); } else inp.focus();
      } else if (a === 'w-addgrp') { W.group = b.dataset.g; renderAll(true); }
      else if (a === 'w-grp') { W.entrants[Number(b.dataset.i)].group = b.dataset.g; renderAll(); }
      else if (a === 'w-del') { W.entrants.splice(Number(b.dataset.i), 1); renderAll(); }
      else if (a === 'w-shuffle') {
        for (let i = W.entrants.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [W.entrants[i], W.entrants[j]] = [W.entrants[j], W.entrants[i]]; }
        renderAll();
      } else if (a === 'w-paste') {
        const txt = await promptDialog('Liste einfügen', '', { multiline: true, ok: 'Übernehmen', placeholder: 'Ein Name pro Zeile oder mit Komma getrennt', text: 'Zum Beispiel aus dem Gruppenchat kopiert.' });
        if (txt) { const n = addNames(txt.split(/[\n,;]+/).map((x) => x.replace(/^\s*(\d+[.)]|[-*•])\s*/, ''))); toast(`${n} hinzugefügt`); renderAll(); }
      } else if (a === 'w-fill') {
        const per = m.engine === 'rotation' && m.unit === 'player' ? 4 : 2;
        const base = m.mixed ? 8 : m.engine === 'rally' ? 4 : m.engine === 'queue' ? 5 : 8;
        let target = Math.max(base, W.entrants.length + 1);
        if (per === 4) target = Math.ceil(target / 4) * 4;
        const word = playerUnit() ? 'Spieler' : 'Team';
        let i = 1;
        while (W.entrants.length < target) {
          const name = `${word} ${i++}`;
          if (W.entrants.some((e) => e.name === name)) continue;
          const group = m.mixed ? (W.entrants.filter((e) => e.group === 'A').length <= W.entrants.filter((e) => e.group === 'B').length ? 'A' : 'B') : null;
          W.entrants.push({ name, group });
        }
        toast('Platzhalter lassen sich später im Turnier umbenennen.');
        renderAll();
      } else if (a === 'w-pair') {
        if (W.entrants.length < 2) { toast('Erst die Spielerliste eintragen.'); return; }
        const names = W.entrants.map((e) => e.name);
        for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
        const teams = [];
        for (let i = 0; i + 1 < names.length; i += 2) teams.push({ name: `${names[i]} / ${names[i + 1]}`, group: null });
        if (names.length % 2) toast(`${names[names.length - 1]} hat noch kein Team.`);
        W.entrants = teams.concat(names.length % 2 ? [{ name: names[names.length - 1], group: null }] : []);
        renderAll();
      } else if (a === 'w-step') {
        const k = b.dataset.k, d = Number(b.dataset.d), min = Number(b.dataset.min), max = Number(b.dataset.max);
        if (k === 'courts') W.courts = Math.max(min, Math.min(max, W.courts + d));
        else if (k === 'rounds') {
          const cur = W.rounds || E.defaultRounds({ mode: W.mode, format: W.format, entrants: W.entrants, options: W.options }) || 6;
          W.rounds = Math.max(min, Math.min(max, cur + d));
        } else {
          const fmt = E.FORMATS[W.format] || {};
          const cur = Number(W.options[k]) || (k === 'roundMinutes' && fmt.timed ? 12 : 0);
          let nextVal = cur + d;
          // Minuten: von „aus“ direkt auf 10 springen, unter 3 wieder auf „aus“.
          if ((k === 'roundMinutes' || k === 'timeCap') && min === 0) {
            if (cur === 0 && d > 0) nextVal = 10;
            else if (nextVal < 3) nextVal = 0;
          }
          W.options[k] = Math.max(min, Math.min(max, nextVal));
        }
        haptic(4);
        renderAll();
      } else if (a === 'w-opt') {
        W.options[b.dataset.k] = b.dataset.v;
        renderAll();
      } else if (a === 'w-format') {
        W.format = b.dataset.v;
        const fmt = E.FORMATS[W.format];
        if (fmt.timed && !W.options.roundMinutes) W.options.roundMinutes = 12;
        if (!fmt.timed && E.MODES[W.mode].engine === 'rotation') W.options.roundMinutes = 0;
        W.rounds = null;
        renderAll();
      } else if (a === 'w-rule') {
        W.rules[E.RULES[W.sport].key] = b.dataset.v;
        renderAll();
      } else if (a === 'w-start') {
        const c = cfg();
        const err = E.validateConfig(c);
        if (err) { toast(err); return; }
        let t;
        try { t = E.create(c); } catch (e) { toast(e.message); return; }
        Store.data.tournaments.unshift(t);
        S().sport = W.sport;
        Store.save();
        haptic([10, 40, 10]);
        await closeLayer(o);
        nav.tab = 'turniere';
        nav.stack = [];
        go({ name: 't', id: t.id, seg: 'now' });
      }
    });
  }

  /* ---------- Beispiel ---------- */
  function createDemo() {
    const names = ['Anna', 'Ben', 'Carla', 'David', 'Elif', 'Finn', 'Greta', 'Hannes'];
    const t = E.create({
      name: 'Padel Americano Donnerstag', sport: 'padel', discipline: 'doubles', mode: 'americano', format: 'p24', courts: 2,
      entrants: names.map((name) => ({ name })), rules: { deuce: 'golden' }, options: { rounds: 7, byePoints: 'avg' }, demo: true
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

  /* ---------- Taktgeber: Timer, Spielzeiten ---------- */
  const capAlerted = new Set();
  function tick() {
    const now = Date.now();
    Store.data.tournaments.forEach((t) => {
      if (t.status !== 'running' || !t.timer || !t.timer.endsAt) return;
      const left = (t.timer.endsAt - now) / 1000;
      if (left <= 60 && !t.timer.warned) {
        t.timer.warned = true;
        saveQuiet();
        Sound.warn(); haptic([120, 80, 120]);
        toast(`${t.name}: noch 1 Minute`);
      }
      if (left <= 0 && !t.timer.rang) {
        t.timer.rang = true;
        saveQuiet();
        Sound.end(); haptic([400, 150, 400, 150, 700]);
        showTimeUp(t);
      }
    });
    const r = route();
    if (!r || r.name !== 't') return;
    const t = getT(r.id);
    if (!t) return;
    const clockEl = document.querySelector('[data-clock]');
    if (clockEl) {
      const left = remaining(t);
      clockEl.textContent = clockText(left);
      clockEl.classList.toggle('warn', left <= 60 && left > 0);
      clockEl.classList.toggle('over', left <= 0 && !!t.timer.endsAt);
      const bar = document.querySelector('[data-bar]');
      if (bar) bar.style.width = Math.max(0, Math.min(100, (left / t.timer.dur) * 100)) + '%';
    }
    document.querySelectorAll('[data-since]').forEach((el) => {
      const since = Date.parse(el.dataset.since);
      if (!since) return;
      const cap = Number(el.dataset.cap) * 60;
      const el2 = el.querySelector('.num');
      const sec = (now - since) / 1000;
      if (cap > 0) {
        const left = cap - sec;
        el2.textContent = clockText(left);
        el.style.color = left <= 0 ? 'var(--danger)' : left <= 60 ? 'var(--warn-text)' : '';
        if (left <= 0 && !capAlerted.has(el.dataset.mid)) {
          capAlerted.add(el.dataset.mid);
          Sound.end(); haptic([300, 100, 300]);
          toast(`Zeit um: ${el.closest('.match').querySelector('.name').textContent}`);
        }
      } else el2.textContent = clockText(sec).replace('+', '');
    });
  }
  setInterval(tick, 250);

  function showTimeUp(t) {
    const r = route();
    if (!r || r.id !== t.id) { toast(`${t.name}: Zeit ist um!`); return; }
    const el = document.createElement('button');
    el.className = 'timeup';
    el.type = 'button';
    el.innerHTML = `<span><strong>Zeit!</strong><p>Ballwechsel zu Ende spielen.<br>Bei Gleichstand entscheidet der nächste Punkt.</p><p style="font-size:15px;margin-top:24px;opacity:.8">Tippen zum Schließen</p></span>`;
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
    demo: () => { const t = createDemo(); nav.tab = 'turniere'; nav.stack = []; go({ name: 't', id: t.id, seg: 'now' }); },
    seg: (b) => { const r = route(); r.seg = b.dataset.seg; render(); window.scrollTo(0, 0); },
    undo: () => { const t = curT(); if (t) undo(t); },
    't-more': (b) => { const t = curT(); if (t) tournamentMenu(b, t); },
    result: (b) => { const t = curT(); if (t) openScore(t, b.dataset.match); },
    win: (b) => {
      const t = curT();
      if (!t) return;
      const side = b.dataset.side;
      const f = E.findMatch(t, b.dataset.match);
      const res = mutate(t, 'Sieger', () => E.setResult(t, b.dataset.match, { w: side }));
      if (res.ok && f) toast(`Sieg: ${E.sideName(t, side === 'a' ? f.m.a : f.m.b)}`, { label: 'Rückgängig', fn: () => undo(getT(t.id)) });
    },
    rally: (b) => { const t = curT(); if (t) mutate(t, 'Ballwechsel', () => { E.rallyPoint(t, b.dataset.who); return { ok: true }; }); },
    next: (b) => {
      const t = curT();
      if (!t) return;
      const id = b.dataset.id;
      if (id === 'start') {
        if (E.roundTimed(t)) timerStart(t); else { E.startRound(t); saveQuiet(); }
        haptic([10, 30, 10]);
        render();
      } else if (id === 'result') openScore(t, b.dataset.match);
      else if (id === 'advance') {
        const res = mutate(t, 'Nächste Runde', () => E.advance(t));
        if (res.ok) window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (id === 'addRound') mutate(t, 'Zusatzrunde', () => { const r = E.addRound(t); if (E.MODES[t.mode].engine !== 'pool' && t.rounds[t.cur].matches.every((x) => x.w)) E.advance(t); return r; });
      else if (id === 'buildKO') mutate(t, 'K.-o.-Runde', () => E.buildKOFromGroups(t));
      else if (id === 'podium') { const r = route(); r.seg = 'table'; render(); }
    },
    'timer-toggle': () => { const t = curT(); if (!t) return; if (t.timer.endsAt) timerPause(t); else timerStart(t); haptic(); render(); },
    'timer-plus': () => {
      const t = curT(); if (!t) return;
      if (t.timer.endsAt) t.timer.endsAt += 60000; else t.timer.left = (t.timer.left != null ? t.timer.left : t.timer.dur) + 60;
      if (remaining(t) > 60) { t.timer.warned = false; t.timer.rang = false; }
      saveQuiet(); tick();
    },
    'timer-reset': async () => {
      const t = curT(); if (!t) return;
      if (t.timer.endsAt && !(await confirmDialog('Timer zurücksetzen?', 'Die Zeit dieser Runde beginnt von vorn.', 'Zurücksetzen'))) return;
      t.timer.endsAt = null; t.timer.left = null; t.timer.warned = false; t.timer.rang = false;
      saveQuiet(); render();
    },
    speak: () => { const t = curT(); if (t) speak(roundSpeech(t)); },
    'share-table': () => { const t = curT(); if (t) shareOut(E.shareText(t, 'table'), t.name); },
    'copy-link': () => copyText(appUrl(), 'Link kopiert'),
    'share-link': () => { if (navigator.share) navigator.share({ title: 'Courtside', text: 'Turnier-App für Padel, Pickleball und Tennis', url: appUrl() }).catch(() => {}); },
    install: async () => { if (!installEvent) return; installEvent.prompt(); try { await installEvent.userChoice; } catch (e) { /* abgebrochen */ } installEvent = null; render(); },
    design: (b) => { S().design = b.dataset.v; Store.save(); render(); },
    'default-sport': (b) => { S().sport = b.dataset.sport; Store.save(); render(); },
    'backup-copy': () => copyText(JSON.stringify({ app: 'courtside', v: 1, tournaments: Store.data.tournaments }), 'Sicherung kopiert'),
    'backup-paste': async () => {
      const txt = await promptDialog('Sicherung einfügen', '', { multiline: true, ok: 'Übernehmen', placeholder: 'Kopierten Sicherungstext hier einfügen' });
      if (!txt) return;
      try {
        const d = JSON.parse(txt);
        const list = (Array.isArray(d) ? d : d.tournaments || []).filter((t) => t && t.id && E.MODES[t.mode] && Array.isArray(t.entrants));
        if (!list.length) throw new Error('leer');
        list.forEach(replaceT);
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
    }
  };

  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]');
    if (!b || b.closest('.layer')) return;
    const fn = A[b.dataset.act];
    if (fn) { ev.preventDefault(); fn(b, ev); }
  });
  document.addEventListener('change', (ev) => {
    const on = ev.target.dataset && ev.target.dataset.on;
    if (!on || ev.target.closest('.layer')) return;
    if (on === 'set-sound') { S().sound = ev.target.checked; if (ev.target.checked) { Sound.unlock(); Sound.beep(880, 0.15); } }
    else if (on === 'set-vibrate') { S().vibrate = ev.target.checked; haptic(20); }
    else if (on === 'share-url') {
      const v = ev.target.value.trim();
      if (v && !/^https?:\/\/\S+$/i.test(v)) { toast('Bitte eine vollständige Adresse mit https:// eingeben.'); return; }
      S().shareUrl = v; Store.save(); render(); return;
    } else if (on === 'plan-me') { const r = route(); r.me = ev.target.value; render(); return; }
    Store.save();
  });
  document.addEventListener('pointerdown', () => Sound.unlock(), { passive: true });
  window.addEventListener('storage', (ev) => {
    if (ev.key !== KEY || overlays.length) return;
    Store.load();
    render();
  });

  /* ---------- Start ---------- */
  Store.load();
  if (!Store.data.seeded) {
    Store.data.seeded = true;
    if (!Store.data.tournaments.length) createDemo(); else Store.save();
  }
  try { history.replaceState({ cs: 'root' }, ''); } catch (e) { histOK = false; }
  render();
  if ('serviceWorker' in navigator && !embedded() && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline-Modus nicht verfügbar */ });
  }
})();
