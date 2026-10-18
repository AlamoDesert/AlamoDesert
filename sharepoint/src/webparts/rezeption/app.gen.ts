/* eslint-disable */
// @ts-nocheck
// GENERIERT von tools/build.mjs aus app/app.js und app/app.css – nicht direkt bearbeiten.
export const APP_CSS: string = "/* Wird in einen Shadow-Root geladen (eigenständig und in SharePoint). :host = Wurzel.\n   Layout: Querformat = ein Bildschirm ohne Seiten-Scroll (Kopfzeile + Spalten, die nur intern scrollen).\n   Hochformat/Handy = normale Seite. Ansichten: Übersicht, Früh, Spät (Phasen als Spalten), Monat, Plan (Editor). */\n[hidden] { display: none !important }\n:host {\n  --bg: #eef2f6; --surface: #ffffff; --surface-2: #f6f8fb; --ink: #142130; --muted: #5a6879; --line: #d7dee7;\n  --accent: #1d5bb8; --accent-soft: #e2ecfa; --done: #23804f; --done-soft: #e1f2e8;\n  --warn: #c0392b; --warn-soft: #fbe6e3; --na: #8a96a5; --now: #b8700a; --now-soft: #fdf1dc;\n  --f-display: \"Barlow Condensed\", \"Arial Narrow\", system-ui, sans-serif;\n  --f-body: \"Barlow\", system-ui, -apple-system, \"Segoe UI\", sans-serif;\n  --r: 10px;\n}\n@media (prefers-color-scheme: dark) { :host(:not([data-theme=\"light\"])) {\n  --bg: #0f1620; --surface: #17212d; --surface-2: #1c2836; --ink: #e6edf5; --muted: #95a3b4; --line: #2b3a4b;\n  --accent: #6aa2f2; --accent-soft: #1d3150; --done: #4cc184; --done-soft: #173627;\n  --warn: #f07a6c; --warn-soft: #3d1f1c; --na: #6d7a8a; --now: #f0b04f; --now-soft: #3a2c14; color-scheme: dark } }\n:host([data-theme=\"dark\"]) {\n  --bg: #0f1620; --surface: #17212d; --surface-2: #1c2836; --ink: #e6edf5; --muted: #95a3b4; --line: #2b3a4b;\n  --accent: #6aa2f2; --accent-soft: #1d3150; --done: #4cc184; --done-soft: #173627;\n  --warn: #f07a6c; --warn-soft: #3d1f1c; --na: #6d7a8a; --now: #f0b04f; --now-soft: #3a2c14; color-scheme: dark }\n\n* { box-sizing: border-box }\n:host { display: block; background: var(--bg); color: var(--ink); font-family: var(--f-body); font-size: 15px; line-height: 1.35; -webkit-text-size-adjust: 100% }\n.rz-root { min-height: 100% }\nbutton, input, select, textarea { font: inherit; color: inherit }\nbutton { cursor: pointer }\nbutton:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible, [role=\"button\"]:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }\n.wrap { padding-inline: 16px; padding-block: 0 24px; max-width: 1100px; margin: 0 auto }\nh2, h3 { text-wrap: balance }\n\n/* Kopfzeile */\nheader.top { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--bg); padding-block: 10px 8px; border-bottom: 1px solid var(--line); display: flex; align-items: center; gap: 10px 14px; flex-wrap: wrap }\n.brand { font-family: var(--f-display); font-weight: 700; font-size: 20px; letter-spacing: .02em; text-transform: uppercase; margin: 0; line-height: 1.05 }\n.brand small { display: block; font-family: var(--f-body); font-weight: 500; font-size: 12px; letter-spacing: .02em; color: var(--muted); text-transform: none }\n.clock { font-family: var(--f-display); font-weight: 700; font-size: 34px; line-height: 1; font-variant-numeric: tabular-nums }\n.clock small { font-family: var(--f-body); font-size: 13px; font-weight: 500; color: var(--muted); margin-left: 6px }\n.tabs { display: flex; gap: 4px; overflow-x: auto; max-width: 100% }\n.tab { border: 1px solid var(--line); background: var(--surface); border-radius: 8px; padding: 6px 11px; display: inline-flex; gap: 7px; align-items: baseline; white-space: nowrap }\n.tab b { font-family: var(--f-display); font-size: 16px; letter-spacing: .03em; text-transform: uppercase }\n.tab .meta { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums }\n.tab[aria-selected=\"true\"] { border-color: var(--accent); background: var(--accent-soft) }\n.tab[aria-selected=\"true\"] b { color: var(--accent) }\n.datenav { display: flex; align-items: center; gap: 4px; margin-left: auto }\n.iconbtn { border: 1px solid var(--line); background: var(--surface); border-radius: 8px; width: 34px; height: 34px; font-size: 18px; line-height: 1 }\n.datebtn { border: 1px solid var(--line); background: var(--surface); border-radius: 8px; height: 34px; padding: 0 10px; font-weight: 600; font-variant-numeric: tabular-nums; position: relative; overflow: hidden; display: inline-flex; align-items: center; gap: 6px }\n.datebtn input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100% }\n.datebtn .src { font-size: 11px; font-weight: 600; color: var(--now) }\n.todaybtn { border: 0; background: none; color: var(--accent); font-weight: 600; padding: 0 4px; height: 34px }\n.status { font-size: 12px; color: var(--muted); width: 100% }\n.status.err { color: var(--warn) }\n\n/* Karten */\n.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r); min-width: 0; overflow: hidden; display: flex; flex-direction: column }\n.chead { display: flex; align-items: baseline; gap: 8px; padding: 9px 12px 7px; border-bottom: 1px solid var(--line); background: var(--surface-2); flex-wrap: wrap; flex: none }\n.chead h2 { margin: 0; font-family: var(--f-display); font-size: 17px; letter-spacing: .04em; text-transform: uppercase; flex: 1; min-width: 0 }\n.chead .hint { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums }\n.cbody { min-height: 0 }\n.pill { font-size: 11px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; padding: 2px 8px; border-radius: 99px; background: var(--accent-soft); color: var(--accent); white-space: nowrap }\n.pill.now { background: var(--now-soft); color: var(--now) }\n.pill.late { background: var(--warn-soft); color: var(--warn) }\n.pill.done { background: var(--done-soft); color: var(--done) }\n.pill.later { background: var(--surface-2); color: var(--muted); box-shadow: inset 0 0 0 1px var(--line) }\n.empty { color: var(--muted); padding: 12px }\n.sublabel { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); padding: 9px 12px 3px; border-top: 1px solid var(--line); list-style: none }\n.sublabel:first-child { border-top: 0 }\n.sublabel.late { color: var(--warn) }\n.sublabel.now { color: var(--now) }\n\n/* Abhak-Zeilen */\nul.items { list-style: none; margin: 0; padding: 0 }\nul.items li { display: flex; align-items: stretch; border-top: 1px solid var(--line) }\nul.items li:first-child { border-top: 0 }\n.check { flex: 1; min-width: 0; display: flex; gap: 10px; align-items: flex-start; text-align: left; background: none; border: 0; padding: 9px 12px; min-height: 44px }\n.box { flex: none; width: 22px; height: 22px; border-radius: 6px; border: 2px solid var(--line); display: grid; place-items: center; transition: background .15s, border-color .15s }\n.box svg { width: 14px; height: 14px; opacity: 0 }\n.txt { min-width: 0 }\n.txt .label { font-weight: 500 }\n.txt .sub { display: block; font-size: 12.5px; color: var(--muted); margin-top: 1px }\n.txt .who { display: block; font-size: 12px; color: var(--done); margin-top: 2px; font-variant-numeric: tabular-nums }\n.txt .tag { font-size: 11px; font-weight: 600; color: var(--warn); margin-left: 6px; white-space: nowrap }\nli.important .label { color: var(--warn) }\nli.done .box { background: var(--done); border-color: var(--done) }\nli.done .box svg { opacity: 1 }\nli.done .label { color: var(--muted); text-decoration: line-through; text-decoration-color: var(--line) }\nli.na .box { border-style: dashed; border-color: var(--na) }\nli.na .label, li.na .who { color: var(--na) }\nli.upcoming .label { color: var(--muted) }\n.skip { flex: none; border: 0; border-left: 1px solid var(--line); background: none; color: var(--muted); font-size: 12px; font-weight: 600; padding: 0 10px }\nli.na .skip { color: var(--ink); background: var(--surface-2) }\n\n/* Daueraufgaben */\n.always { list-style: none; margin: 0; padding: 0 }\n.always li { border-top: 1px solid var(--line); display: flex; align-items: stretch }\n.always li:first-child { border-top: 0 }\n.always .tap { flex: 1; min-width: 0; display: flex; gap: 10px; align-items: flex-start; border: 0; background: none; text-align: left; padding: 8px 12px; min-height: 44px }\n.always .tap:disabled { cursor: default }\n.always .ic { flex: none; width: 24px; height: 24px; border-radius: 50%; background: var(--accent-soft); color: var(--accent); display: grid; place-items: center; transition: transform .2s }\n.always .ic svg { width: 14px; height: 14px }\n.always .tap:not(:disabled):active .ic { transform: rotate(-120deg) }\n.always .important .label { color: var(--warn) }\n.always .label { font-weight: 500 }\n.always .sub { display: block; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums }\n.always .last { display: block; font-size: 12px; color: var(--done); font-variant-numeric: tabular-nums }\n.always .cnt { flex: none; align-self: center; margin-left: auto; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--done); background: var(--done-soft); border-radius: 99px; padding: 2px 8px }\n.always .cnt.zero { color: var(--muted); background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--line) }\n.always li.due { background: var(--now-soft) }\n.always li.due .ic { background: var(--now); color: #fff }\n.always li.due .sub b { color: var(--now) }\n.always li.over { background: var(--warn-soft) }\n.always li.over .ic { background: var(--warn); color: #fff }\n.always li.over .sub b { color: var(--warn) }\n.always li.ok .ic { background: var(--done-soft); color: var(--done) }\n.always .undo { flex: none; border: 0; border-left: 1px solid var(--line); background: none; color: var(--muted); font-size: 12px; font-weight: 600; padding: 0 10px }\n\n/* Schichtplan */\n.plan { list-style: none; margin: 0; padding: 0 }\n.plan li { border-top: 1px solid var(--line) }\n.plan li:first-child { border-top: 0 }\n.plan button { width: 100%; border: 0; background: none; display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 7px 12px; text-align: left }\n.plan .t { font-variant-numeric: tabular-nums; font-weight: 600; color: var(--muted) }\n.plan .n small { color: var(--muted); font-variant-numeric: tabular-nums; margin-left: 6px }\n.plan li.cur { background: var(--now-soft) }\n.plan li.cur .t { color: var(--now) }\n.shiftsum { display: flex; align-items: center; gap: 10px; padding: 9px 12px 4px }\n.shiftsum b { font-family: var(--f-display); font-size: 16px; text-transform: uppercase; letter-spacing: .04em }\n.shiftsum span { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; margin-left: auto }\n.bar { height: 6px; background: var(--line); border-radius: 3px; overflow: hidden; margin: 0 12px 8px }\n.bar i { display: block; height: 100%; background: var(--done); transition: width .3s }\n.othersum { border-top: 1px solid var(--line); padding: 9px 12px; font-size: 13px; color: var(--muted); background: none; border-left: 0; border-right: 0; border-bottom: 0; width: 100%; text-align: left }\n.othersum b { color: var(--warn) }\n\n/* Übergabe */\n.note { padding: 9px 12px; display: grid; gap: 5px }\n.note + .note { border-top: 1px solid var(--line) }\n.note label { font-size: 12px; font-weight: 600; color: var(--muted) }\n.note textarea { width: 100%; min-height: 60px; resize: vertical; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-2); padding: 7px 9px }\n.note .read { background: var(--now-soft); border-radius: 8px; padding: 7px 9px; white-space: pre-wrap; overflow-wrap: anywhere }\n.note .read.none { background: var(--surface-2); color: var(--muted) }\n.note .saved { font-size: 11px; color: var(--muted); min-height: 14px }\n\n/* Übersicht */\n.dash { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr) minmax(0, 1fr); gap: 12px; margin-top: 12px }\n.dash > .col { display: flex; flex-direction: column; gap: 12px; min-width: 0; min-height: 0 }\n\n/* Schichtansicht: Fahrplan */\n.shiftview { display: grid; grid-template-columns: minmax(200px, 250px) minmax(0, 1fr); gap: 12px; margin-top: 12px }\n.side { display: flex; flex-direction: column; gap: 12px; min-width: 0; min-height: 0 }\n.board { min-width: 0 }\n.board-in { display: grid; gap: 8px }\n.stop { scroll-margin-top: var(--rz-head, 150px); background: var(--surface); border: 1px solid var(--line); border-radius: var(--r); overflow: hidden; break-inside: avoid; margin-bottom: 8px }\n.stop-head { display: grid; grid-template-columns: 22px auto minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 8px 12px; width: 100%; border: 0; background: none; text-align: left }\n.stop-head .mark { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 700; background: var(--surface-2); color: var(--muted); box-shadow: inset 0 0 0 1px var(--line) }\n.stop-head .time { font-family: var(--f-display); font-weight: 700; font-size: 17px; font-variant-numeric: tabular-nums; color: var(--muted); white-space: nowrap }\n.stop-head .ttl { font-family: var(--f-display); font-weight: 700; font-size: 17px; letter-spacing: .03em; text-transform: uppercase; min-width: 0 }\n.stop-head .ttl small { font-family: var(--f-body); font-weight: 500; font-size: 12px; letter-spacing: 0; text-transform: none; color: var(--muted); margin-left: 8px }\n.stop.is-done { background: transparent; border-style: dashed }\n.stop.is-done .mark { background: var(--done); color: #fff; box-shadow: none }\n.stop.is-done .ttl, .stop.is-done .time { color: var(--muted) }\n.stop.is-done .stop-head { padding-block: 5px }\n.stop.is-now { border-color: var(--now); box-shadow: 0 0 0 1px var(--now) }\n.stop.is-now .stop-head { background: var(--now-soft) }\n.stop.is-now .mark { background: var(--now); color: #fff; box-shadow: none }\n.stop.is-now .time { color: var(--now) }\n.stop.is-late { border-color: var(--warn) }\n.stop.is-late .stop-head { background: var(--warn-soft) }\n.stop.is-late .mark { background: var(--warn); color: #fff; box-shadow: none }\n.stop.is-late .time { color: var(--warn) }\n.stop .items { border-top: 1px solid var(--line) }\n.stop.is-later .check { padding-block: 5px; min-height: 34px }\n.stop.is-later .box { width: 18px; height: 18px; border-radius: 5px }\n.stop.is-later .txt .label { color: var(--muted); font-weight: 400 }\n.stop.is-later .txt .sub { display: none }\n.stop .phint { font-size: 12px; color: var(--muted); padding: 0 12px 6px 44px }\n.stop.is-now .phint { background: var(--now-soft) }\n.stop.is-late .phint { background: var(--warn-soft) }\n@media (max-width: 480px) { .stop .phint { padding-left: 44px } .stop-head { grid-template-columns: 22px 80px minmax(0, 1fr) auto; gap: 8px } }\n\n/* Monat */\n.monthhead { display: flex; align-items: center; gap: 8px; margin-top: 14px }\n.monthhead h2 { margin: 0; font-family: var(--f-display); font-size: 22px; text-transform: uppercase; letter-spacing: .03em; flex: 1 }\n.mscroll { overflow-x: auto; margin-top: 12px; border: 1px solid var(--line); border-radius: var(--r); background: var(--surface) }\ntable.mgrid { border-collapse: collapse; font-variant-numeric: tabular-nums; font-size: 13px; width: 100% }\n.mgrid th, .mgrid td { padding: 0; border-bottom: 1px solid var(--line); text-align: center }\n.mgrid thead th { font-weight: 600; color: var(--muted); padding: 8px 4px; font-size: 12px }\n.mgrid th.rowh { text-align: left; padding: 8px 12px; white-space: nowrap; font-family: var(--f-display); text-transform: uppercase; letter-spacing: .04em; font-size: 14px; position: sticky; left: 0; background: var(--surface) }\n.mgrid tr:last-child td, .mgrid tr:last-child th { border-bottom: 0 }\n.mcell { border: 0; background: none; width: 100%; min-width: 34px; height: 36px; font-size: 12px; font-weight: 600 }\n.mcell.full { background: var(--done-soft); color: var(--done) }\n.mcell.part { background: var(--now-soft); color: var(--now) }\n.mcell.none, .mcell.future { color: var(--line) }\n.mcell.sel { box-shadow: inset 0 0 0 2px var(--accent) }\n.legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: var(--muted); margin-top: 10px }\n.legend i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -2px; margin-right: 4px }\n.legend .lg-full { background: var(--done-soft); box-shadow: inset 0 0 0 1px var(--done) }\n.legend .lg-part { background: var(--now-soft); box-shadow: inset 0 0 0 1px var(--now) }\n\n/* Plan-Editor */\n.edbar { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; margin-top: 12px; padding: 10px 12px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r) }\n.edbar .info { flex: 1; min-width: 220px; font-size: 13px; color: var(--muted) }\n.edbar .info b { color: var(--ink) }\n.btn { border: 1px solid var(--line); background: var(--surface); border-radius: 8px; padding: 7px 12px; font-weight: 600; font-size: 14px; white-space: nowrap }\n.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff }\n.btn.ghost { border-color: transparent; background: none; color: var(--accent) }\n.btn.danger { color: var(--warn) }\n.btn:disabled { opacity: .5; cursor: default }\n.editor { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 12px }\n.edshift { display: grid; gap: 10px; align-content: start; min-width: 0 }\n.edshift > h2 { margin: 0; font-family: var(--f-display); font-size: 20px; text-transform: uppercase; letter-spacing: .03em; display: flex; gap: 10px; align-items: center; flex-wrap: wrap }\n.edshift > h2 label { font-family: var(--f-body); font-size: 13px; font-weight: 500; text-transform: none; letter-spacing: 0; color: var(--muted); display: inline-flex; gap: 6px; align-items: center }\n.ed-phase .chead { gap: 6px; align-items: center }\n.in { border: 1px solid var(--line); background: var(--surface-2); border-radius: 6px; padding: 5px 8px; min-width: 0 }\n.in.title { font-weight: 600; flex: 1 1 140px }\n.in.time { width: 64px; text-align: center; font-variant-numeric: tabular-nums }\n.ed-items { list-style: none; margin: 0; padding: 0 }\n.ed-items li { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 6px 8px; padding: 7px 10px; border-top: 1px solid var(--line); align-items: start }\n.ed-items li:first-child { border-top: 0 }\n.ed-items .fields { display: grid; gap: 4px; min-width: 0 }\n.ed-items .fields .in.sub { font-size: 13px }\n.ed-items .opts { display: flex; gap: 10px; flex-wrap: wrap; font-size: 12px; color: var(--muted); align-items: center }\n.ed-items .opts label { display: inline-flex; gap: 4px; align-items: center }\n.ed-items .opts select { font-size: 12px; padding: 2px 4px }\n.order { display: grid; gap: 2px }\n.mini { border: 1px solid var(--line); background: var(--surface); border-radius: 6px; width: 28px; height: 24px; font-size: 12px; line-height: 1; padding: 0 }\n.mini:disabled { opacity: .35; cursor: default }\n.mini.del { color: var(--warn) }\n.mini.del.confirm { width: auto; padding: 0 6px; background: var(--warn); color: #fff; border-color: var(--warn) }\n.addrow { border: 0; border-top: 1px dashed var(--line); background: none; color: var(--accent); font-weight: 600; font-size: 13px; padding: 8px 12px; text-align: left; width: 100% }\n\n/* Person / Dienst */\n.whobtn { border: 1px solid var(--line); background: var(--surface); border-radius: 99px; height: 34px; padding: 0 12px 0 6px; display: inline-flex; align-items: center; gap: 8px; font-weight: 600; white-space: nowrap }\n.whobtn .av { width: 24px; height: 24px; border-radius: 50%; background: var(--accent); color: #fff; display: grid; place-items: center; font-size: 11px; font-weight: 700 }\n.whobtn.none { border-color: var(--warn); color: var(--warn) }\n.whobtn.none .av { background: var(--warn) }\n.whobtn small { font-weight: 500; color: var(--muted) }\n.duty { display: flex; gap: 6px 14px; flex-wrap: wrap; font-size: 13px; color: var(--muted); padding: 8px 12px; border-top: 1px solid var(--line) }\n.duty b { color: var(--ink) }\n.chip { display: inline-flex; align-items: center; gap: 4px; border-radius: 99px; padding: 2px 9px; font-size: 13px; font-weight: 600; background: var(--accent-soft); color: var(--accent); border: 1px solid transparent; white-space: nowrap }\nbutton.chip { cursor: pointer }\nbutton.chip.off { background: var(--surface); color: var(--muted); border-color: var(--line); font-weight: 500 }\n\n/* Namensauswahl */\n.overlay { position: fixed; inset: 0; z-index: 20; background: rgba(15, 22, 32, .55); display: grid; place-items: center; padding: 16px }\n.dialog { background: var(--surface); color: var(--ink); border-radius: 14px; width: min(640px, 100%); max-height: calc(100% - 32px); overflow: auto; padding: 20px; display: grid; gap: 14px; box-shadow: 0 20px 60px rgba(0, 0, 0, .3) }\n.dialog h2 { margin: 0; font-family: var(--f-display); font-size: 26px; text-transform: uppercase; letter-spacing: .03em }\n.dialog p { margin: 0; color: var(--muted) }\n.dialog .grp { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--muted) }\n.names { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px }\n.namebtn { border: 1px solid var(--line); background: var(--surface-2); border-radius: 10px; padding: 14px 12px; font-size: 17px; font-weight: 600; text-align: left; display: flex; gap: 10px; align-items: center }\n.namebtn .av { flex: none; width: 30px; height: 30px; border-radius: 50%; background: var(--accent-soft); color: var(--accent); display: grid; place-items: center; font-size: 12px; font-weight: 700 }\n.namebtn.sched { border-color: var(--accent); background: var(--accent-soft) }\n.namebtn.sched .av { background: var(--accent); color: #fff }\n.dialog .row { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end }\n\n/* Dienstplan */\n.roster { overflow-x: auto; margin-top: 12px; border: 1px solid var(--line); border-radius: var(--r); background: var(--surface) }\n.roster table { border-collapse: collapse; width: 100%; min-width: 760px }\n.roster th, .roster td { border-bottom: 1px solid var(--line); border-left: 1px solid var(--line); padding: 8px; vertical-align: top; text-align: left }\n.roster tr:last-child td, .roster tr:last-child th { border-bottom: 0 }\n.roster thead th { font-size: 13px; color: var(--muted); font-weight: 600; font-variant-numeric: tabular-nums }\n.roster thead th.today { color: var(--accent); background: var(--accent-soft) }\n.roster th.rowh { border-left: 0; font-family: var(--f-display); text-transform: uppercase; letter-spacing: .04em; font-size: 15px; white-space: nowrap; width: 90px }\n.roster td .cell { display: flex; flex-wrap: wrap; gap: 4px }\n.roster td .empty { padding: 0; font-size: 12px }\n\n/* Schicht-Ansicht */\n.schicht { display: grid; grid-template-columns: minmax(380px, 1fr) 12px minmax(280px, var(--side, 460px)); gap: 0; margin-top: 12px }\n.splitter { cursor: col-resize; position: relative; touch-action: none; outline: none }\n.splitter::after { content: \"\"; position: absolute; top: 0; bottom: 0; left: 5px; width: 2px; border-radius: 2px; background: var(--line); transition: background .15s }\n.splitter:hover::after, .splitter:focus-visible::after { background: var(--accent); width: 4px; left: 4px }\n.schicht.cols-1 .board-in { columns: 1 !important }\n.schicht.cols-2 .board-in { columns: 2 !important; column-gap: 12px }\n.boardcard .chead .seg + .seg { margin-left: 6px }\n.schicht .side { display: flex; flex-direction: column; gap: 12px; min-width: 0; min-height: 0 }\n.boardcard .chead { align-items: center }\n.boardcard .board { padding: 10px }\n.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; margin-left: auto }\n.segbtn { border: 0; background: var(--surface); padding: 5px 12px; font-weight: 600; font-size: 13px; color: var(--muted) }\n.segbtn + .segbtn { border-left: 1px solid var(--line) }\n.segbtn.on { background: var(--accent); color: #fff }\n.bar.flat { margin: 0; border-radius: 0; height: 4px; flex: none }\n.boardcard .othersum { border-top: 0; border-bottom: 1px solid var(--line); flex: none; background: var(--warn-soft) }\n.boardcard .othersum b { color: var(--warn) }\n\n/* Immer im Blick: Pflicht + Hinweise */\n.always li.confirm.open { background: var(--warn-soft) }\n.always li.confirm.open .label { font-weight: 600 }\n.always li.confirm .box { flex: none; width: 24px; height: 24px; border-radius: 6px; border: 2px solid var(--warn); display: grid; place-items: center; background: var(--surface) }\n.always li.confirm .box svg { width: 15px; height: 15px; opacity: 0 }\n.always li.confirm.ok .box { background: var(--done); border-color: var(--done) }\n.always li.confirm.ok .box svg { opacity: 1 }\n.always li.confirm.ok .label { color: var(--muted) }\n.always li.confirm .sub { color: var(--warn) }\nul.hints { list-style: none; margin: 0; padding: 4px 12px 10px; display: grid; gap: 4px }\nul.hints li { font-size: 14px; padding-left: 14px; position: relative }\nul.hints li::before { content: \"\"; position: absolute; left: 2px; top: .55em; width: 5px; height: 5px; border-radius: 50%; background: var(--muted) }\nul.hints li.important { color: var(--warn) }\nul.hints .sub { font-size: 12px; color: var(--muted) }\n\n/* Dienstplan-Kalender */\n.rcal { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; margin-top: 10px }\n.rcal .rh { font-size: 12px; font-weight: 600; color: var(--muted); text-align: center; padding: 2px 0 }\n.rcal .rc { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 5px 7px; min-height: 78px; min-width: 0; text-align: left; display: flex; flex-direction: column; gap: 2px; font-size: 12.5px; overflow: hidden }\n.rcal button.rc { cursor: pointer; font: inherit; font-size: 12.5px; color: inherit }\n.rcal button.rc:hover { border-color: var(--accent) }\n.rcal .rc.blank { background: none; border: 0 }\n.rcal .rc.we { background: var(--surface-2) }\n.rcal .rc.today { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent) }\n.rcal .rc.today .rd { color: var(--accent) }\n.rcal .rd { font-weight: 700; font-variant-numeric: tabular-nums }\n.rcal .rl { display: flex; gap: 5px; min-width: 0 }\n.rcal .rl b { flex: none; color: var(--muted); font-weight: 600; width: 10px }\n.rcal .rl span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }\n.rcal .rl span.gap { color: var(--warn) }\n.rcal .rl em { font-style: normal; color: var(--now); font-size: 11.5px }\n.overlay.inmain .dialog .cell { display: flex; flex-wrap: wrap; gap: 6px }\n.remlist { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px }\n.remlist li { display: flex; align-items: center; gap: 10px; justify-content: space-between; padding: 10px 12px; border: 1px solid var(--warn); border-radius: 10px; background: var(--warn-soft); font-weight: 600 }\n.dialog p.pwarn { color: var(--warn) }\n\n/* Ein-/Auschecken + Zeiten */\n.outbtn { height: 34px; padding: 0 12px; border-color: var(--warn); color: var(--warn); background: var(--surface) }\n.namebtn.inn { border-color: var(--done); background: var(--done-soft) }\n.namebtn.inn .av { background: var(--done); color: #fff }\n.trow { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center }\n.trow label { display: inline-flex; gap: 8px; align-items: center; font-weight: 600 }\n.trow.big { font-size: 17px }\n.trow select { font-size: 16px; padding: 6px 8px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-2) }\n.trow.big select { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums }\n.tsel { display: inline-flex; gap: 4px; align-items: center }\n.tsel .mini { width: 34px; height: 34px; font-size: 18px }\n.quick { display: inline-flex; gap: 6px; flex-wrap: wrap }\n.quick .chip { font-size: 14px; padding: 6px 12px }\n.stale { border: 1px solid var(--warn); background: var(--warn-soft); border-radius: 10px; padding: 10px 12px; display: grid; gap: 8px; font-size: 14px }\n.times { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 12px; margin-top: 12px; align-items: start }\n.times .card .cbody { overflow: auto }\n.tscroll { max-height: calc(100vh - 240px) }\n.ttab { border-collapse: collapse; width: 100%; font-size: 14px; font-variant-numeric: tabular-nums }\n.ttab th, .ttab td { padding: 7px 10px; border-bottom: 1px solid var(--line); text-align: left; white-space: nowrap }\n.ttab thead th { position: sticky; top: 0; background: var(--surface-2); color: var(--muted); font-size: 12px; font-weight: 600 }\n.ttab td.num { font-weight: 700 }\n.ttab td.muted, .muted { color: var(--muted) }\n.ttab tr.openrow td { background: var(--now-soft) }\n.ttab .mini.edit { width: 28px }\n.tpick { margin-top: 12px; max-width: 760px }\n.tpick .cbody { padding: 12px }\n.monthhead select { font-size: 14px; padding: 6px 8px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface) }\n\n.tnote { display: grid; gap: 4px; font-size: 13px; font-weight: 600; color: var(--muted) }\n.tnote .in { font-size: 15px; padding: 8px 10px; font-weight: 400; color: var(--ink) }\n.ttab td.tnotecell { max-width: 260px; overflow: hidden; text-overflow: ellipsis; color: var(--muted) }\n\n/* Arbeitsplan-Import */\n.roster .rtime { font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; margin-bottom: 4px }\n.chip small { font-weight: 500; opacity: .8 }\n.namebtn small.ninfo { display: block; font-size: 12px; font-weight: 500; color: var(--now) }\n.imp { margin-top: 12px }\n.imp .cbody { padding: 12px; display: grid; gap: 10px }\n.imp p { margin: 0; font-size: 13px; color: var(--muted) }\n.imp p.err { color: var(--warn); font-size: 14px }\n.imp .row { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap }\n.impform { display: flex; gap: 10px 16px; flex-wrap: wrap; align-items: center; font-size: 13px }\n.impform label { display: inline-flex; gap: 6px; align-items: center }\n.impform select { font-size: 14px; padding: 4px 6px }\n.impscroll { max-height: 260px; overflow: auto; border: 1px solid var(--line); border-radius: 8px }\n.imptab { border-collapse: collapse; width: 100%; font-size: 13px; font-variant-numeric: tabular-nums }\n.imptab th, .imptab td { padding: 4px 8px; border-bottom: 1px solid var(--line); text-align: left; white-space: nowrap }\n.imptab thead th { position: sticky; top: 0; background: var(--surface-2); color: var(--muted) }\n.imptab td { color: var(--muted) }\n.imptab td.on { color: var(--done); font-weight: 600 }\n.imptab td small { margin-left: 6px; color: var(--now); font-weight: 500 }\n.imptab td .t { margin-left: 8px; color: var(--muted); font-weight: 400 }\n.imptab td.gap { color: var(--warn) }\n.imp p.new { color: var(--ink) }\n.roster .rnote { font-size: 11px; color: var(--now); margin-top: 4px }\n.dialog p.pnote { color: var(--now) }\n\n/* Verwaltung */\n.check-inline { display: flex; gap: 8px; align-items: center; font-size: 14px }\n.admin { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; margin-top: 12px; align-items: start }\n.admin .card .cbody { padding: 12px; display: grid; gap: 10px }\n.admin p { margin: 0; font-size: 13px; color: var(--muted) }\n.people { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px }\n.people li { display: flex; gap: 6px; align-items: center }\n.people .in { flex: 1 }\n.pinform { max-width: 360px; margin: 40px auto 0; display: grid; gap: 10px; text-align: center }\n.pinform h2 { margin: 0; font-family: var(--f-display); font-size: 24px; text-transform: uppercase }\n.pinform .in { font-size: 22px; text-align: center; letter-spacing: .3em; padding: 10px }\n.pinform p { margin: 0; color: var(--muted); font-size: 13px }\n\n/* Querformat: alles auf einen Bildschirm */\n@media (orientation: landscape) and (min-width: 900px) {\n  :host { height: var(--rz-h, 100dvh) }\n  .rz-root { height: 100% }\n  .wrap { max-width: none; height: 100%; display: flex; flex-direction: column; padding-block: 0 12px }\n  header.top { position: static }\n  .status { width: auto; max-width: 220px; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }\n  main { flex: 1; min-height: 0; display: flex; flex-direction: column }\n  main.scroll { overflow: auto }\n  .dash, .shiftview, .schicht { flex: 1; min-height: 0; grid-template-rows: minmax(0, 1fr) }\n  .schicht .side > .card { min-height: 0 }\n  .schicht .side > .card.grow { flex: 1 }\n  .boardcard { min-height: 0 }\n  .dash > .col > .card, .side > .card { min-height: 0 }\n  .dash > .col > .card.grow, .side > .card.grow { flex: 1 }\n  .card .cbody { overflow-y: auto; flex: 1 }\n  .board { min-height: 0; overflow-y: auto }\n  .board-in { display: block; columns: 2 320px; column-gap: 12px }\n}\n@media (orientation: portrait), (max-width: 899px) {\n  .dash { grid-template-columns: minmax(0, 1fr) }\n  .shiftview, .schicht { grid-template-columns: minmax(0, 1fr); gap: 12px }\n  .splitter { display: none }\n  .times { grid-template-columns: minmax(0, 1fr) }\n  .rcal { gap: 2px } .rcal .rc { min-height: 64px; padding: 3px 4px; font-size: 11px }\n  .clock { font-size: 28px }\n}\n@media (max-width: 760px) { .editor { grid-template-columns: minmax(0, 1fr) } .datenav { margin-left: 0 } }\n@media (prefers-reduced-motion: reduce) { * { transition: none !important } }\n";
const MARKUP = "<div class=\"wrap\">\n  <header class=\"top\">\n    <h1 class=\"brand\">Rezeption<small id=\"weekday\">–</small></h1>\n    <div class=\"clock\" id=\"clock\">--:--</div>\n    <button class=\"whobtn none\" id=\"whoBtn\" aria-label=\"Person wechseln\"><span class=\"av\" id=\"whoAv\">?</span><span id=\"whoName\">Name wählen</span></button>\n    <button class=\"btn outbtn\" id=\"outBtn\" hidden>Auschecken</button>\n    <div class=\"tabs\" role=\"tablist\">\n      <button class=\"tab\" role=\"tab\" data-view=\"schicht\"><b>Schicht</b><span class=\"meta\" id=\"meta-shift\"></span></button>\n      <button class=\"tab\" role=\"tab\" data-view=\"dienst\"><b>Dienstplan</b></button>\n      <button class=\"tab\" role=\"tab\" data-view=\"zeiten\"><b>Zeiten</b></button>\n      <button class=\"tab\" role=\"tab\" data-view=\"admin\"><b>Verwaltung</b></button>\n    </div>\n    <div class=\"datenav\">\n      <button class=\"iconbtn\" id=\"prev\" aria-label=\"Vorheriger Tag\">‹</button>\n      <label class=\"datebtn\"><span id=\"datelabel\">–</span><span class=\"src\" id=\"datesrc\"></span><input type=\"date\" id=\"datepick\" aria-label=\"Datum wählen\"></label>\n      <button class=\"iconbtn\" id=\"next\" aria-label=\"Nächster Tag\">›</button>\n      <button class=\"todaybtn\" id=\"today\">Heute</button>\n    </div>\n    <div class=\"status\" id=\"status\">Verbinde…</div>\n  </header>\n  <main id=\"main\"></main>\n</div>\n<div id=\"picker\" hidden></div><div id=\"remind\" hidden></div>";

/* Rezeption Schichtcheck – App-Kern.
   Wird von tools/build.mjs in index.html (eigenständig) und in das SharePoint-Webpart (app.gen.ts) eingebaut.
   mount(container, opts) rendert die App in `container` (liegt in einem Shadow-Root) und gibt eine Aufräumfunktion zurück.
   opts.mode: "auto" (claude.ai-Datenbank falls vorhanden, sonst Browser-Speicher) | "local" | "sharepoint". */

// ---------- SharePoint-Speicher ----------
// Jedes Dokument ist eine JSON-Datei in einer Dokumentbibliothek (Versionsverlauf = Sicherung).
// Bietet dieselbe Schnittstelle wie die claude.ai-Datenbank, soweit die App sie nutzt:
// doc(path).get/set/update/onSnapshot und collection("days").where("month", "==", ym).onSnapshot.
// Änderungen anderer Geräte kommen per Abfrage alle POLL_MS an.
export function createSpDb(opts) {
  const POLL_MS = opts.pollMs || 15000;
  const web = String(opts.webAbsoluteUrl || "").replace(/\/$/, "");
  const webRel = String(opts.webServerRelativeUrl || "/").replace(/\/$/, "");
  const title = opts.library || "RezeptionDaten";
  let libUrl = null;                 // server-relativ, z. B. /sites/team/RezeptionDaten
  let digest = null, digestUntil = 0;
  const knownFolders = new Set();

  const q = (v) => encodeURIComponent(String(v).replace(/'/g, "''"));
  class SpError extends Error { constructor(code, message, status) { super(message); this.code = code; this.status = status; } }
  async function http(url, init = {}) {
    let res;
    try { res = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init }); }
    catch { throw new SpError("unavailable", "Keine Verbindung zu SharePoint"); }
    if (res.status === 401 || res.status === 403) throw new SpError("not_granted", "Keine Berechtigung in SharePoint", res.status);
    return res;
  }
  async function getDigest() {
    if (digest && Date.now() < digestUntil) return digest;
    const res = await http(`${web}/_api/contextinfo`, { method: "POST", headers: { Accept: "application/json;odata=nometadata" } });
    if (!res.ok) throw new SpError("unavailable", `contextinfo ${res.status}`, res.status);
    const j = await res.json();
    digest = j.FormDigestValue;
    digestUntil = Date.now() + Math.max(60, (j.FormDigestTimeoutSeconds || 1800) - 120) * 1000;
    return digest;
  }
  async function post(url, body, headers = {}) {
    const d = await getDigest();
    return http(url, { method: "POST", body, headers: { Accept: "application/json;odata=nometadata", "X-RequestDigest": d, ...headers } });
  }
  // Bibliothek finden oder anlegen (BaseTemplate 101 = Dokumentbibliothek).
  async function ensureLibrary() {
    if (libUrl) return libUrl;
    const url = `${web}/_api/web/lists/GetByTitle('${q(title)}')?$select=Id&$expand=RootFolder`;
    let res = await http(url, { headers: { Accept: "application/json;odata=nometadata" } });
    if (res.status === 404) {
      const c = await post(`${web}/_api/web/lists`, JSON.stringify({ __metadata: { type: "SP.List" }, BaseTemplate: 101, Title: title, Description: "Daten der Rezeptions-Checkliste (nicht manuell bearbeiten)" }),
        { Accept: "application/json;odata=verbose", "Content-Type": "application/json;odata=verbose" });
      if (!c.ok) throw new SpError("unavailable", `Bibliothek „${title}“ konnte nicht angelegt werden (${c.status})`, c.status);
      res = await http(url, { headers: { Accept: "application/json;odata=nometadata" } });
    }
    if (!res.ok) throw new SpError("unavailable", `Bibliothek „${title}“ nicht lesbar (${res.status})`, res.status);
    const j = await res.json();
    libUrl = (j.RootFolder && j.RootFolder.ServerRelativeUrl) || `${webRel}/${title}`;
    return libUrl;
  }
  // Pfad → Ordner + Dateiname. Tage liegen in Monatsordnern: days/2026-10/2026-10-14.json
  function locate(path) {
    const parts = path.split("/");
    const name = parts.pop() + ".json";
    if (parts[0] === "days" && parts.length === 1 && /^\d{4}-\d{2}-\d{2}/.test(name)) parts.push(name.slice(0, 7));
    return { dir: parts, name };
  }
  async function ensureFolder(dirParts) {
    const lib = await ensureLibrary();
    let cur = lib;
    for (const p of dirParts) {
      cur += "/" + p;
      if (knownFolders.has(cur)) continue;
      const res = await post(`${web}/_api/web/folders/AddUsingPath(DecodedUrl='${q(cur)}',Overwrite=false)`, null);
      if (!res.ok && res.status !== 409) {
        // Ältere Variante als Rückfall
        const r2 = await post(`${web}/_api/web/folders/add('${q(cur)}')`, null);
        if (!r2.ok) throw new SpError("unavailable", `Ordner ${cur} (${r2.status})`, r2.status);
      }
      knownFolders.add(cur);
    }
    return cur;
  }
  async function readFile(path) {
    const lib = await ensureLibrary();
    const { dir, name } = locate(path);
    const fileUrl = [lib, ...dir, name].join("/");
    const res = await http(`${web}/_api/web/GetFileByServerRelativePath(DecodedUrl='${q(fileUrl)}')/$value`);
    if (res.status === 404) return { exists: false, data: undefined, etag: null, fileUrl };
    if (!res.ok) throw new SpError("unavailable", `Lesen ${path} (${res.status})`, res.status);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new SpError("unavailable", `Datei ${name} ist beschädigt`); }
    return { exists: true, data, etag: res.headers.get("ETag"), fileUrl };
  }
  async function writeFile(path, data, etag) {
    const { dir, name } = locate(path);
    const body = JSON.stringify(data);
    if (etag !== undefined && etag !== null) {
      const lib = await ensureLibrary();
      const fileUrl = [lib, ...dir, name].join("/");
      const res = await post(`${web}/_api/web/GetFileByServerRelativePath(DecodedUrl='${q(fileUrl)}')/$value`, body, { "X-HTTP-Method": "PUT", "IF-MATCH": etag });
      if (res.status === 412) throw new SpError("conflict", "Gleichzeitige Änderung", 412);
      if (!res.ok) throw new SpError("unavailable", `Schreiben ${path} (${res.status})`, res.status);
      return;
    }
    const folder = await ensureFolder(dir);
    const res = await post(`${web}/_api/web/GetFolderByServerRelativePath(DecodedUrl='${q(folder)}')/Files/AddUsingPath(DecodedUrl='${q(name)}',Overwrite=true)`, body);
    if (!res.ok) throw new SpError("unavailable", `Speichern ${path} (${res.status})`, res.status);
  }
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  function merge(base, patch) {
    const out = isObj(base) ? { ...base } : {};
    for (const [k, v] of Object.entries(patch)) out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : (isObj(v) ? merge({}, v) : v);
    return out;
  }
  const freeze = (o) => { if (o && typeof o === "object") { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
  const snap = (id, exists, data) => ({ id, exists, data: () => data, metadata: { fromCache: false, hasPendingWrites: false } });

  // Beobachter: nach eigenen Schreibvorgängen sofort neu lesen.
  const watchers = new Set();
  const poke = () => watchers.forEach((w) => w());

  function doc(path) {
    const id = path.split("/").pop();
    return {
      id, path,
      async get() { const r = await readFile(path); return snap(id, r.exists, r.exists ? freeze(r.data) : undefined); },
      async set(data) { await writeFile(path, data); poke(); },
      async update(patch) {
        for (let attempt = 0; attempt < 4; attempt++) {
          const r = await readFile(path);
          if (!r.exists) throw new SpError("invalid_argument", "Dokument existiert nicht");
          try { await writeFile(path, merge(r.data, patch), r.etag || null); poke(); return; }
          catch (e) { if (e.code !== "conflict") throw e; }
        }
        throw new SpError("unavailable", "Zu viele gleichzeitige Änderungen");
      },
      onSnapshot(next, error) {
        let last = Symbol("none"), stopped = false, busy = false;
        const run = async () => {
          if (stopped || busy) return;
          busy = true;
          try {
            const r = await readFile(path);
            const key = r.exists ? JSON.stringify(r.data) : null;
            if (key !== last) { last = key; next(snap(id, r.exists, r.exists ? freeze(r.data) : undefined)); }
          } catch (e) { if (e.code === "not_granted" && error) { error(e); stopped = true; } }
          finally { busy = false; }
        };
        run();
        const t = setInterval(run, POLL_MS);
        watchers.add(run);
        return () => { stopped = true; clearInterval(t); watchers.delete(run); };
      },
    };
  }
  function collection(name) {
    let monthEq = null;
    const api = {
      where(field, op, value) { if (name === "days" && field === "month" && op === "==") monthEq = String(value); return api; },
      onSnapshot(next, error) {
        let stopped = false, busy = false, lastKey = null;
        const cache = new Map(); // Dateiname -> { etag, data }
        const run = async () => {
          if (stopped || busy || !monthEq) return;
          busy = true;
          try {
            const lib = await ensureLibrary();
            const folder = `${lib}/days/${monthEq}`;
            const res = await http(`${web}/_api/web/GetFolderByServerRelativePath(DecodedUrl='${q(folder)}')/Files?$select=Name,ETag`, { headers: { Accept: "application/json;odata=nometadata" } });
            let files = [];
            if (res.ok) files = ((await res.json()).value || []).filter((f) => /\.json$/.test(f.Name));
            else if (res.status !== 404) throw new SpError("unavailable", `Monat ${monthEq} (${res.status})`, res.status);
            for (const f of files) {
              const c = cache.get(f.Name);
              if (c && c.etag === f.ETag) continue;
              const r = await readFile("days/" + f.Name.replace(/\.json$/, ""));
              if (r.exists) cache.set(f.Name, { etag: f.ETag, data: freeze(r.data) });
            }
            for (const k of [...cache.keys()]) if (!files.some((f) => f.Name === k)) cache.delete(k);
            const key = files.map((f) => f.Name + f.ETag).sort().join("|");
            if (key !== lastKey) {
              lastKey = key;
              const docs = [...cache.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([n, v]) => snap(n.replace(/\.json$/, ""), true, v.data));
              next({ docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } });
            }
          } catch (e) { if (e.code === "not_granted" && error) { error(e); stopped = true; } }
          finally { busy = false; }
        };
        run();
        const t = setInterval(run, POLL_MS);
        watchers.add(run);
        return () => { stopped = true; clearInterval(t); watchers.delete(run); };
      },
    };
    return api;
  }
  return { doc, collection, ready: ensureLibrary };
}

// ---------- App ----------
export function mount(container, opts = {}) {
  opts = { mode: "auto", ...opts };
  const root = opts.root || document;
  const host = root.host || container;
  const timers = [], cleanups = [];
  // Brücke der Mac-App (mac/preload.js); im Browser und in SharePoint nicht vorhanden.
  const NATIVE = opts.native || (typeof window !== "undefined" && window.rezeptionNative) || null;
  let disposed = false;
  container.innerHTML = MARKUP;
  // Farbschema: in SharePoint immer hell, sonst wie die einbettende Seite (claude.ai setzt data-theme).
  if (opts.mode === "sharepoint") host.setAttribute("data-theme", "light");
  else if (root.host) {
    const syncTheme = () => { const t = document.documentElement.getAttribute("data-theme"); if (t) host.setAttribute("data-theme", t); else host.removeAttribute("data-theme"); };
    syncTheme();
    const mo = new MutationObserver(syncTheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    cleanups.push(() => mo.disconnect());
  }
  // Querformat: Höhe bis zum unteren Fensterrand, damit alles auf einen Bildschirm passt.
  if (opts.fitViewport) {
    const fit = () => { const top = Math.max(0, host.getBoundingClientRect().top + (window.scrollY || 0)); host.style.setProperty("--rz-h", Math.max(480, window.innerHeight - top - 8) + "px"); };
    fit();
    window.addEventListener("resize", fit);
    cleanups.push(() => window.removeEventListener("resize", fit));
    timers.push(setTimeout(fit, 500));
  }


  // ---------- Standardplan (Vorlage: Aushang „Checkliste neue Rezeption") ----------
  // Pro Tag gilt: Tagesanpassung > Wochentag-Vorlage > gespeicherter Standard > DEFAULT_PLAN.
  // Item-IDs sind Datenbank-Schlüssel: nie umbenennen.
  // Stand: von der Rezeption angepasster Plan (Testversion, 10.10.2026).
  const DEFAULT_PLAN = {
    "frueh": {
      "end": "15:30",
      "phases": [
        {
          "from": "08:00",
          "hint": "direkt bei Schichtbeginn",
          "id": "open",
          "items": [
            {
              "id": "f_lager",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Lager (hinter Rezeption) aufschließen"
            },
            {
              "id": "f_ruf",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Rufweiterleitung deaktivieren"
            },
            {
              "id": "f_nubsi",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Neue Eingangstür „Nubsi“ verstellen"
            },
            {
              "id": "f_kuehl_auf",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Kühlschränke aufschließen + Licht an"
            },
            {
              "id": "f_kaffee",
              "important": false,
              "optional": false,
              "s": "rechts hinter dem Display",
              "t": "Kaffeemaschine anstellen"
            },
            {
              "id": "f_musik",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Musik an über Sonos"
            },
            {
              "id": "f_tv",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Beide Fernseher anmachen"
            }
          ],
          "title": "Öffnen",
          "to": "08:30"
        },
        {
          "from": "08:00",
          "hint": "vor den ersten Buchungen",
          "id": "setup",
          "items": [
            {
              "id": "f_spint",
              "important": false,
              "optional": false,
              "s": "Schläger-Nr. korrekt hinterlegt? Auf Schäden prüfen.",
              "t": "Schläger/Bälle vom Vorabend aus dem Rückgabespint nehmen"
            },
            {
              "id": "f_merch",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Merch und Testschläger vorne an die Wand hängen"
            },
            {
              "id": "f_rezeption",
              "important": false,
              "optional": false,
              "s": "Aufsteller, Kaffeebecher + Extras, Spendenbox, Preisliste, Eisliste, Snickers, Müsliriegel, Griffbänder",
              "t": "Rezeption aufbauen"
            },
            {
              "id": "f_kuehl_fuell",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Kühlschränke auffüllen"
            }
          ],
          "title": "Rezeption einrichten",
          "to": "09:00"
        },
        {
          "from": "09:00",
          "hint": "am Vormittag",
          "id": "orga",
          "items": [
            {
              "id": "f_excel",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Neuerungen in der Excel (SharePoint) prüfen"
            },
            {
              "id": "f_bestand",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Bestand Schläger + Bälle prüfen → sortieren"
            }
          ],
          "title": "Orga",
          "to": "11:00"
        }
      ],
      "start": "08:00"
    },
    "spaet": {
      "end": "23:00",
      "phases": [
        {
          "from": "15:30",
          "hint": "Übergabe-Notiz lesen",
          "id": "start",
          "items": [
            {
              "id": "s_excel",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Neuerungen in der Excel (SharePoint) prüfen"
            },
            {
              "id": "s_xmv2uktvfpcm8",
              "important": false,
              "optional": true,
              "s": "",
              "t": "Check-ins erledigen, wenn noch offen"
            }
          ],
          "title": "Schichtstart",
          "to": "16:00"
        },
        {
          "from": "18:30",
          "hint": "je nach Dunkelheit",
          "id": "licht",
          "items": [
            {
              "id": "s_flutlicht_an",
              "important": false,
              "optional": true,
              "s": "ab ca. 18:30, je nach Dunkelheit",
              "t": "bei Bedarf: Tennis-Flutlicht anstellen"
            },
            {
              "id": "s_plejd",
              "important": false,
              "optional": false,
              "s": "geht automatisch 30 min vor Sonnenuntergang ein und um 22:10 Uhr aus",
              "t": "Outdoor-Plätze: Licht über Plejd anmachen"
            }
          ],
          "title": "Licht an",
          "to": "19:30"
        },
        {
          "from": "20:00",
          "hint": "",
          "id": "kunden",
          "items": [
            {
              "id": "s_kunden",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Kunden für abends ab 22 Uhr und morgens (8–10 Uhr) anschreiben und informieren"
            }
          ],
          "title": "Kunden informieren",
          "to": "21:00"
        },
        {
          "from": "21:00",
          "hint": "nach den Buchungen",
          "id": "plaetze",
          "items": [
            {
              "id": "s_flutlicht_aus",
              "important": false,
              "optional": true,
              "s": "spätestens 22:10 Uhr",
              "t": "Tennis-Flutlicht ausstellen"
            },
            {
              "id": "s_waessern",
              "important": false,
              "optional": true,
              "s": "nur wenn es sehr trocken ist, nach 21 Uhr // aktuell nicht notwendig wegen Tau",
              "t": "Tennisplätze 3× hintereinander wässern"
            }
          ],
          "title": "Plätze",
          "to": "21:30"
        },
        {
          "from": "21:30",
          "hint": "nach der letzten Buchung",
          "id": "abbau",
          "items": [
            {
              "id": "s_kaffee",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Kaffeemaschine reinigen"
            },
            {
              "id": "s_merch",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Merch + Testschläger hinten in den Raum wegräumen"
            },
            {
              "id": "s_rezeption",
              "important": false,
              "optional": false,
              "s": "Aufsteller alter Tresen 2×, neuer Tresen 1×, Kaffeebecher + Extras, Spendenbox, Preisliste, Eisliste, Snickers, Müsliriegel, Griffbänder",
              "t": "Rezeption abbauen"
            },
            {
              "id": "s_spinte",
              "important": false,
              "optional": false,
              "s": "Notiz in der Buchung: Schläger-Nr. + evtl. Bälle",
              "t": "Rückgabe-Spinte mit LE füllen"
            },
            {
              "id": "s_kuehl",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Kühlschränke auffüllen + Licht aus + abschließen"
            }
          ],
          "title": "Abbau",
          "to": "22:00"
        },
        {
          "from": "22:30",
          "hint": "in dieser Reihenfolge",
          "id": "close",
          "items": [
            {
              "id": "s_musik",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Musik aus über Sonos/Spotify"
            },
            {
              "id": "s_tv",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Fernseher ausmachen"
            },
            {
              "id": "s_schiebe",
              "important": false,
              "optional": false,
              "s": "roter Punkt",
              "t": "Schiebefenster abschließen"
            },
            {
              "id": "s_ruf",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Rufweiterleitung aktivieren, Info an G/D/D/J"
            },
            {
              "id": "s_xmv2j3h7wo0pc",
              "important": false,
              "optional": true,
              "s": "wenn voll",
              "t": "Müll rausbringen"
            },
            {
              "id": "s_nubsi",
              "important": false,
              "optional": false,
              "s": "",
              "t": "Neue Eingangstür „Nubsi“ verstellen"
            },
            {
              "id": "s_alte",
              "important": false,
              "optional": false,
              "s": "Gummiband abmachen, prüfen ob abgeschlossen",
              "t": "„Alte“ Eingangstür (mit Code) abschließen"
            }
          ],
          "title": "Abschließen",
          "to": "23:00"
        }
      ],
      "start": "15:30"
    },
    "always": {
      "frueh": [
        {
          "every": 60,
          "id": "rund",
          "important": false,
          "s": "",
          "t": "Rundgang Halle / draußen"
        },
        {
          "every": 60,
          "id": "wasser",
          "important": false,
          "s": "",
          "t": "Wasserspender regelmäßig wischen"
        },
        {
          "every": 0,
          "id": "spuel",
          "important": false,
          "s": "",
          "t": "Spülbecken (Lager) sauberhalten"
        },
        {
          "every": 0,
          "id": "checkin",
          "important": false,
          "s": "nicht geschafft? → Übergabe-Notiz",
          "t": "Check-ins erledigen"
        },
        {
          "every": 0,
          "id": "whatsapp",
          "important": false,
          "s": "",
          "t": "WhatsApp-Chats abarbeiten"
        },
        {
          "every": 0,
          "id": "a_xmv2j2g67uihk",
          "important": false,
          "s": "",
          "t": "Laptop + Handy laden"
        },
        {
          "every": 0,
          "id": "fenster",
          "important": false,
          "s": "je nach Wetter",
          "t": "Fenster öffnen/schließen"
        },
        {
          "every": 0,
          "id": "a_xmv2j6qsr3cnv",
          "important": false,
          "s": "",
          "t": "Müll rausbringen, wenn voll"
        }
      ],
      "spaet": [
        {
          "every": 60,
          "id": "rund",
          "important": false,
          "s": "",
          "t": "Rundgang Halle / draußen"
        },
        {
          "every": 60,
          "id": "wasser",
          "important": false,
          "s": "",
          "t": "Wasserspender regelmäßig wischen"
        },
        {
          "every": 0,
          "id": "spuel",
          "important": false,
          "s": "",
          "t": "Spülbecken (Lager) sauberhalten"
        },
        {
          "every": 0,
          "id": "whatsapp",
          "important": false,
          "s": "",
          "t": "WhatsApp-Chats abarbeiten"
        },
        {
          "every": 0,
          "id": "fenster",
          "important": false,
          "s": "je nach Wetter",
          "t": "Fenster öffnen/schließen"
        },
        {
          "every": 0,
          "id": "a_xmv2j69560uh4",
          "important": false,
          "s": "",
          "t": "Laptop + Handy laden"
        }
      ]
    }
  };

  const SHIFT_META = {
    frueh: { label: "Frühschicht", short: "Früh", prefix: "f" },
    spaet: { label: "Spätschicht", short: "Spät", prefix: "s" },
  };
  const KEYS = ["frueh", "spaet"];

  // ---------- Helfer ----------
  const $ = (id) => root.getElementById(id);
  const esc = (v) => String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (iso, n) => { const d = parseIso(iso); d.setDate(d.getDate() + n); return isoDate(d); };
  const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  const fmtMin = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const fmtTime = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const newId = (prefix) => `${prefix}_x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const WD = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const WD_PL = ["Sonntage", "Montage", "Dienstage", "Mittwoche", "Donnerstage", "Freitage", "Samstage"];
  const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const CHECK_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';
  const LOOP_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 5.5A5.5 5.5 0 0 0 3.2 4.6M3 10.5a5.5 5.5 0 0 0 9.8.9"/><path d="M3 1.8v3h3M13 14.2v-3h-3"/></svg>';

  // ---------- Plan prüfen (Daten aus der DB sind unvertrauenswürdig) ----------
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  const ID_RE = /^[A-Za-z0-9_-]{1,60}$/;
  const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
  // Akzeptiert 7:30, 0730, 730, 7.30, 7 → "07:30"/"07:00"; sonst null.
  function normTime(v) {
    const m = String(v || "").trim().match(/^(\d{1,2})(?:[:.]?(\d{2}))?$/);
    if (!m) return null;
    const h = Number(m[1]), mi = Number(m[2] || 0);
    return h < 24 && mi < 60 ? `${pad(h)}:${pad(mi)}` : null;
  }
  const sortPhases = (phases) => phases.map((p, i) => [p, i]).sort((a, b) => (toMin(a[0].from) - toMin(b[0].from)) || (a[1] - b[1])).map(x => x[0]);

  function normalizePlan(raw) {
    if (!raw || typeof raw !== "object") return null;
    const out = { always: {} };
    for (const key of KEYS) {
      const s = raw[key], def = DEFAULT_PLAN[key];
      if (!s || typeof s !== "object" || !Array.isArray(s.phases)) return null;
      const seen = new Set();
      const phases = s.phases.slice(0, 20).map(p => {
        if (!p || typeof p !== "object" || !TIME_RE.test(p.from) || !TIME_RE.test(p.to)) return null;
        const items = (Array.isArray(p.items) ? p.items : []).slice(0, 40).map(i => {
          if (!i || typeof i !== "object" || !ID_RE.test(i.id) || seen.has(i.id)) return null;
          const t = str(i.t, 200).trim();
          if (!t) return null;
          seen.add(i.id);
          return { id: i.id, t, s: str(i.s, 300), important: i.important === true, optional: i.optional === true };
        }).filter(Boolean);
        return { id: ID_RE.test(p.id) ? p.id : newId("p"), title: str(p.title, 60).trim() || "Abschnitt", from: p.from, to: p.to, hint: str(p.hint, 80), items };
      }).filter(Boolean);
      out[key] = {
        start: TIME_RE.test(s.start) ? s.start : def.start,
        end: TIME_RE.test(s.end) ? s.end : def.end,
        phases: sortPhases(phases),
      };
      const al = raw.always && Array.isArray(raw.always[key]) ? raw.always[key] : DEFAULT_PLAN.always[key];
      out.always[key] = al.slice(0, 20).map(a => {
        if (!a || typeof a !== "object") return null;
        const t = str(a.t, 200).trim();
        if (!t) return null;
        const every = Number.isInteger(a.every) && a.every >= 0 && a.every <= 480 ? a.every : (a.rounds === true ? 60 : 0);
        // Art: rhythm (Zähler + fällig), confirm (Pflicht, einmal pro Schicht bestätigen), hint (nur Hinweis).
        // Ältere Pläne ohne Art: mit Rhythmus → rhythm, Laptop/Handy/Spülbecken → confirm, sonst hint.
        let kind = ["rhythm", "confirm", "hint"].includes(a.kind) ? a.kind : every > 0 ? "rhythm" : /laptop|handy|spülbecken|spuelbecken/i.test(t) ? "confirm" : "hint";
        return { id: ID_RE.test(a.id) ? a.id : newId("a"), t, s: str(a.s, 200), important: a.important === true, kind, every: kind === "rhythm" ? (every || 60) : 0 };
      }).filter(Boolean);
    }
    return out;
  }

  // Abgeleitete Strukturen pro Planobjekt einmal berechnen.
  const derivedCache = new WeakMap();
  function derive(plan) {
    let d = derivedCache.get(plan);
    if (d) return d;
    d = { ids: {}, item: {} };
    for (const key of KEYS) {
      d.ids[key] = [];
      for (const p of plan[key].phases) for (const i of p.items) { d.ids[key].push(i.id); d.item[i.id] = { ...i, shift: key, phase: p }; }
    }
    derivedCache.set(plan, d);
    return d;
  }

  // ---------- Zustand ----------
  const DEFAULT = normalizePlan(DEFAULT_PLAN);
  const state = {
    date: isoDate(new Date()),
    view: "schicht",
    shiftSel: null,      // null = laufende Schicht automatisch, sonst "frueh" | "spaet"
    rosterMonth: null,   // "JJJJ-MM" im Dienstplan
    rosterDay: null,     // Tag im Bearbeiten-Fenster des Dienstplans
    remindOpen: false, remindSnoozeUntil: 0,
    time: {},            // Zeiterfassung des angezeigten Tages: { <id>: { pid, role, in, out, pause, at, orig?, editedAt? } | null }
    checkin: null,       // offenes Einchecken-Fenster
    checkout: null,      // offenes Auschecken-Fenster
    timesMonth: null, timesPerson: null, timesData: null, timesEdit: null, timesAll: false,
    checks: {}, notes: {}, prevNotes: {},
    logs: {},            // Daueraufgaben: { frueh|spaet: { <id>: { <key>: {at, by} | null } } }
    dayPlan: null,       // Tagesanpassung (normalisiert) oder null
    cfg: { base: null, weekday: {}, people: [], roster: {}, adminPin: null }, // Pläne, Team, Dienstplan, Leitungs-PIN
    docExists: false, cfgExists: false,
    month: {},           // date -> { checks, plan }
    names: {},
    expanded: new Set(),
    draft: null,         // Plan-Editor: Arbeitskopie
    draftDirty: false,
    confirm: null,       // zweistufiges Löschen
    mode: "loading",
    readOnly: false,
    who: null,           // { date, shift, id } – wer gerade an der Rezeption arbeitet (pro Gerät)
    pickerOpen: false, pickerSnoozeUntil: 0,
    unlockedUntil: 0,    // Leitungsbereich entsperrt bis (ms)
    pinStage: null,      // { mode: "unlock"|"set", first?: string, next: view }
    rosterEdit: false,
    importPreview: null, // eingelesener Arbeitsplan vor dem Übernehmen
  };
  let db = null, user = null, myId = null, unsubDay = null, unsubMonth = null, unsubCfg = null, monthKey = null;
  let writeChain = Promise.resolve();
  let renderPending = false;
  let scrolledOnce = false;

  // raw = ohne Schichtzeiten aus dem Dienstplan (für den Plan-Editor).
  function resolvePlan(date, dayPlan, raw) {
    let r;
    if (dayPlan) r = { plan: dayPlan, source: "day" };
    else {
      const wd = String(parseIso(date).getDay());
      if (state.cfg.weekday[wd]) r = { plan: state.cfg.weekday[wd], source: "weekday" };
      else if (state.cfg.base) r = { plan: state.cfg.base, source: "base" };
      else r = { plan: DEFAULT, source: "default" };
    }
    return raw ? r : { ...r, plan: withRosterTimes(r.plan, date) };
  }
  // Schichtbeginn/-ende des Tages aus dem eingelesenen Arbeitsplan übernehmen (Abschnitte bleiben unverändert).
  const timesCache = new Map();
  function withRosterTimes(plan, date) {
    const t = state.cfg.roster[date] && state.cfg.roster[date].times;
    if (!t) return plan;
    const key = date + JSON.stringify(t);
    const hit = timesCache.get(key);
    if (hit && hit.src === plan) return hit.plan;
    const out = { ...plan };
    for (const k of KEYS) if (t[k]) { const [a, b] = t[k].split("-"); out[k] = { ...plan[k], start: a, end: b }; }
    if (timesCache.size > 200) timesCache.clear();
    timesCache.set(key, { src: plan, plan: out });
    return out;
  }
  const P = () => resolvePlan(state.date, state.dayPlan).plan;

  // ---------- Speicher ----------
  const LS = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; } },
    month(ym) {
      const out = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("rz2:" + ym)) { const d = JSON.parse(localStorage.getItem(k) || "{}"); out[k.slice(4)] = { checks: d.checks || {}, plan: normalizePlan(d.plan), time: normTime(d.time) }; }
        }
      } catch { /* blockiert */ }
      return out;
    },
  };

  function setStatus(text, err = false) { const el = $("status"); el.textContent = text; el.title = text; el.classList.toggle("err", err); }
  function statusLine() {
    if (state.readOnly) return "Nur Lesezugriff.";
    if (state.mode === "shared") return opts.mode === "sharepoint" ? "Gespeichert in SharePoint" : "Live geteilt";
    if (state.mode === "local") return backupHint() || "Gespeichert auf diesem Mac";
    return "Verbinde…";
  }

  function applyDoc(data) {
    state.checks = (data && data.checks && typeof data.checks === "object") ? data.checks : {};
    state.notes = (data && data.notes && typeof data.notes === "object") ? data.notes : {};
    state.logs = (data && data.logs && typeof data.logs === "object") ? data.logs : {};
    state.time = normTime(data && data.time);
    state.dayPlan = data ? normalizePlan(data.plan) : null;
  }
  function applyCfg(data) {
    const weekday = {};
    if (data && data.weekday && typeof data.weekday === "object") {
      for (let i = 0; i < 7; i++) { const p = normalizePlan(data.weekday[String(i)]); if (p) weekday[String(i)] = p; }
    }
    const people = (data && Array.isArray(data.people) ? data.people : []).slice(0, 80).map(x => {
      if (!x || typeof x !== "object" || !ID_RE.test(x.id)) return null;
      const name = str(x.name, 40).trim();
      return name ? { id: x.id, name } : null;
    }).filter(Boolean);
    const roster = {};
    if (data && data.roster && typeof data.roster === "object") {
      for (const [d, v] of Object.entries(data.roster)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !v || typeof v !== "object") continue;
        const e = {};
        for (const k of KEYS) e[k] = Array.isArray(v[k]) ? v[k].filter(id => typeof id === "string" && ID_RE.test(id)).slice(0, 10) : [];
        // Schichtzeiten des Tages aus dem Arbeitsplan ("08:45-16:00") und Anmerkungen pro Person ("Ab 17 Uhr").
        if (v.times && typeof v.times === "object") {
          const t = {};
          for (const k of KEYS) if (typeof v.times[k] === "string" && /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(v.times[k])) t[k] = v.times[k];
          if (Object.keys(t).length) e.times = t;
        }
        if (v.info && typeof v.info === "object") {
          const inf = {};
          for (const [pid, txt] of Object.entries(v.info)) if (ID_RE.test(pid) && typeof txt === "string" && txt.trim()) inf[pid] = txt.trim().slice(0, 60);
          if (Object.keys(inf).length) e.info = inf;
        }
        // Anmerkung pro Schicht aus dem Monatsplan (nur Anzeige, z. B. „+Nia“).
        if (v.notes && typeof v.notes === "object") {
          const n = {};
          for (const k of KEYS) if (typeof v.notes[k] === "string" && v.notes[k].trim()) n[k] = v.notes[k].trim().slice(0, 80);
          if (Object.keys(n).length) e.notes = n;
        }
        roster[d] = e;
      }
    }
    state.cfg = { base: data ? normalizePlan(data.base) : null, weekday, people, roster, adminPin: data && typeof data.adminPin === "string" ? data.adminPin.slice(0, 64) : null };
  }

  function currentDayDoc() {
    return { month: state.date.slice(0, 7), checks: state.checks, notes: state.notes, logs: state.logs, time: state.time, plan: state.dayPlan };
  }

  async function loadPrevNotes() {
    const prev = addDays(state.date, -1), forDate = state.date;
    let notes = {};
    if (state.mode === "shared") {
      try { const s = await db.doc("days/" + prev).get(); notes = (s.exists && s.data().notes) || {}; } catch { notes = {}; }
    } else notes = LS.get("rz2:" + prev, {}).notes || {};
    if (forDate !== state.date) return;
    state.prevNotes = notes;
    collectNames();
    render();
  }

  function subscribeDay() {
    if (unsubDay) { unsubDay(); unsubDay = null; }
    state.prevNotes = {};
    if (state.mode !== "shared") {
      applyDoc(LS.get("rz2:" + state.date, null));
      state.docExists = true;
      render(); loadPrevNotes();
      return;
    }
    const m = state.month[state.date];
    applyDoc(m ? { checks: m.checks, plan: m.plan } : null);
    state.docExists = !!m;
    render(); loadPrevNotes();
    unsubDay = db.doc("days/" + state.date).onSnapshot(
      (snap) => { state.docExists = snap.exists; applyDoc(snap.exists ? snap.data() : null); collectNames(); render(); },
      (e) => setStatus("Verbindung unterbrochen (" + ((e && e.code) || "Fehler") + ") – Seite neu laden", true),
    );
  }

  function subscribeMonth(force) {
    const ym = state.date.slice(0, 7);
    if (!force && ym === monthKey && (unsubMonth || state.mode === "local")) return;
    monthKey = ym;
    if (unsubMonth) { unsubMonth(); unsubMonth = null; }
    if (state.mode !== "shared") { state.month = LS.month(ym); return; }
    state.month = {};
    unsubMonth = db.collection("days").where("month", "==", ym).onSnapshot(
      (snap) => {
        const m = {};
        snap.docs.forEach(d => { if (d.exists) { const x = d.data(); m[d.id] = { checks: x.checks || {}, plan: normalizePlan(x.plan), time: normTime(x.time) }; } });
        state.month = m;
        if (state.view === "monat") render();
      },
      () => { /* optional */ },
    );
  }

  function subscribeCfg() {
    if (state.mode !== "shared") { applyCfg(LS.get("rz2cfg", null)); state.cfgExists = true; return; }
    unsubCfg = db.doc("config/plan").onSnapshot(
      (snap) => { state.cfgExists = snap.exists; applyCfg(snap.exists ? snap.data() : null); render(); },
      () => { /* Standardplan bleibt aktiv */ },
    );
  }

  function collectNames() {
    const ids = [
      ...Object.values(state.checks).filter(Boolean).map(c => c.by),
      ...Object.values(state.notes).filter(Boolean).map(n => n.by),
      ...Object.values(state.prevNotes).filter(Boolean).map(n => n.by),
      ...Object.values(state.logs).flatMap(sh => Object.values(sh || {}).flatMap(m => Object.values(m || {}))).filter(Boolean).map(v => v.by),
    ].filter(id => typeof id === "string" && id && !(id in state.names));
    if (!ids.length || !user || typeof user.profiles !== "function") return;
    const uniq = [...new Set(ids)];
    uniq.forEach(id => { state.names[id] = ""; });
    user.profiles(uniq).then(ps => {
      uniq.forEach(id => { state.names[id] = (ps && ps[id] && ps[id].name) || ""; });
      render();
    }).catch(() => { /* optional */ });
  }

  // Schreibvorgänge strikt nacheinander. patch = Merge auf bestehendes Dokument, full = Inhalt beim Neuanlegen.
  function persistDoc(path, patch, full, localKey, localFull) {
    if (state.readOnly) { setStatus("Nur Lesezugriff – Änderungen werden nicht gespeichert", true); return Promise.resolve(false); }
    if (state.mode !== "shared") {
      const ok = LS.set(localKey, localFull);
      if (!ok) setStatus("Browser-Speicher blockiert – Änderungen gehen beim Neuladen verloren", true);
      return Promise.resolve(ok);
    }
    const job = writeChain.then(async () => {
      const ref = db.doc(path);
      try {
        const snap = await ref.get();
        if (snap.exists) await ref.update(patch); else await ref.set(full);
        setStatus(statusLine());
        return true;
      } catch (e) {
        const code = e && e.code;
        if (code === "not_granted") { state.readOnly = true; setStatus("Nur Lesezugriff – Bearbeitungsrechte beim Besitzer anfragen", true); }
        else setStatus("Speichern fehlgeschlagen (" + (code || "Fehler") + ") – bitte erneut versuchen", true);
        return false;
      }
    });
    writeChain = job;
    return job;
  }
  const persistDay = (date, patch) => persistDoc("days/" + date, patch, currentDayDoc(), "rz2:" + date, currentDayDoc());
  function cfgPayload() {
    const weekday = {};
    for (const k of Object.keys(state.cfg.weekday)) weekday[k] = state.cfg.weekday[k];
    return { base: state.cfg.base, weekday, people: state.cfg.people, roster: state.cfg.roster, adminPin: state.cfg.adminPin };
  }
  const persistCfg = (patch) => persistDoc("config/plan", patch, cfgPayload(), "rz2cfg", cfgPayload());

  function setCheck(id, value) {
    if (state.readOnly) { setStatus("Nur Lesezugriff – Änderungen werden nicht gespeichert", true); return; }
    if (needPerson()) return;
    const next = { ...state.checks, [id]: value };
    if (!value) delete next[id];
    state.checks = next;
    state.month = { ...state.month, [state.date]: { checks: next, plan: state.dayPlan } };
    render();
    persistDay(state.date, { checks: { [id]: value } });
    // Letzter Punkt der Spätschicht heute erledigt → Tagesabschluss sichern.
    if (value && state.date === isoDate(new Date())) {
      const pr = progress(P(), "spaet", next);
      if (pr.total && pr.done === pr.total) autoBackup("day");
    }
  }

  const noteTimers = {};
  function queueNote(shift, text) {
    clearTimeout(noteTimers[shift]);
    const date = state.date;
    const el = $("saved-" + shift);
    if (el) el.textContent = "Speichert…";
    noteTimers[shift] = setTimeout(async () => {
      if (date !== state.date) return;
      const val = { text: text.slice(0, 4000), by: actorId(), at: new Date().toISOString() };
      state.notes = { ...state.notes, [shift]: val };
      const ok = await persistDay(date, { notes: { [shift]: val } });
      const el2 = $("saved-" + shift);
      if (el2) el2.textContent = ok ? "Gespeichert " + fmtTime(val.at) : "Nicht gespeichert";
    }, 700);
  }

  // ---------- Personen ----------
  const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
  function personName(id) {
    if (!id) return "";
    const p = state.cfg.people.find(x => x.id === id);
    if (p) return p.name;
    return state.names[id] || (id === myId ? "dir" : "");
  }
  function loadWho() { state.who = LS.get("rz2who", null); }
  // Aktive Person: heute eingecheckt (noch nicht ausgecheckt) und an diesem Gerät gewählt.
  function currentPerson() {
    const w = state.who, today = isoDate(new Date());
    if (!w || w.date !== today) return null;
    if (!openEntry(today, w.id)) return null;
    return state.cfg.people.find(p => p.id === w.id) || null;
  }
  const actorId = () => { const p = currentPerson(); return p ? p.id : (myId || null); };
  function rosterFor(date) { return state.cfg.roster[date] || { frueh: [], spaet: [] }; }
  // Abhaken braucht eine gewählte Person, sobald ein Team angelegt ist.
  function needPerson() {
    if (!state.cfg.people.length || currentPerson()) return false;
    openPicker(true);
    return true;
  }

  // ---------- Zeiterfassung ----------
  // Ein Eintrag pro Einchecken im Tagesdokument (Tag des Beginns). Zeiten immer in 15-Minuten-Schritten.
  // Schlüssel „aushilfe“ bleibt wegen gespeicherter Daten, angezeigt wird „Sonstiges“.
  const ROLE_LABEL = { frueh: "Früh", spaet: "Spät", aushilfe: "Sonstiges" };
  const QUARTERS = Array.from({ length: 96 }, (_, i) => fmtMin(i * 15));
  const roundQ = (m) => Math.min(1425, Math.round(m / 15) * 15);
  function normTime(raw) {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    for (const [id, e] of Object.entries(raw)) {
      if (!ID_RE.test(id) || !e || typeof e !== "object" || !ID_RE.test(e.pid || "") || !TIME_RE.test(e.in || "")) continue;
      out[id] = {
        pid: e.pid, role: ["frueh", "spaet", "aushilfe"].includes(e.role) ? e.role : "aushilfe", in: e.in,
        out: TIME_RE.test(e.out || "") ? e.out : null, pause: Number.isInteger(e.pause) && e.pause >= 0 && e.pause <= 600 ? e.pause : null,
        note: str(e.note, 200).trim(),
        at: typeof e.at === "string" ? e.at : null, editedAt: typeof e.editedAt === "string" ? e.editedAt : null,
        orig: e.orig && typeof e.orig === "object" ? { in: e.orig.in || null, out: e.orig.out || null, pause: Number.isInteger(e.orig.pause) ? e.orig.pause : null } : null,
      };
    }
    return out;
  }
  const timeOf = (date) => date === state.date ? state.time : ((state.month[date] && state.month[date].time) || (state.mode === "local" ? normTime(LS.get("rz2:" + date, {}).time) : {}));
  function openEntry(date, pid) {
    const t = timeOf(date);
    const hit = Object.entries(t).find(([, e]) => e && e.pid === pid && !e.out);
    return hit ? { id: hit[0], date, entry: hit[1] } : null;
  }
  // Vergessenes Auschecken an früheren Tagen (aktueller Monat).
  function staleOpenEntries(pid, today) {
    const out = [];
    for (const [date, m] of Object.entries(state.month)) {
      if (date >= today || !m || !m.time) continue;
      for (const [id, e] of Object.entries(m.time)) if (e && e.pid === pid && !e.out) out.push({ id, date, entry: e });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }
  function workedMin(e) {
    if (!e || !e.in || !e.out) return null;
    let d = toMin(e.out) - toMin(e.in);
    if (d < 0) d += 1440;
    return Math.max(0, d - (e.pause || 0));
  }
  const fmtHours = (m) => m === null || m === undefined ? "–" : `${Math.floor(m / 60)}:${pad(m % 60)}`;
  // Gesetzliche Mindestpause als Vorschlag: über 6 Std. 30 Min., über 9 Std. 45 Min.
  const suggestPause = (gross) => gross > 540 ? 45 : gross > 360 ? 30 : 0;
  function persistTime(date, id, entry) {
    if (date === state.date) {
      const t = { ...state.time }; if (entry) t[id] = entry; else delete t[id];
      state.time = t;
    }
    if (state.month[date] || date.slice(0, 7) === state.date.slice(0, 7)) {
      const m = state.month[date] || { checks: {}, plan: null, time: {} };
      const t = { ...(m.time || {}) }; if (entry) t[id] = entry; else delete t[id];
      state.month = { ...state.month, [date]: { ...m, time: t } };
    }
    if (state.timesData && state.timesData.ym === date.slice(0, 7)) {
      const d = { ...(state.timesData.days[date] || {}) }; if (entry) d[id] = entry; else delete d[id];
      state.timesData = { ...state.timesData, days: { ...state.timesData.days, [date]: d } };
    }
    if (state.mode !== "shared") {
      const doc = date === state.date ? currentDayDoc() : { ...LS.get("rz2:" + date, {}), month: date.slice(0, 7) };
      if (date !== state.date) { const t = { ...(doc.time || {}) }; if (entry) t[id] = entry; else delete t[id]; doc.time = t; }
      return persistDoc("days/" + date, null, null, "rz2:" + date, doc);
    }
    const full = date === state.date ? currentDayDoc() : { month: date.slice(0, 7), time: entry ? { [id]: entry } : {} };
    return persistDoc("days/" + date, { time: { [id]: entry } }, full, "rz2:" + date, full);
  }
  function rosterRole(date, pid) {
    const r = rosterFor(date);
    return r.frueh.includes(pid) ? "frueh" : r.spaet.includes(pid) ? "spaet" : null;
  }
  function plannedFor(date, pid, role) {
    if (!["frueh", "spaet"].includes(role) || !rosterFor(date)[role].includes(pid)) return null;
    const pl = resolvePlan(date, date === state.date ? state.dayPlan : null).plan[role];
    return `${pl.start}–${pl.end}`;
  }
  function timeSelect(id, value, opts2 = {}) {
    return `<span class="tsel"><button class="mini" data-tstep="${id}" data-dir="-1" aria-label="15 Minuten früher">‹</button><select id="${id}">${opts2.allowOpen ? `<option value=""${value ? "" : " selected"}>offen</option>` : ""}${QUARTERS.map(q => `<option${q === value ? " selected" : ""}>${q}</option>`).join("")}</select><button class="mini" data-tstep="${id}" data-dir="1" aria-label="15 Minuten später">›</button></span>`;
  }
  const pauseSelect = (id, value) => `<select id="${id}">${Array.from({ length: 13 }, (_, i) => i * 15).map(v => `<option value="${v}"${v === value ? " selected" : ""}>${v} Min.</option>`).join("")}</select>`;

  // ---------- Zeitlogik ----------
  function timeCtx() {
    const today = isoDate(new Date());
    if (state.date < today) return "past";
    if (state.date > today) return "future";
    return nowMin();
  }
  function phaseState(phase, ctx) {
    if (!phase.items.length) return "done";
    const open = phase.items.filter(i => !state.checks[i.id]).length;
    if (!open) return "done";
    if (ctx === "future") return "later";
    if (ctx === "past") return "late";
    if (ctx >= toMin(phase.to)) return "late";
    if (ctx >= toMin(phase.from)) return "now";
    return "later";
  }
  function activeShift(plan, ctx) {
    if (typeof ctx !== "number") return null;
    const f = plan.frueh, s = plan.spaet;
    if (ctx >= toMin(f.start) && ctx < toMin(f.end) && ctx < toMin(s.start)) return "frueh";
    if (ctx >= toMin(s.start) && ctx < toMin(s.end)) return "spaet";
    if (ctx >= toMin(f.start) && ctx < toMin(f.end)) return "frueh";
    return null;
  }
  function focusShift(plan, ctx) {
    const a = activeShift(plan, ctx);
    if (a) return a;
    if (typeof ctx === "number" && ctx >= toMin(plan.spaet.start)) return "spaet";
    return "frueh";
  }
  // Einträge einer Daueraufgabe, älteste zuerst. Ungültige/gelöschte (null) fallen raus.
  function logEntries(shift, id) {
    const m = state.logs[shift] && state.logs[shift][id];
    if (!m || typeof m !== "object") return [];
    return Object.entries(m)
      .filter(([, v]) => v && typeof v.at === "string" && !isNaN(new Date(v.at)))
      .map(([k, v]) => ({ key: k, at: v.at, by: v.by }))
      .sort((x, y) => x.at.localeCompare(y.at));
  }
  // Fälligkeit bei festem Rhythmus: Referenz = letzter Haken, sonst Schichtbeginn.
  function dueInfo(plan, shift, a, ctx) {
    if (a.kind !== "rhythm" || !a.every || typeof ctx !== "number" || activeShift(plan, ctx) !== shift) return null;
    const list = logEntries(shift, a.id);
    const last = list.length ? list[list.length - 1] : null;
    const ref = last ? (() => { const d = new Date(last.at); return d.getHours() * 60 + d.getMinutes(); })() : toMin(plan[shift].start);
    const due = ref + a.every;
    if (due >= toMin(plan[shift].end)) return { state: "ok", due: null };
    if (ctx < due) return { state: "ok", due };
    return { state: ctx >= due + Math.max(15, a.every / 2) ? "over" : "due", due };
  }
  function progress(plan, key, checks) {
    const ids = derive(plan).ids[key];
    const done = ids.filter(id => checks[id]).length;
    return { done, total: ids.length, pct: ids.length ? Math.round(done / ids.length * 100) : 0 };
  }

  // ---------- Bausteine ----------
  const PILL = { now: '<span class="pill now">jetzt</span>', late: '<span class="pill late">offen</span>', done: '<span class="pill done">erledigt</span>', later: '<span class="pill later">später</span>' };

  function whoLine(c) {
    if (!c) return "";
    const name = personName(c.by);
    const time = fmtTime(c.at);
    return `${c.s === "na" ? "entfällt" : "erledigt"}${time ? " " + time : ""}${name ? " · " + esc(name) : ""}`;
  }

  function itemHtml(item, opts = {}) {
    const c = state.checks[item.id];
    const cls = [item.important ? "important" : "", c ? (c.s === "na" ? "na" : "done") : "", opts.upcoming ? "upcoming" : ""].join(" ");
    const tag = opts.showPhase ? `<span class="tag">${esc(item.phase.title)} · bis ${item.phase.to}</span>` : "";
    return `<li class="${cls}">
      <button class="check" data-id="${esc(item.id)}" aria-pressed="${!!c}">
        <span class="box">${CHECK_SVG}</span>
        <span class="txt"><span class="label">${esc(item.t)}</span>${tag}${item.s ? `<span class="sub">${esc(item.s)}</span>` : ""}${c ? `<span class="who">${whoLine(c)}</span>` : ""}</span>
      </button>
      ${item.optional ? `<button class="skip" data-skip="${esc(item.id)}" aria-pressed="${c && c.s === "na" ? "true" : "false"}">entfällt</button>` : ""}
    </li>`;
  }

  const pendingConfirms = (plan, key) => plan.always[key].filter(a => a.kind === "confirm" && !logEntries(key, a.id).length);
  function alwaysHtml(plan, key, ctx) {
    const list = plan.always[key];
    if (!list.length) return `<div class="empty">Keine Daueraufgaben.</div>`;
    const canLog = typeof ctx === "number";
    const lastLine = (last) => { if (!last) return ""; const n = personName(last.by); return `${fmtTime(last.at)}${n ? " · " + esc(n) : ""}`; };
    const rhythm = list.filter(a => a.kind === "rhythm").map(a => {
      const entries = logEntries(key, a.id), last = entries[entries.length - 1];
      const info = canLog ? dueInfo(plan, key, a, ctx) : null;
      let sub = a.every % 60 === 0 ? (a.every === 60 ? "1× pro Stunde" : `alle ${a.every / 60} Std.`) : `alle ${a.every} Min.`;
      if (info && info.due !== null) sub += info.state === "ok" ? ` · nächster um <b>${fmtMin(info.due)}</b>` : ` · <b>fällig seit ${fmtMin(info.due)}</b>`;
      return `<li class="${[a.important ? "important" : "", info ? info.state : ""].join(" ")}">
        <button class="tap" data-log="${esc(a.id)}" data-shift="${key}" ${canLog ? "" : 'disabled title="Nur am heutigen Tag"'} aria-label="${esc(a.t)} erledigt – eintragen">
          <span class="ic" aria-hidden="true">${LOOP_SVG}</span>
          <span><span class="label">${esc(a.t)}</span><span class="sub">${sub}</span>${last ? `<span class="last">zuletzt ${lastLine(last)}</span>` : ""}</span>
          <span class="cnt${entries.length ? "" : " zero"}" title="heute in dieser Schicht">${entries.length}×</span>
        </button>
        ${last && canLog ? `<button class="undo" data-unlog="${esc(a.id)}" data-shift="${key}" aria-label="Letzten Eintrag zurücknehmen">↶</button>` : ""}
      </li>`;
    }).join("");
    const confirm = list.filter(a => a.kind === "confirm").map(a => {
      const entries = logEntries(key, a.id), last = entries[entries.length - 1];
      return `<li class="confirm ${last ? "ok" : "open"}${a.important ? " important" : ""}">
        <button class="tap" data-log="${esc(a.id)}" data-shift="${key}" ${canLog && !last ? "" : "disabled"} aria-label="${esc(a.t)} bestätigen">
          <span class="box" aria-hidden="true">${CHECK_SVG}</span>
          <span><span class="label">${esc(a.t)}</span>${last ? `<span class="last">bestätigt ${lastLine(last)}</span>` : `<span class="sub">${a.s ? esc(a.s) + " · " : ""}vor Schichtende bestätigen</span>`}</span>
        </button>
        ${last && canLog ? `<button class="undo" data-unlog="${esc(a.id)}" data-shift="${key}" aria-label="Bestätigung zurücknehmen">↶</button>` : ""}
      </li>`;
    }).join("");
    const hint = list.filter(a => a.kind === "hint").map(a => `<li class="${a.important ? "important" : ""}"><span class="label">${esc(a.t)}</span>${a.s ? ` <span class="sub">${esc(a.s)}</span>` : ""}</li>`).join("");
    return `${rhythm ? `<div class="sublabel">Regelmäßig</div><ul class="always">${rhythm}</ul>` : ""}
      ${confirm ? `<div class="sublabel">Pflicht · einmal pro Schicht bestätigen</div><ul class="always">${confirm}</ul>` : ""}
      ${hint ? `<div class="sublabel">Im Blick behalten</div><ul class="hints">${hint}</ul>` : ""}`;
  }

  // Jeder Tipp = neuer Eintrag unter eigenem Schlüssel; gleichzeitige Tipps verschiedener Geräte überschreiben sich nicht.
  function logAlways(shift, id) {
    if (state.readOnly) { setStatus("Nur Lesezugriff – Änderungen werden nicht gespeichert", true); return; }
    if (needPerson()) { state.remindOpen = false; renderRemind(); return; }
    const k = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const val = { at: new Date().toISOString(), by: actorId() };
    const sh = { ...(state.logs[shift] || {}) };
    sh[id] = { ...(sh[id] || {}), [k]: val };
    state.logs = { ...state.logs, [shift]: sh };
    render();
    persistDay(state.date, { logs: { [shift]: { [id]: { [k]: val } } } });
  }
  function unlogAlways(shift, id) {
    if (state.readOnly) return;
    const list = logEntries(shift, id);
    if (!list.length) return;
    const k = list[list.length - 1].key;
    const sh = { ...(state.logs[shift] || {}) };
    sh[id] = { ...(sh[id] || {}), [k]: null };
    state.logs = { ...state.logs, [shift]: sh };
    render();
    persistDay(state.date, { logs: { [shift]: { [id]: { [k]: null } } } });
  }

  function noteAuthor(n) {
    if (!n || !n.at) return "";
    const name = personName(n.by);
    return ` · ${fmtTime(n.at)}${name ? " · " + esc(name) : ""}`;
  }
  function noteEditor(shift, label) {
    const n = state.notes[shift];
    return `<div class="note"><label for="note-${shift}">${esc(label)}</label>
      <textarea id="note-${shift}" data-note="${shift}" placeholder="z. B. offene Check-ins, defekte Schläger, Rückrufe…" ${state.readOnly ? "readonly" : ""}>${esc((n && n.text) || "")}</textarea>
      <span class="saved" id="saved-${shift}">${n && n.at ? "Gespeichert" + noteAuthor(n) : ""}</span></div>`;
  }
  function noteReader(n, label) {
    const has = n && typeof n.text === "string" && n.text.trim();
    return `<div class="note"><label>${esc(label)}${has ? noteAuthor(n) : ""}</label>
      <div class="read${has ? "" : " none"}">${has ? esc(n.text) : "Keine Notiz hinterlassen."}</div></div>`;
  }
  function handoverHtml(key) {
    return key === "frueh"
      ? noteReader(state.prevNotes.spaet, "Von der Spätschicht (gestern)") + noteEditor("frueh", "Für die Spätschicht")
      : noteReader(state.notes.frueh, "Von der Frühschicht") + noteEditor("spaet", "Für die Frühschicht morgen");
  }

  function dutyLine(date) {
    const r = rosterFor(date);
    const names = (k) => (r[k].map(personName).filter(Boolean).join(", ") || "–") + (r.notes && r.notes[k] ? ` (${r.notes[k]})` : "");
    if (!state.cfg.people.length) return `<div class="duty">Team und Dienstplan unter <b>Verwaltung</b> anlegen.</div>`;
    return `<div class="duty"><span>Dienst Früh: <b>${esc(names("frueh"))}</b></span><span>Spät: <b>${esc(names("spaet"))}</b></span></div>`;
  }

  // ---------- Schicht (eine Ansicht für Früh und Spät) ----------
  // Links der Fahrplan der gewählten Schicht, rechts Immer im Blick, Dienst und Übergabe.
  function renderSchicht() {
    const plan = P(), ctx = timeCtx(), d = derive(plan);
    const cp = currentPerson(), role = cp && state.who && ["frueh", "spaet"].includes(state.who.shift) && state.date === isoDate(new Date()) ? state.who.shift : null;
    const auto = role || focusShift(plan, ctx), key = state.shiftSel || auto, s = plan[key], meta = SHIFT_META[key];
    const MARK = { done: "✓", now: "▶", late: "!", later: "" };
    const stops = s.phases.map(p => {
      const st = phaseState(p, ctx);
      const done = p.items.filter(i => state.checks[i.id]).length;
      const collapsed = st === "done" && !state.expanded.has(p.id);
      const label = { done: "erledigt", now: "jetzt", late: "offen", later: "später" }[st];
      const head = `<span class="mark" aria-hidden="true">${MARK[st]}</span><span class="time">${p.from}–${p.to}</span><span class="ttl">${esc(p.title)}<small>${done}/${p.items.length}</small></span>${PILL[st]}`;
      const headEl = st === "done"
        ? `<button class="stop-head" data-toggle="${esc(p.id)}" aria-expanded="${!collapsed}" aria-label="${esc(p.title)}, ${label}, ${collapsed ? "aufklappen" : "zuklappen"}">${head}</button>`
        : `<div class="stop-head">${head}</div>`;
      const hint = p.hint && (st === "now" || st === "late") ? `<div class="phint">${esc(p.hint)}</div>` : "";
      const items = collapsed ? "" : `<ul class="items">${p.items.map(i => itemHtml(d.item[i.id])).join("") || '<li class="empty">Keine Aufgaben.</li>'}</ul>`;
      return `<section class="stop is-${st}" id="phase-${esc(p.id)}">${headEl}${hint}${items}</section>`;
    }).join("") || `<div class="empty">Für diese Schicht sind keine Abschnitte geplant (Verwaltung › Aufgaben-Plan).</div>`;
    const other = key === "frueh" ? "spaet" : "frueh";
    const otherOpen = plan[other].phases.filter(p => phaseState(p, ctx) === "late").reduce((n, p) => n + p.items.filter(i => !state.checks[i.id]).length, 0)
      + (typeof ctx === "number" && toMin(plan[other].end) <= ctx ? pendingConfirms(plan, other).length : 0);
    const pr = progress(plan, key, state.checks);
    const seg = KEYS.map(k => `<button class="segbtn${k === key ? " on" : ""}" data-shiftsel="${k}" aria-pressed="${k === key}">${SHIFT_META[k].short}${k === auto && typeof ctx === "number" && activeShift(plan, ctx) === k ? " ·&nbsp;jetzt" : ""}</button>`).join("");
    const title = ctx === "past" ? "Rückblick" : ctx === "future" ? "Vorschau" : "Fahrplan";
    const lay = getLayout();
    const colBtns = `<div class="seg" role="group" aria-label="Spalten im Fahrplan">${[["auto", "Auto"], ["1", "1 Spalte"], ["2", "2 Spalten"]].map(([v, l]) => `<button class="segbtn${lay.cols === v ? " on" : ""}" data-cols="${v}" aria-pressed="${lay.cols === v}">${l}</button>`).join("")}</div>`;
    return `<div class="schicht cols-${lay.cols}" style="--side:${lay.side}px">
      <section class="card boardcard">
        <div class="chead"><h2>${title} ${meta.label}</h2><span class="hint">${s.start}–${s.end} · ${pr.done}/${pr.total} erledigt</span><div class="seg" role="group" aria-label="Schicht wählen">${seg}</div>${colBtns}</div>
        <div class="bar flat"><i style="width:${pr.pct}%"></i></div>
        ${otherOpen ? `<button class="othersum" data-shiftsel="${other}">${SHIFT_META[other].label}: <b>${otherOpen} offen geblieben</b> – ansehen</button>` : ""}
        <div class="cbody board"><div class="board-in">${stops}</div></div>
      </section>
      <div class="splitter" role="separator" aria-orientation="vertical" aria-label="Spaltenbreite – ziehen oder Pfeiltasten, Doppelklick setzt zurück" tabindex="0" title="Ziehen zum Anpassen · Doppelklick = Standard"></div>
      <div class="side">
        <section class="card grow"><div class="chead"><h2>Immer im Blick</h2><span class="hint">${meta.label}</span></div><div class="cbody">${alwaysHtml(plan, key, ctx)}</div></section>
        <section class="card"><div class="chead"><h2>Dienst &amp; Übergabe</h2></div><div class="cbody">${dutyLine(state.date)}${handoverHtml(key)}</div></section>
      </div>
    </div>`;
  }

  // Spaltenaufteilung der Schicht-Ansicht, gespeichert pro Person (sonst „Standard“) im Browser-Speicher des Geräts.
  const LAYOUT_DEFAULT = { side: 460, cols: "auto" };
  const layoutKey = () => { const p = currentPerson(); return p ? p.id : "_"; };
  function getLayout() {
    const all = LS.get("rz2layout", {}), l = (all && all[layoutKey()]) || (all && all._) || {};
    const side = Number.isFinite(l.side) ? Math.min(900, Math.max(280, Math.round(l.side))) : LAYOUT_DEFAULT.side;
    return { side, cols: ["auto", "1", "2"].includes(l.cols) ? l.cols : LAYOUT_DEFAULT.cols };
  }
  function saveLayout(patch) {
    const all = LS.get("rz2layout", {}) || {}, key = layoutKey();
    all[key] = { ...getLayout(), ...patch };
    LS.set("rz2layout", all);
  }
  let drag = null;
  function startDrag(e, el) {
    const wrap = el.closest(".schicht"); if (!wrap) return;
    e.preventDefault();
    const rect = wrap.getBoundingClientRect();
    drag = { wrap, rect, side: getLayout().side };
    el.setPointerCapture && el.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const side = Math.min(rect.width - 380, Math.max(280, rect.right - ev.clientX - 6));
      drag.side = Math.round(side); wrap.style.setProperty("--side", drag.side + "px");
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      if (drag) saveLayout({ side: drag.side });
      drag = null;
      if (renderPending) render();
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  // ---------- Monat ----------
  function renderMonth() {
    const d = parseIso(state.date), y = d.getFullYear(), m = d.getMonth();
    const days = new Date(y, m + 1, 0).getDate(), today = isoDate(new Date());
    const head = Array.from({ length: days }, (_, i) => `<th scope="col">${pad(i + 1)}.</th>`).join("");
    const row = (key) => Array.from({ length: days }, (_, i) => {
      const date = `${y}-${pad(m + 1)}-${pad(i + 1)}`;
      const entry = date === state.date ? { checks: state.checks, plan: state.dayPlan } : (state.month[date] || { checks: {}, plan: null });
      const plan = resolvePlan(date, entry.plan).plan;
      const p = progress(plan, key, entry.checks || {});
      const cls = date > today && !p.done ? "future" : p.pct === 100 ? "full" : p.done ? "part" : "none";
      const text = p.done ? (p.pct === 100 ? "✓" : p.pct + "%") : "·";
      return `<td><button class="mcell ${cls}${date === state.date ? " sel" : ""}" data-date="${date}" data-shift="${key}" aria-label="${SHIFT_META[key].label} ${pad(i + 1)}.${pad(m + 1)}.: ${p.done} von ${p.total}">${text}</button></td>`;
    }).join("");
    return `<div class="monthhead">
        <button class="iconbtn" id="mprev" aria-label="Vorheriger Monat">‹</button>
        <h2>${MONTHS[m]} ${y}</h2>
        <button class="iconbtn" id="mnext" aria-label="Nächster Monat">›</button>
      </div>
      <div class="mscroll"><table class="mgrid">
        <thead><tr><th class="rowh"></th>${head}</tr></thead>
        <tbody><tr><th class="rowh" scope="row">Früh</th>${row("frueh")}</tr><tr><th class="rowh" scope="row">Spät</th>${row("spaet")}</tr></tbody>
      </table></div>
      <div class="legend"><span><i class="lg-full"></i>vollständig</span><span><i class="lg-part"></i>teilweise</span><span>Tippe auf einen Tag, um ihn zu öffnen.</span></div>`;
  }

  // ---------- Dienstplan ----------
  function mondayOf(iso) { const d = parseIso(iso); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return isoDate(d); }
  function renderRoster() {
    const ym = state.rosterMonth || state.date.slice(0, 7);
    const [y, m] = ym.split("-").map(Number);
    const first = new Date(y, m - 1, 1), daysIn = new Date(y, m, 0).getDate(), lead = (first.getDay() + 6) % 7;
    const today = isoDate(new Date()), edit = state.rosterEdit && isUnlocked();
    const line = (entry, k) => {
      const names = entry[k].map(personName).filter(Boolean).join(", ");
      const note = entry.notes && entry.notes[k] ? ` <em>${esc(entry.notes[k])}</em>` : "";
      return `<div class="rl"><b>${k === "frueh" ? "F" : "S"}</b><span class="${names ? "" : "gap"}">${names ? esc(names) : "–"}${note}</span></div>`;
    };
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(`<div class="rc blank"></div>`);
    for (let day = 1; day <= daysIn; day++) {
      const date = `${ym}-${pad(day)}`, entry = rosterFor(date), wd = new Date(y, m - 1, day).getDay();
      const cls = ["rc", date === today ? "today" : "", wd === 0 || wd === 6 ? "we" : "", date === state.date ? "sel" : ""].join(" ");
      const inner = `<div class="rd">${day}.</div>${line(entry, "frueh")}${line(entry, "spaet")}`;
      cells.push(edit ? `<button class="${cls}" data-rday="${date}" aria-label="${day}. bearbeiten">${inner}</button>` : `<div class="${cls}">${inner}</div>`);
    }
    const dayEditor = edit && state.rosterDay ? (() => {
      const date = state.rosterDay, entry = rosterFor(date), dd = parseIso(date);
      const chips = (k) => state.cfg.people.map(p => `<button class="chip${entry[k].includes(p.id) ? "" : " off"}" data-roster="${date}" data-shift="${k}" data-pid="${esc(p.id)}" aria-pressed="${entry[k].includes(p.id)}">${esc(p.name)}</button>`).join("") || '<span class="empty">Kein Team angelegt</span>';
      return `<div class="overlay inmain" role="dialog" aria-modal="true"><div class="dialog">
        <h2>${WD[dd.getDay()]}, ${pad(dd.getDate())}.${pad(dd.getMonth() + 1)}.</h2>
        ${KEYS.map(k => `<div class="grp">${SHIFT_META[k].label}${entry.times && entry.times[k] ? " · " + esc(entry.times[k].replace("-", "–")) : ""}${entry.notes && entry.notes[k] ? " · " + esc(entry.notes[k]) : ""}</div><div class="cell">${chips(k)}</div>`).join("")}
        <div class="row"><button class="btn primary" data-act2="rday-close">Fertig</button></div>
      </div></div>`;
    })() : "";
    return `<div class="monthhead">
        <button class="iconbtn" id="mrprev" aria-label="Vorheriger Monat">‹</button>
        <h2>Dienstplan ${MONTHS[m - 1]} ${y}</h2>
        <button class="iconbtn" id="mrnext" aria-label="Nächster Monat">›</button>
        ${edit ? `<label class="btn" style="cursor:pointer">Monatsplan einlesen (PDF/Excel)<input type="file" id="planfile" accept=".pdf,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></label><button class="btn primary" data-act2="roster-done">Fertig</button>`
               : `<button class="btn" data-act2="roster-edit">Bearbeiten</button>`}
      </div>
      ${edit ? renderImportPreview() : ""}
      <div class="rcal">${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(w => `<div class="rh">${w}</div>`).join("")}${cells.join("")}</div>
      <div class="legend">${edit ? "Tag antippen, um die Einteilung zu ändern." : "F = Frühschicht, S = Spätschicht. Bearbeiten braucht die Leitungs-PIN."}</div>
      ${dayEditor}`;
  }
  function toggleRoster(date, shift, pid) {
    const cur = rosterFor(date);
    const ids = cur[shift].includes(pid) ? cur[shift].filter(x => x !== pid) : [...cur[shift], pid];
    const entry = { ...cur, [shift]: ids };
    state.cfg = { ...state.cfg, roster: { ...state.cfg.roster, [date]: entry } };
    render();
    persistCfg({ roster: { [date]: entry } });
  }

  // ---------- Monats-Arbeitsplan einlesen (PDF oder Excel) ----------
  // Aufbau (Kopfzeile): OKT | Tag | Vormittags | Uhrzeit | Anmerkung | Nachmittags/Abends | Uhrzeit | Anmerkung.
  // Pro Tag stehen die Namen in „Vormittags“ bzw. „Nachmittags/Abends“. Anmerkungen werden nur angezeigt.
  // Zuordnung über die Spaltenposition der Kopfzeile (PDF: x-Koordinate, Excel: Spaltenbuchstabe).
  const MONTH_NAMES = ["jan", "feb", "mär|mar|maer", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "dez"];
  const PDFJS = opts.pdfjsUrl || (NATIVE && NATIVE.pdfjsUrl) || "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs";
  const TIME_RANGE = /(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})/;
  async function unzipEntries(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf);
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("Keine gültige Excel-Datei");
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const out = {};
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + xlen + clen;
      if (!/^xl\/(sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/.test(name)) continue;
      const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
      const data = u8.subarray(start, start + csize);
      if (method === 0) out[name] = new TextDecoder().decode(data);
      else if (method === 8) out[name] = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
    }
    return out;
  }
  // Ergebnis beider Leser: Zeilen als Liste von { pos, text } (pos = Spaltennummer bzw. x-Koordinate).
  async function xlsxRows(file) {
    const files = await unzipEntries(await file.arrayBuffer());
    const xml = (t) => new DOMParser().parseFromString(t, "application/xml");
    const shared = files["xl/sharedStrings.xml"] ? [...xml(files["xl/sharedStrings.xml"]).getElementsByTagName("si")].map(si => [...si.getElementsByTagName("t")].map(t => t.textContent).join("")) : [];
    const sheetName = Object.keys(files).filter(n => n.startsWith("xl/worksheets/")).sort()[0];
    if (!sheetName) throw new Error("Kein Tabellenblatt gefunden");
    const colNum = (ref) => { let n = 0; for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + ch.charCodeAt(0) - 64; return n; };
    const rows = [];
    for (const r of xml(files[sheetName]).getElementsByTagName("row")) {
      const cells = [];
      for (const c of r.getElementsByTagName("c")) {
        const v = c.getElementsByTagName("v")[0], is = c.getElementsByTagName("is")[0], t = c.getAttribute("t");
        let val = t === "s" && v ? shared[Number(v.textContent)] : t === "inlineStr" && is ? is.textContent : v ? v.textContent : "";
        if (!t && val && /^0?\.\d+$/.test(val)) { const m = Math.round(Number(val) * 1440); val = `${Math.floor(m / 60)}:${pad(m % 60)}`; }
        val = String(val ?? "").trim();
        if (val) cells.push({ pos: colNum(c.getAttribute("r") || "A"), text: val });
      }
      rows.push(cells);
    }
    return { rows, tolerance: 0 };
  }
  async function pdfRows(file) {
    let lib;
    try { lib = await import(/* webpackIgnore: true */ PDFJS); }
    catch { throw new Error("PDF-Leser konnte nicht geladen werden (Internet bzw. in SharePoint die Freigabe für cdn.jsdelivr.net nötig). Excel-Datei funktioniert immer."); }
    lib.GlobalWorkerOptions.workerSrc = PDFJS.replace(/pdf\.min\.mjs$/, "pdf.worker.min.mjs");
    const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const rows = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const items = (await (await doc.getPage(i)).getTextContent()).items.filter(it => it.str && it.str.trim());
      const lines = [];
      for (const it of items) {
        const y = it.transform[5];
        let line = lines.find(l => Math.abs(l.y - y) < 3);
        if (!line) { line = { y, cells: [] }; lines.push(line); }
        line.cells.push({ pos: it.transform[4], text: it.str.trim() });
      }
      lines.sort((a, b) => b.y - a.y).forEach(l => rows.push(l.cells.sort((a, b) => a.pos - b.pos)));
    }
    return { rows, tolerance: 6 };
  }
  // Kopfzeile suchen und Spalten bestimmen.
  function findColumns(rows) {
    for (let i = 0; i < rows.length; i++) {
      const cells = rows[i];
      const iE = cells.findIndex(c => /vormit/i.test(c.text)), iL = cells.findIndex(c => /nachmit/i.test(c.text));
      if (iE < 0 || iL < 0) continue;
      const cols = { header: i, month: cells[0] ? cells[0].text : "" };
      const after = (from, re) => cells.findIndex((c, j) => j > from && re.test(c.text));
      cols.day = (cells.find(c => /^tag$/i.test(c.text)) || {}).pos;
      cols.nameE = cells[iE].pos; cols.nameL = cells[iL].pos;
      const tE = after(iE, /uhrzeit|zeit/i), nE = after(iE, /anmerk|notiz|bemerk/i);
      const tL = after(iL, /uhrzeit|zeit/i), nL = after(iL, /anmerk|notiz|bemerk/i);
      // Steht „Uhrzeit/Anmerkung“ des Nachmittags in einer zweiten Kopfzeile (umbrochener Text), dort suchen.
      const next = rows[i + 1] || [];
      const pick = (idx, re, minPos) => idx >= 0 ? cells[idx].pos : (next.find(c => re.test(c.text) && c.pos >= minPos) || {}).pos;
      cols.timeE = pick(tE >= 0 && (iL < 0 || tE < iL) ? tE : -1, /uhrzeit|zeit/i, cols.nameE);
      cols.noteE = pick(nE >= 0 && nE < iL ? nE : -1, /anmerk|notiz|bemerk/i, cols.nameE);
      cols.timeL = pick(tL, /uhrzeit|zeit/i, cols.nameL);
      cols.noteL = pick(nL, /anmerk|notiz|bemerk/i, cols.nameL);
      return cols;
    }
    return null;
  }
  function parsePlan(data) {
    const cols = findColumns(data.rows);
    if (!cols) throw new Error("Kopfzeile mit „Vormittags“ und „Nachmittags“ nicht gefunden.");
    // Spaltengrenzen: jede Zelle gehört zur Kopf-Spalte mit der größten Startposition ≤ Zellposition.
    const bounds = Object.entries({ day: cols.day, nameE: cols.nameE, timeE: cols.timeE, noteE: cols.noteE, nameL: cols.nameL, timeL: cols.timeL, noteL: cols.noteL })
      .filter(([, v]) => typeof v === "number").sort((a, b) => a[1] - b[1]);
    const colOf = (pos) => { let k = null; for (const [key, x] of bounds) if (pos + data.tolerance >= x) k = key; return k; };
    const out = [], seen = new Set();
    for (const cells of data.rows.slice(cols.header + 1)) {
      const rec = {};
      for (const c of cells) {
        let key = colOf(c.pos);
        // Name, der in die Uhrzeit-Spalte ragt („Nelson 15:30-23:00“): am Uhrzeit-Anfang trennen.
        if (key === "nameE" || key === "nameL" || key === "timeE" || key === "timeL") {
          const m = c.text.match(TIME_RANGE);
          if (m && m.index > 0) { const nk = key.endsWith("E") ? "nameE" : "nameL"; rec[nk] = ((rec[nk] || "") + " " + c.text.slice(0, m.index)).trim(); rec[nk === "nameE" ? "timeE" : "timeL"] = c.text.slice(m.index); continue; }
        }
        if (!key) { if (/^\d{1,2}$/.test(c.text) && rec.day === undefined) key = "day"; else continue; }
        rec[key] = ((rec[key] || "") + " " + c.text).trim();
      }
      const day = parseInt(rec.day, 10);
      if (!(day >= 1 && day <= 31) || seen.has(day)) continue;
      seen.add(day);
      const time = (t) => { const m = (t || "").match(TIME_RANGE); return m ? `${pad(Number(m[1]))}:${m[2]}-${pad(Number(m[3]))}:${m[4]}` : null; };
      const names = (t) => (t || "").split(/\s*(?:[,/&]|\bund\b)\s*/i).map(x => x.trim()).filter(x => x && !/^[-–]$/.test(x));
      const note = (t) => (t || "").replace(/^[`´'\s]+/, "").trim();
      out.push({ day, early: names(rec.nameE), late: names(rec.nameL), tEarly: time(rec.timeE), tLate: time(rec.timeL), noteEarly: note(rec.noteE), noteLate: note(rec.noteL) });
    }
    if (!out.length) throw new Error("In der Datei wurden keine Tageszeilen gefunden.");
    return { entries: out.sort((a, b) => a.day - b.day), monthHint: cols.month };
  }
  function guessMonth(text) {
    const t = String(text || "").toLowerCase();
    for (let i = 0; i < 12; i++) if (new RegExp("(^|[^a-zäöü])(" + MONTH_NAMES[i] + ")").test(t)) return i;
    return null;
  }
  const findPerson = (name) => {
    const lc = name.toLowerCase();
    return state.cfg.people.find(p => p.name.toLowerCase() === lc) || state.cfg.people.find(p => p.name.toLowerCase().split(/\s+/)[0] === lc);
  };
  async function readPlanFile(file) {
    const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
    const { entries, monthHint } = parsePlan(isPdf ? await pdfRows(file) : await xlsxRows(file));
    const now = new Date();
    const month = guessMonth(monthHint) ?? guessMonth(file.name) ?? now.getMonth();
    let year = now.getFullYear();
    if (month - now.getMonth() > 6) year--; else if (now.getMonth() - month > 6) year++;
    const all = [...new Set(entries.flatMap(e => [...e.early, ...e.late]))];
    return { fileName: file.name, entries, month, year, unknown: all.filter(n => !findPerson(n)) };
  }
  function renderImportPreview() {
    const ip = state.importPreview;
    if (!ip) return "";
    if (ip.error) return `<section class="card imp"><div class="chead"><h2>Arbeitsplan einlesen</h2></div><div class="cbody"><p class="err">${esc(ip.error)}</p><div class="row"><button class="btn" data-act2="import-cancel">Schließen</button></div></div></section>`;
    const daysIn = new Date(ip.year, ip.month + 1, 0).getDate();
    const valid = ip.entries.filter(e => e.day <= daysIn);
    const cell = (names, t, note) => `<td class="${names.length ? "on" : "gap"}">${names.length ? esc(names.join(", ")) : "unbesetzt"}${t ? `<span class="t">${esc(t.replace("-", "–"))}</span>` : ""}${note ? `<small>${esc(note)}</small>` : ""}</td>`;
    const rowsHtml = valid.map(e => {
      const d = new Date(ip.year, ip.month, e.day);
      return `<tr><th>${WD[d.getDay()].slice(0, 2)} ${pad(e.day)}.</th>${cell(e.early, e.tEarly, e.noteEarly)}${cell(e.late, e.tLate, e.noteLate)}</tr>`;
    }).join("");
    const gaps = valid.reduce((n, e) => n + (e.early.length ? 0 : 1) + (e.late.length ? 0 : 1), 0);
    return `<section class="card imp"><div class="chead"><h2>Monatsplan einlesen</h2><span class="hint">${esc(ip.fileName)}</span></div>
      <div class="cbody">
        <div class="impform">
          <label>Monat <select id="imp-month">${MONTHS.map((m, i) => `<option value="${i}"${i === ip.month ? " selected" : ""}>${m}</option>`).join("")}</select></label>
          <label>Jahr <input class="in time" id="imp-year" value="${ip.year}" inputmode="numeric" maxlength="4"></label>
        </div>
        <p>${valid.length} Tage erkannt${gaps ? ` · ${gaps} Schichten unbesetzt` : ""}. Beim Übernehmen ersetzt der Plan die Einteilung dieser Tage komplett, ebenso Schichtzeiten und Anmerkungen. Anmerkungen werden nur angezeigt.</p>
        ${ip.unknown.length ? `<p class="new">Neu im Team (werden angelegt): <b>${ip.unknown.map(esc).join(", ")}</b></p>` : ""}
        <div class="impscroll"><table class="imptab"><thead><tr><th></th><th>Vormittags</th><th>Nachmittags/Abends</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
        <div class="row"><button class="btn ghost" data-act2="import-cancel">Abbrechen</button><button class="btn primary" data-act2="import-apply">Übernehmen</button></div>
      </div></section>`;
  }
  async function applyImport() {
    const ip = state.importPreview;
    if (!ip || ip.error) return;
    // Unbekannte Namen als Teammitglieder anlegen.
    let people = state.cfg.people;
    const ids = {};
    for (const n of new Set(ip.entries.flatMap(e => [...e.early, ...e.late]))) {
      const p = findPerson(n) || people.find(x => x.name.toLowerCase() === n.toLowerCase());
      if (p) ids[n] = p.id;
      else { const np = { id: newId("u"), name: n.slice(0, 40) }; people = [...people, np]; ids[n] = np.id; }
    }
    if (people !== state.cfg.people) { state.cfg = { ...state.cfg, people }; await persistCfg({ people }); }
    const daysIn = new Date(ip.year, ip.month + 1, 0).getDate();
    const roster = { ...state.cfg.roster }, patch = {};
    for (const e of ip.entries) {
      if (e.day > daysIn) continue;
      const date = `${ip.year}-${pad(ip.month + 1)}-${pad(e.day)}`;
      const entry = { frueh: e.early.map(n => ids[n]), spaet: e.late.map(n => ids[n]) };
      const times = {}, notes = {};
      if (e.tEarly) times.frueh = e.tEarly;
      if (e.tLate) times.spaet = e.tLate;
      if (e.noteEarly) notes.frueh = e.noteEarly;
      if (e.noteLate) notes.spaet = e.noteLate;
      if (Object.keys(times).length) entry.times = times;
      if (Object.keys(notes).length) entry.notes = notes;
      roster[date] = entry;
      // Monatsplan ersetzt den Tag komplett. null löscht alte Felder beim Zusammenführen in SharePoint.
      patch[date] = { frueh: entry.frueh, spaet: entry.spaet, info: null,
        times: { frueh: times.frueh || null, spaet: times.spaet || null },
        notes: { frueh: notes.frueh || null, spaet: notes.spaet || null } };
    }
    state.cfg = { ...state.cfg, roster };
    state.importPreview = null;
    state.rosterMonth = `${ip.year}-${pad(ip.month + 1)}`;
    state.rosterEdit = false;
    render();
    const ok = await persistCfg({ roster: patch });
    setStatus(ok ? `Monatsplan ${MONTHS[ip.month]} ${ip.year} übernommen` : "Monatsplan konnte nicht gespeichert werden", !ok);
  }
  async function onPlanFile(file) {
    setStatus("Lese " + file.name + " …");
    try { state.importPreview = await readPlanFile(file); setStatus(statusLine()); }
    catch (e) { state.importPreview = { fileName: file.name, error: (e && e.message) || "Datei konnte nicht gelesen werden" }; }
    render();
  }



  // ---------- Leitungsbereich (PIN) ----------
  // Einfacher Schutz gegen versehentliche Änderungen auf dem Gemeinschaftsrechner – keine echte Zugriffskontrolle.
  function pinHash(pin) {
    let h = 0x811c9dc5;
    for (const ch of "rezeption:" + pin) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return "f1:" + h.toString(16);
  }
  const isUnlocked = () => Date.now() < state.unlockedUntil;
  function requireAdmin(next) {
    if (isUnlocked()) { state.unlockedUntil = Date.now() + 10 * 60000; return true; }
    state.pinStage = { mode: state.cfg.adminPin ? "unlock" : "set", next };
    state.view = "pin";
    render();
    setTimeout(() => { const el = $("pin-in"); if (el) el.focus(); }, 0);
    return false;
  }
  function renderPin() {
    const st = state.pinStage || { mode: "unlock" };
    const title = st.mode === "set" ? (st.first ? "PIN wiederholen" : "Leitungs-PIN festlegen") : "Leitungs-PIN";
    const text = st.mode === "set" ? "Diese PIN schützt Team, Dienstplan und Aufgaben-Plan vor Änderungen. Mindestens 4 Ziffern." : "Nur für die Schichtleitung.";
    return `<form class="pinform" id="pinform">
      <h2>${title}</h2><p>${text}</p>
      <input class="in" id="pin-in" type="password" inputmode="numeric" autocomplete="off" maxlength="8" aria-label="PIN">
      <button class="btn primary" type="submit">${st.mode === "set" && !st.first ? "Weiter" : "Entsperren"}</button>
      <button class="btn ghost" type="button" data-act2="pin-cancel">Abbrechen</button>
      <p id="pin-msg"></p>
    </form>`;
  }
  // Render wird während einer Eingabe aufgeschoben – bei Formular-Aktionen deshalb erst den Fokus lösen.
  function blurActive() { const a = root.activeElement; if (a && a.blur) a.blur(); }
  async function submitPin(val) {
    const st = state.pinStage, msg = $("pin-msg");
    blurActive();
    if (!/^\d{4,8}$/.test(val)) { if (msg) msg.textContent = "Bitte 4 bis 8 Ziffern eingeben."; return; }
    if (st.mode === "set") {
      if (!st.first) { state.pinStage = { ...st, first: val }; render(); setTimeout(() => { const el = $("pin-in"); if (el) el.focus(); }, 0); return; }
      if (st.first !== val) { state.pinStage = { ...st, first: null }; render(); setTimeout(() => { const m2 = $("pin-msg"); if (m2) m2.textContent = "Die PINs stimmen nicht überein. Bitte neu festlegen."; }, 0); return; }
      state.cfg = { ...state.cfg, adminPin: pinHash(val) };
      await persistCfg({ adminPin: state.cfg.adminPin });
    } else if (pinHash(val) !== state.cfg.adminPin) {
      if (msg) msg.textContent = "PIN falsch.";
      const el = $("pin-in"); if (el) { el.value = ""; el.focus(); }
      return;
    }
    state.unlockedUntil = Date.now() + 10 * 60000;
    const next = st.next || "admin";
    state.pinStage = null;
    if (next === "dienst-edit") { state.view = "dienst"; state.rosterEdit = true; }
    else if (next === "zeiten-all") { state.view = "zeiten"; state.timesAll = true; state.timesPerson = ""; }
    else state.view = next;
    render();
  }

  // ---------- Verwaltung ----------
  function backupHint() {
    if (state.mode !== "local") return "";
    const last = LS.get("rz2meta", {}).lastBackup;
    const days = last ? Math.floor((Date.now() - new Date(last)) / 86400000) : null;
    if (FS_OK && !backupDir && !NATIVE) return "Sicherungsordner fehlt (Verwaltung)";
    if (days === null) return "Noch keine Sicherung (Verwaltung)";
    return days >= 7 ? `Sicherung ${days} Tage alt (Verwaltung)` : "";
  }
  function renderAdmin() {
    const people = state.cfg.people.map((p, i) => `<li>
        <input class="in" id="pp-${esc(p.id)}" data-person="${esc(p.id)}" value="${esc(p.name)}" maxlength="40" aria-label="Name">
        ${state.confirm === "p:" + p.id ? `<button class="mini del confirm" data-act2="person-del" data-pid="${esc(p.id)}">Löschen?</button>` : `<button class="mini del" data-act2="person-del" data-pid="${esc(p.id)}" aria-label="Entfernen">✕</button>`}
      </li>`).join("");
    const last = LS.get("rz2meta", {}).lastBackup;
    return `<div class="admin">
      <section class="card"><div class="chead"><h2>Team</h2><span class="hint">${state.cfg.people.length} Personen</span></div>
        <div class="cbody">
          <ul class="people">${people || "<p>Noch niemand angelegt.</p>"}</ul>
          <form id="addperson" class="people"><li><input class="in" id="newperson" maxlength="40" placeholder="Name, z. B. Lisa" aria-label="Neuer Name"><button class="btn" type="submit">Hinzufügen</button></li></form>
          <p>Namen erscheinen bei der Auswahl zu Schichtbeginn und im Dienstplan. Entfernte Personen bleiben in alten Einträgen als Kürzel unsichtbar.</p>
        </div></section>
      <section class="card"><div class="chead"><h2>Aufgaben &amp; Zeiten</h2></div>
        <div class="cbody"><p>Abschnitte, Uhrzeiten, Reihenfolge und Daueraufgaben – für einen Tag, einen Wochentag oder als Standard.</p>
          <button class="btn primary" data-act2="open-plan">Aufgaben-Plan bearbeiten</button>
          <button class="btn" data-act2="open-roster">Dienstplan bearbeiten</button>
          <button class="btn" data-act2="open-month">Monatsstatistik</button></div></section>
      ${state.mode === "local" ? `<section class="card"><div class="chead"><h2>Datensicherung</h2></div>
        <div class="cbody">${NATIVE ? `<p>Die Daten liegen in der App auf diesem Mac. Bei jedem Schichtbeginn und zum Tagesabschluss legt die App automatisch eine Sicherung ab – „rezeption-sicherung-aktuell.json“ und eine Datei pro Tag.</p>
          <p>Ordner: <b>${esc((nativeInfo && nativeInfo.backupDir) || "Dokumente/Rezeption Sicherungen")}</b></p>
          <button class="btn primary" data-act2="backup-now">Jetzt sichern</button>
          <button class="btn" data-act2="backup-open">Ordner im Finder zeigen</button>
          <label class="check-inline"><input type="checkbox" id="autostart" ${nativeInfo && nativeInfo.autoStart ? "checked" : ""}> Beim Anmelden am Mac automatisch starten</label>` : `<p>Alles liegt im Browser dieses Macs. Wird der Browserverlauf mit „Website-Daten“ gelöscht, ist es weg. Sichere deshalb regelmäßig.</p>
          ${FS_OK ? (backupDir
            ? `<p>Sicherungsordner: <b>${esc(backupDir.name)}</b>. Gesichert wird bei jedem Schichtbeginn und wenn der letzte Punkt der Spätschicht abgehakt ist – als „rezeption-sicherung-aktuell.json“ und eine Datei pro Tag.</p>
               <button class="btn primary" data-act2="backup-now">Jetzt sichern</button>
               <button class="btn" data-act2="backup-dir">Anderen Ordner wählen</button>
               <button class="btn ghost danger" data-act2="backup-forget">Ordner trennen</button>`
            : `<p>Wähle einmal den per OneDrive synchronisierten SharePoint-Ordner. Danach sichert die App automatisch dorthin – andere Downloads bleiben, wo sie sind.</p>
               <button class="btn primary" data-act2="backup-dir">Sicherungsordner wählen</button>
               <button class="btn" data-act2="export">Einmalig herunterladen</button>`)
          : `<p>Dieser Browser kann nicht direkt in einen Ordner schreiben. Bitte Google Chrome verwenden.</p>
             <button class="btn" data-act2="export">Einmalig herunterladen</button>`}`}
          <p>Letzte Sicherung: <b>${last ? new Date(last).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "noch nie"}</b></p>
          <label class="btn" style="text-align:center;cursor:pointer">Sicherung einspielen<input type="file" id="importfile" accept="application/json,.json" hidden></label>
          <p id="import-msg"></p></div></section>` : opts.mode === "sharepoint" ? `<section class="card"><div class="chead"><h2>Datenspeicher</h2></div>
        <div class="cbody"><p>Alle Daten liegen in der SharePoint-Bibliothek <b>${esc(opts.library || "RezeptionDaten")}</b> dieser Website. SharePoint speichert jede Änderung im Versionsverlauf – ein früherer Stand lässt sich dort wiederherstellen.</p>
          <p>Daten aus der bisherigen Mac-Version übernehmen: dort unter Verwaltung › Datensicherung eine Sicherung herunterladen und hier einspielen.</p>
          <label class="btn" style="text-align:center;cursor:pointer">Sicherung übernehmen<input type="file" id="importfile" accept="application/json,.json" hidden></label>
          <p id="import-msg"></p></div></section>` : ""}
      <section class="card"><div class="chead"><h2>Leitungs-PIN</h2></div>
        <div class="cbody"><p>Entsperrt für 10 Minuten nach der letzten Aktion.</p>
          <button class="btn" data-act2="pin-change">PIN ändern</button>
          <button class="btn ghost" data-act2="lock">Jetzt sperren</button></div></section>
    </div>`;
  }
  function addPerson(name) {
    name = name.trim().slice(0, 40);
    if (!name) return;
    if (state.cfg.people.some(p => p.name.toLowerCase() === name.toLowerCase())) { setStatus(`„${name}“ gibt es schon`, true); return; }
    blurActive();
    const people = [...state.cfg.people, { id: newId("u"), name }];
    state.cfg = { ...state.cfg, people };
    render();
    persistCfg({ people });
    setTimeout(() => { const el = $("newperson"); if (el) el.focus(); }, 0);
  }
  function renamePerson(id, name) {
    name = name.trim().slice(0, 40);
    if (!name) return;
    const people = state.cfg.people.map(p => p.id === id ? { ...p, name } : p);
    state.cfg = { ...state.cfg, people };
    persistCfg({ people });
  }
  function deletePerson(id) {
    if (state.confirm !== "p:" + id) { state.confirm = "p:" + id; render(); return; }
    state.confirm = null;
    const people = state.cfg.people.filter(p => p.id !== id);
    state.cfg = { ...state.cfg, people };
    render();
    persistCfg({ people });
  }
  // ---------- Sicherung in einen gewählten Ordner (Chrome: File System Access API) ----------
  // Der Ordner-Zugriff wird in IndexedDB gemerkt. Chrome fragt ggf. nach – dafür muss die Sicherung aus einem Klick starten.
  const FS_OK = typeof window.showDirectoryPicker === "function";
  let nativeInfo = null; // Mac-App: { backupDir, autoStart }
  let backupDir = null;
  const idb = {
    open() {
      return new Promise((res, rej) => {
        const r = indexedDB.open("rz2fs", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("h");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    },
    async get(k) { const d = await this.open(); return new Promise((res, rej) => { const q = d.transaction("h").objectStore("h").get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); }); },
    async set(k, v) { const d = await this.open(); return new Promise((res, rej) => { const t = d.transaction("h", "readwrite"); if (v === null) t.objectStore("h").delete(k); else t.objectStore("h").put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); },
  };
  async function loadBackupDir() {
    try { backupDir = await idb.get("backupDir"); } catch { backupDir = null; }
    if (state.view === "admin") render();
  }
  async function chooseBackupDir() {
    if (!FS_OK) return;
    try {
      const h = await window.showDirectoryPicker({ id: "rezeption-sicherung", mode: "readwrite" });
      backupDir = h;
      await idb.set("backupDir", h);
      const ok = await writeBackup("manual");
      setStatus(ok ? `Sicherungsordner „${h.name}“ eingerichtet` : "Ordner gewählt, aber kein Schreibzugriff", !ok);
    } catch (e) {
      if (!(e && e.name === "AbortError")) setStatus("Ordner konnte nicht gewählt werden", true);
    }
    render();
  }
  async function forgetBackupDir() {
    backupDir = null;
    try { await idb.set("backupDir", null); } catch { /* egal */ }
    render();
  }
  function backupPayload() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith("rz2") && k !== "rz2who") data[k] = localStorage.getItem(k); }
    return JSON.stringify({ app: "rezeption-schichtcheck", version: 1, exportedAt: new Date().toISOString(), data }, null, 1);
  }
  async function writeFile(dir, name, text) {
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(text);
    await w.close();
  }
  // Schreibt „…-aktuell.json“ (immer neuester Stand) und „…-JJJJ-MM-TT.json“ (eine Datei pro Tag, wird überschrieben).
  // reason: "manual" | "shift" (Schichtbeginn) | "day" (Tagesabschluss)
  async function writeBackup(reason) {
    if (state.mode !== "local" || (!backupDir && !NATIVE)) return false;
    let text;
    try { text = backupPayload(); } catch { setStatus("Browser-Speicher blockiert", true); return false; }
    if (NATIVE) {
      // Mac-App: schreibt ohne Rückfrage nach ~/Dokumente/Rezeption Sicherungen.
      const now = new Date();
      try {
        const r = await NATIVE.saveBackup(text, isoDate(now));
        if (!r || !r.ok) throw new Error((r && r.error) || "Fehler");
        if (r.dir) nativeInfo = { ...(nativeInfo || {}), backupDir: r.dir };
        LS.set("rz2meta", { ...LS.get("rz2meta", {}), lastBackup: now.toISOString(), ...(reason === "day" ? { lastDayBackup: isoDate(now) } : {}) });
        setStatus(`Gesichert ${fmtMin(now.getHours() * 60 + now.getMinutes())}${reason === "day" ? " (Tagesabschluss)" : ""}`);
        if (state.view === "admin") render();
        return true;
      } catch (e) { setStatus("Sicherung fehlgeschlagen: " + ((e && e.message) || "Fehler"), true); return false; }
    }
    try {
      let perm = backupDir.queryPermission ? await backupDir.queryPermission({ mode: "readwrite" }) : "granted";
      if (perm !== "granted" && backupDir.requestPermission) perm = await backupDir.requestPermission({ mode: "readwrite" });
      if (perm !== "granted") { setStatus("Sicherung übersprungen – Ordnerzugriff nicht erlaubt (Verwaltung)", true); return false; }
      const now = new Date();
      await writeFile(backupDir, `rezeption-sicherung-${isoDate(now)}.json`, text);
      await writeFile(backupDir, "rezeption-sicherung-aktuell.json", text);
      LS.set("rz2meta", { ...LS.get("rz2meta", {}), lastBackup: now.toISOString(), ...(reason === "day" ? { lastDayBackup: isoDate(now) } : {}) });
      setStatus(`Gesichert ${fmtMin(now.getHours() * 60 + now.getMinutes())}${reason === "day" ? " (Tagesabschluss)" : ""}`);
      if (state.view === "admin") render();
      return true;
    } catch {
      setStatus("Sicherung fehlgeschlagen – Ordner prüfen (Verwaltung › Datensicherung)", true);
      return false;
    }
  }
  // Manuell ohne Ordner: einmaliger Download in den normalen Download-Ordner.
  function downloadBackup() {
    let text;
    try { text = backupPayload(); } catch { setStatus("Browser-Speicher blockiert", true); return; }
    const now = new Date();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.download = `rezeption-sicherung-${isoDate(now)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    LS.set("rz2meta", { ...LS.get("rz2meta", {}), lastBackup: now.toISOString() });
    setStatus("Sicherung heruntergeladen");
    render();
  }
  // Automatisch nur mit eingerichtetem Ordner: bei jedem Schichtbeginn und einmal zum Tagesabschluss.
  function autoBackup(reason) {
    if (state.mode !== "local" || (!backupDir && !NATIVE)) return;
    if (reason === "day" && LS.get("rz2meta", {}).lastDayBackup === isoDate(new Date())) return;
    writeBackup(reason);
  }
  // Übernimmt eine lokale Sicherung (localStorage-Schlüssel) in den geteilten Speicher (SharePoint).
  async function migrateToShared(entries, msg) {
    const docs = [];
    for (const [k, v] of entries) {
      let val; try { val = JSON.parse(v); } catch { continue; }
      if (!val || typeof val !== "object") continue;
      if (k === "rz2cfg") docs.push(["config/plan", val, true]);
      else if (/^rz2:\d{4}-\d{2}-\d{2}$/.test(k)) docs.push(["days/" + k.slice(4), { ...val, month: k.slice(4, 11) }]);
    }
    if (!docs.length) { if (msg) msg.textContent = "Die Sicherung enthält keine Daten."; return; }
    let done = 0;
    // Leere Felder (kein Team, kein Dienstplan, keine PIN) überschreiben vorhandene Einstellungen nicht.
    const prune = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && !v.length) && !(typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length)));
    for (const [path, val, mergeCfg] of docs) {
      try {
        const ref = db.doc(path);
        const cur = mergeCfg ? await ref.get() : null;
        if (cur && cur.exists) await ref.update(prune(val)); else await ref.set(val);
        done++;
      } catch (e) { if (msg) msg.textContent = `Abbruch bei ${path}: ${(e && e.message) || "Fehler"}. ${done} von ${docs.length} übernommen.`; return; }
      if (msg) msg.textContent = `Übernehme… ${done}/${docs.length}`;
    }
    if (msg) msg.textContent = `${done} Einträge übernommen.`;
    subscribeMonth(true); subscribeDay();
  }
  function importBackup(file) {
    const msg = $("import-msg");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result));
        if (!obj || obj.app !== "rezeption-schichtcheck" || !obj.data || typeof obj.data !== "object") throw new Error("format");
        const entries = Object.entries(obj.data).filter(([k, v]) => k.startsWith("rz2") && typeof v === "string");
        if (!entries.length) throw new Error("leer");
        if (state.mode === "shared") { migrateToShared(entries, msg); return; }
        for (const [k, v] of entries) localStorage.setItem(k, v);
        if (msg) msg.textContent = `${entries.length} Einträge eingespielt. Seite lädt neu…`;
        setTimeout(() => location.reload(), 800);
      } catch {
        if (msg) msg.textContent = "Diese Datei ist keine gültige Sicherung dieser App.";
      }
    };
    reader.onerror = () => { if (msg) msg.textContent = "Datei konnte nicht gelesen werden."; };
    reader.readAsText(file);
  }

  // ---------- Namensauswahl ----------
  function openPicker(force) {
    if (!force && Date.now() < state.pickerSnoozeUntil) return;
    state.pickerOpen = true;
    renderPicker();
  }
  function renderPicker() {
    const el = $("picker");
    if (!state.pickerOpen) { state.checkin = null; el.hidden = true; el.innerHTML = ""; return; }
    if (state.checkin) return renderCheckin();
    const today = isoDate(new Date()), plan = resolvePlan(today, state.date === today ? state.dayPlan : null).plan;
    const shift = focusShift(plan, nowMin());
    const sched = rosterFor(today)[shift];
    const people = state.cfg.people;
    const info = rosterFor(today).info || {};
    const btn = (p, cls) => `<button class="namebtn ${cls}" data-pick="${esc(p.id)}"><span class="av">${esc(initials(p.name))}</span><span>${esc(p.name)}${info[p.id] ? `<small class="ninfo">${esc(info[p.id])}</small>` : ""}</span></button>`;
    const checked = people.filter(p => openEntry(today, p.id));
    const inSched = people.filter(p => sched.includes(p.id) && !checked.includes(p)), others = people.filter(p => !sched.includes(p.id) && !checked.includes(p));
    el.hidden = false;
    el.innerHTML = `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="pick-title"><div class="dialog">
      <h2 id="pick-title">Wer arbeitet gerade?</h2>
      <p>${SHIFT_META[shift].label} ${plan[shift].start}–${plan[shift].end}. Name antippen zum Einchecken – Haken und Notizen werden mit deinem Namen gespeichert.</p>
      ${(rosterFor(today).notes || {})[shift] ? `<p class="pnote">Anmerkung im Dienstplan: <b>${esc(rosterFor(today).notes[shift])}</b></p>` : ""}
      ${shift === "spaet" && state.date === today && pendingConfirms(plan, "frueh").length ? `<p class="pwarn">Von der Frühschicht nicht bestätigt: <b>${pendingConfirms(plan, "frueh").map(a => esc(a.t)).join(", ")}</b> – bitte prüfen.</p>` : ""}
      ${people.length ? `
        ${checked.length ? `<div class="grp">Eingecheckt</div><div class="names">${checked.map(p => btn(p, "inn")).join("")}</div>` : ""}
        ${inSched.length ? `<div class="grp">Laut Dienstplan</div><div class="names">${inSched.map(p => btn(p, "sched")).join("")}</div>` : ""}
        ${others.length ? `<div class="grp">${inSched.length || checked.length ? "Andere" : "Team"}</div><div class="names">${others.map(p => btn(p, "")).join("")}</div>` : ""}`
        : `<p>Es ist noch kein Team angelegt. Die Schichtleitung legt Namen unter <b>Verwaltung › Team</b> an.</p>`}
      <div class="row"><button class="btn ghost" data-pick-close="1">Nur ansehen</button></div>
    </div></div>`;
    const first = el.querySelector(".namebtn");
    if (first) first.focus();
  }
  function setActive(pid, role) {
    const today = isoDate(new Date());
    state.who = { date: today, shift: role, id: pid };
    LS.set("rz2who", state.who);
  }
  // Name angetippt: schon eingecheckt → nur wechseln, sonst Einchecken-Fenster.
  function pickPerson(id) {
    const today = isoDate(new Date());
    if (state.date !== today) goDate(today);
    const open = openEntry(today, id);
    if (open) {
      setActive(id, open.entry.role);
      state.pickerOpen = false; renderPicker(); render();
      setStatus(`Willkommen zurück, ${personName(id)}`);
      return;
    }
    const plan = resolvePlan(today, state.dayPlan).plan, now = nowMin();
    const role = rosterRole(today, id) || focusShift(plan, now);
    const planned = ["frueh", "spaet"].includes(role) ? plan[role].start : null;
    state.checkin = { pid: id, time: fmtMin(roundQ(now)), role, planned, stale: staleOpenEntries(id, today).map(x => ({ ...x, out: x.entry.out || null, pause: null })) };
    renderPicker();
  }
  function renderCheckin() {
    const c = state.checkin, el = $("picker");
    const now = fmtMin(roundQ(nowMin()));
    el.hidden = false;
    el.innerHTML = `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="ci-title"><div class="dialog">
      <h2 id="ci-title">Einchecken · ${esc(personName(c.pid))}</h2>
      ${c.stale.map((x, i) => `<div class="stale"><b>Nicht ausgecheckt am ${WD[parseIso(x.date).getDay()].slice(0, 2)} ${pad(parseIso(x.date).getDate())}.${pad(parseIso(x.date).getMonth() + 1)}.</b> (Beginn ${x.entry.in}) – bis wann warst du da?
        <div class="trow"><label>Ende ${timeSelect("ci-stale-" + i, x.out || fmtMin(Math.min(1425, toMin(x.entry.in) + 480)))}</label><label>Pause ${pauseSelect("ci-stalep-" + i, x.pause ?? suggestPause(480))}</label></div></div>`).join("")}
      <div class="trow big"><label>Beginn ${timeSelect("ci-time", c.time)}</label>
        <span class="quick"><button class="chip${c.time === now ? "" : " off"}" data-ciq="${now}">Jetzt ${now}</button>${c.planned ? `<button class="chip${c.time === c.planned ? "" : " off"}" data-ciq="${c.planned}">laut Plan ${c.planned}</button>` : ""}</span></div>
      <div class="trow"><span>Als</span><div class="seg">${["frueh", "spaet", "aushilfe"].map(r => `<button class="segbtn${c.role === r ? " on" : ""}" data-cirole="${r}">${ROLE_LABEL[r]}</button>`).join("")}</div></div>
      <label class="tnote">Notiz (optional) <input class="in" id="ci-note" maxlength="200" value="${esc(c.note || "")}" placeholder="z. B. Einarbeitung mit Lisa"></label>
      <div class="row"><button class="btn ghost" data-ci="cancel">Abbrechen</button><button class="btn primary" data-ci="ok">Einchecken</button></div>
    </div></div>`;
  }
  async function confirmCheckin() {
    const c = state.checkin; if (!c) return;
    const today = isoDate(new Date());
    // Vergessene Einträge zuerst abschließen.
    c.stale.forEach((x, i) => {
      const out = ($("ci-stale-" + i) || {}).value || null, pause = Number(($("ci-stalep-" + i) || {}).value || 0);
      if (out) persistTime(x.date, x.id, { ...x.entry, out, pause });
    });
    const id = newId("t");
    const entry = { pid: c.pid, role: c.role, in: c.time, out: null, pause: null, note: (c.note || "").trim().slice(0, 200), at: new Date().toISOString(), editedAt: null, orig: null };
    state.checkin = null;
    persistTime(today, id, entry);
    setActive(c.pid, c.role);
    state.shiftSel = null;
    state.pickerOpen = false; renderPicker(); render();
    setStatus(`${personName(c.pid)} eingecheckt um ${entry.in}`);
    autoBackup("shift");
  }

  // ---------- Auschecken ----------
  function openCheckout(pid) {
    const today = isoDate(new Date());
    if (state.date !== today) goDate(today);
    const open = openEntry(today, pid || (state.who && state.who.id));
    if (!open) { openPicker(true); return; }
    const out = fmtMin(roundQ(nowMin()));
    let gross = toMin(out) - toMin(open.entry.in); if (gross < 0) gross += 1440;
    state.checkout = { ...open, out, pause: suggestPause(gross), pauseTouched: false, note: open.entry.note || "" };
    renderCheckout();
  }
  function renderCheckout() {
    const c = state.checkout, el = $("remind");
    if (!c) { el.hidden = true; el.innerHTML = ""; renderRemind(); return; }
    const today = isoDate(new Date()), plan = P();
    const others = Object.entries(timeOf(today)).filter(([, e]) => e && !e.out);
    const mins = workedMin({ in: c.entry.in, out: c.out, pause: c.pause });
    const pend = ["frueh", "spaet"].includes(c.entry.role) ? pendingConfirms(plan, c.entry.role) : [];
    el.hidden = false;
    el.innerHTML = `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="co-title"><div class="dialog">
      <h2 id="co-title">Auschecken</h2>
      ${others.length > 1 ? `<div class="trow"><span>Wer</span><div class="seg">${others.map(([id, e]) => `<button class="segbtn${id === c.id ? " on" : ""}" data-coid="${esc(id)}">${esc(personName(e.pid))}</button>`).join("")}</div></div>` : `<p><b>${esc(personName(c.entry.pid))}</b> · ${ROLE_LABEL[c.entry.role]} · eingecheckt um ${c.entry.in}</p>`}
      <div class="trow big"><label>Ende ${timeSelect("co-time", c.out)}</label><label>Pause ${pauseSelect("co-pause", c.pause)}</label></div>
      <label class="tnote">Notiz (optional) <input class="in" id="co-note" maxlength="200" value="${esc(c.note || "")}" placeholder="z. B. Einarbeitung mit Lisa"></label>
      <p>Arbeitszeit: <b>${fmtHours(mins)} Std.</b> (${c.entry.in}–${c.out}, ${c.pause} Min. Pause)</p>
      ${pend.length ? `<p class="pwarn">Noch nicht bestätigt: <b>${pend.map(a => esc(a.t)).join(", ")}</b></p>` : ""}
      <div class="row"><button class="btn ghost" data-co="cancel">Abbrechen</button><button class="btn primary" data-co="ok">Auschecken</button></div>
    </div></div>`;
  }
  function confirmCheckout() {
    const c = state.checkout; if (!c) return;
    persistTime(c.date, c.id, { ...c.entry, out: c.out, pause: c.pause, note: (c.note || "").trim().slice(0, 200) });
    if (state.who && state.who.id === c.entry.pid) { state.who = null; LS.set("rz2who", null); }
    state.checkout = null;
    renderCheckout(); render();
    setStatus(`${personName(c.entry.pid)} ausgecheckt um ${c.out} · ${fmtHours(workedMin({ in: c.entry.in, out: c.out, pause: c.pause }))} Std.`);
    autoBackup("shift");
  }
  $("outBtn").addEventListener("click", () => openCheckout());
  $("remind").addEventListener("input", (e) => { if (e.target.id === "co-note" && state.checkout) state.checkout.note = e.target.value; });
  $("picker").addEventListener("input", (e) => { if (e.target.id === "ci-note" && state.checkin) state.checkin.note = e.target.value; });
  // Klicks/Änderungen im Ein-/Auschecken (Overlays liegen außerhalb von <main>)
  const stepSelect = (b) => { const sel = $(b.dataset.tstep); if (!sel) return; sel.selectedIndex = Math.max(0, Math.min(sel.options.length - 1, sel.selectedIndex + Number(b.dataset.dir))); sel.dispatchEvent(new Event("change", { bubbles: true })); };
  $("remind").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || !state.checkout) return;
    if (b.dataset.tstep) return stepSelect(b);
    if (b.dataset.coid) {
      const t = timeOf(state.checkout.date)[b.dataset.coid];
      if (t) { let g = toMin(state.checkout.out) - toMin(t.in); if (g < 0) g += 1440; state.checkout = { ...state.checkout, id: b.dataset.coid, entry: t, pause: suggestPause(g), pauseTouched: false, note: t.note || "" }; renderCheckout(); }
      return;
    }
    if (b.dataset.co === "cancel") { state.checkout = null; renderCheckout(); return; }
    if (b.dataset.co === "ok") return confirmCheckout();
  });
  $("remind").addEventListener("change", (e) => {
    const c = state.checkout; if (!c) return;
    if (e.target.id === "co-time") {
      c.out = e.target.value;
      if (!c.pauseTouched) { let g = toMin(c.out) - toMin(c.entry.in); if (g < 0) g += 1440; c.pause = suggestPause(g); }
      renderCheckout();
    } else if (e.target.id === "co-pause") { c.pause = Number(e.target.value); c.pauseTouched = true; renderCheckout(); }
  });
  $("picker").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.pick) return pickPerson(b.dataset.pick);
    if (b.dataset.pickClose) { state.pickerOpen = false; state.pickerSnoozeUntil = Date.now() + 5 * 60000; renderPicker(); }
    if (!state.checkin) return;
    if (b.dataset.tstep) return stepSelect(b);
    if (b.dataset.ciq) { state.checkin.time = b.dataset.ciq; renderPicker(); return; }
    if (b.dataset.cirole) { state.checkin.role = b.dataset.cirole; renderPicker(); return; }
    if (b.dataset.ci === "cancel") { state.checkin = null; renderPicker(); return; }
    if (b.dataset.ci === "ok") return confirmCheckin();
  });
  $("picker").addEventListener("change", (e) => {
    const c = state.checkin; if (!c) return;
    if (e.target.id === "ci-time") { c.time = e.target.value; renderPicker(); }
    const m = e.target.id.match(/^ci-stale(p?)-(\d+)$/);
    if (m) { const x = c.stale[Number(m[2])]; if (m[1]) x.pause = Number(e.target.value); else x.out = e.target.value; }
  });
  const onKey = (e) => {
    if (e.key === "Escape" && state.pickerOpen) { state.pickerOpen = false; state.pickerSnoozeUntil = Date.now() + 5 * 60000; renderPicker(); }
  };
  document.addEventListener("keydown", onKey);
  cleanups.push(() => document.removeEventListener("keydown", onKey));
  // ---------- Pflicht-Erinnerung ----------
  // In den letzten 30 Minuten der laufenden Schicht: Fenster mit allen Pflichtpunkten, die noch nicht bestätigt sind.
  function remindTarget() {
    const today = isoDate(new Date());
    if (state.date !== today || state.mode === "loading") return null;
    const plan = P(), now = nowMin(), key = activeShift(plan, now);
    if (!key || toMin(plan[key].end) - now > 30) return null;
    const pending = pendingConfirms(plan, key);
    return pending.length ? { key, pending, end: plan[key].end } : null;
  }
  function maybeRemind() {
    if (state.checkout || state.pickerOpen || state.remindOpen || Date.now() < state.remindSnoozeUntil) return;
    if (!["schicht", "dienst", "monat"].includes(state.view)) return;
    if (remindTarget()) { state.remindOpen = true; renderRemind(); }
  }
  function renderRemind() {
    if (state.checkout) return;
    const el = $("remind");
    const t = state.remindOpen ? remindTarget() : null;
    if (!t) { state.remindOpen = false; el.hidden = true; el.innerHTML = ""; return; }
    el.hidden = false;
    el.innerHTML = `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="rem-title"><div class="dialog">
      <h2 id="rem-title">Vor Schichtende bestätigen</h2>
      <p>${SHIFT_META[t.key].label} endet um ${t.end} Uhr. Diese Punkte sind noch nicht bestätigt:</p>
      <ul class="remlist">${t.pending.map(a => `<li><span>${esc(a.t)}</span><button class="btn primary" data-rconfirm="${esc(a.id)}" data-shift="${t.key}">Erledigt</button></li>`).join("")}</ul>
      <div class="row"><button class="btn ghost" data-rsnooze="1">In 10 Minuten erinnern</button></div>
    </div></div>`;
  }
  $("remind").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.rconfirm) { logAlways(b.dataset.shift, b.dataset.rconfirm); renderRemind(); return; }
    if (b.dataset.rsnooze) { state.remindOpen = false; state.remindSnoozeUntil = Date.now() + 10 * 60000; renderRemind(); }
  });

  // Zu Schichtbeginn bzw. bei Schichtwechsel automatisch nachfragen.
  function maybeAskPerson() {
    if (state.mode === "loading" || state.pickerOpen || !state.cfg.people.length) return;
    if (state.view !== "schicht") return;
    if (state.date !== isoDate(new Date()) || currentPerson()) return;
    openPicker(false);
  }

  // ---------- Zeiten (Ansicht, Korrektur, Export) ----------
  async function loadTimes(ym) {
    state.timesData = { ym, days: {}, loading: true };
    let days = {};
    try {
      if (state.mode === "shared") {
        const snap = await db.collection("days").where("month", "==", ym).get();
        snap.docs.forEach(d => { if (d.exists) days[d.id] = normTime(d.data().time); });
      } else {
        for (const [date, m] of Object.entries(LS.month(ym))) days[date] = m.time || {};
      }
    } catch { setStatus("Zeiten konnten nicht geladen werden", true); }
    if (state.timesData && state.timesData.ym === ym) { state.timesData = { ym, days }; if (state.view === "zeiten") render(); }
  }
  function timeRows(pidFilter) {
    const rows = [];
    for (const [date, t] of Object.entries((state.timesData && state.timesData.days) || {})) {
      for (const [id, e] of Object.entries(t || {})) if (e && (!pidFilter || e.pid === pidFilter)) rows.push({ id, date, e, mins: workedMin(e) });
    }
    return rows.sort((a, b) => (a.date + a.e.in).localeCompare(b.date + b.e.in) || personName(a.e.pid).localeCompare(personName(b.e.pid)));
  }
  function sums(rows) {
    const by = {};
    for (const r of rows) { const k = r.e.pid; by[k] = by[k] || { pid: k, days: new Set(), mins: 0, open: 0 }; by[k].days.add(r.date); if (r.mins !== null) by[k].mins += r.mins; else by[k].open++; }
    return Object.values(by).map(x => ({ ...x, days: x.days.size })).sort((a, b) => personName(a.pid).localeCompare(personName(b.pid)));
  }
  const dateLabel = (date) => { const d = parseIso(date); return `${WD[d.getDay()].slice(0, 2)} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`; };
  function renderTimes() {
    const ym = state.timesMonth || state.date.slice(0, 7);
    if (!state.timesData || state.timesData.ym !== ym) { loadTimes(ym); }
    const [y, m] = ym.split("-").map(Number);
    const head = `<div class="monthhead">
        <button class="iconbtn" id="tprev" aria-label="Vorheriger Monat">‹</button>
        <h2>Zeiten ${MONTHS[m - 1]} ${y}</h2>
        <button class="iconbtn" id="tnext" aria-label="Nächster Monat">›</button>
        ${state.timesAll && isUnlocked() ? `<select id="t-person" aria-label="Person"><option value="">Alle</option>${state.cfg.people.map(p => `<option value="${esc(p.id)}"${state.timesPerson === p.id ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select>
          <button class="btn" data-act2="t-add">+ Eintrag</button>
          <button class="btn" data-act2="t-xlsx">Excel</button><button class="btn primary" data-act2="t-pdf">PDF</button>`
          : `<button class="btn" data-act2="t-all">Alle Zeiten (Leitung)</button>`}
      </div>`;
    if (!state.timesAll || !isUnlocked()) {
      state.timesAll = false;
      if (!state.timesPerson) {
        return head + `<section class="card tpick"><div class="chead"><h2>Eigene Zeiten ansehen</h2></div><div class="cbody"><div class="names">${state.cfg.people.map(p => `<button class="namebtn" data-tperson="${esc(p.id)}"><span class="av">${esc(initials(p.name))}</span>${esc(p.name)}</button>`).join("") || "<p>Noch kein Team angelegt.</p>"}</div></div></section>`;
      }
    }
    const pid = state.timesPerson || null;
    const rows = timeRows(pid);
    const loading = state.timesData && state.timesData.loading;
    const body = rows.map(r => {
      const planned = plannedFor(r.date, r.e.pid, r.e.role);
      const edited = r.e.orig ? ` <span class="pill later" title="ursprünglich ${esc([r.e.orig.in, r.e.orig.out].filter(Boolean).join("–"))}${r.e.orig.pause !== null ? ", Pause " + r.e.orig.pause : ""}">korrigiert</span>` : "";
      return `<tr class="${r.e.out ? "" : "openrow"}"><td>${dateLabel(r.date)}</td><td>${esc(personName(r.e.pid) || "?")}</td><td>${ROLE_LABEL[r.e.role]}</td><td>${r.e.in}</td><td>${r.e.out || "<b>offen</b>"}</td><td>${r.e.pause !== null ? r.e.pause + " Min." : "–"}</td><td class="num">${fmtHours(r.mins)}</td><td class="muted">${planned || "–"}</td><td class="tnotecell" title="${esc(r.e.note || "")}">${esc(r.e.note || "")}</td><td>${edited}${state.timesAll && isUnlocked() ? ` <button class="mini edit" data-tedit="${esc(r.date)}|${esc(r.id)}" aria-label="Bearbeiten">✎</button>` : ""}</td></tr>`;
    }).join("");
    const sm = sums(rows);
    return head + `<div class="times">
      <section class="card"><div class="chead"><h2>${pid ? esc(personName(pid)) : "Alle"}</h2><span class="hint">${rows.length} Einträge${loading ? " · lädt…" : ""}</span>${!state.timesAll ? `<button class="btn ghost" data-act2="t-back">Andere Person</button>` : ""}</div>
        <div class="cbody tscroll"><table class="ttab"><thead><tr><th>Datum</th><th>Name</th><th>Rolle</th><th>Ein</th><th>Aus</th><th>Pause</th><th>Stunden</th><th>Geplant</th><th>Notiz</th><th></th></tr></thead><tbody>${body || `<tr><td colspan="10" class="empty">Keine Einträge in diesem Monat.</td></tr>`}</tbody></table></div></section>
      <section class="card"><div class="chead"><h2>Summe</h2></div><div class="cbody"><table class="ttab"><thead><tr><th>Name</th><th>Tage</th><th>Stunden</th><th>Offen</th></tr></thead><tbody>${sm.map(x => `<tr><td>${esc(personName(x.pid))}</td><td>${x.days}</td><td class="num">${x.mins || !x.open ? fmtHours(x.mins) : "–"}</td><td>${x.open || ""}</td></tr>`).join("")}</tbody></table></div></section>
    </div>${state.timesEdit ? renderTimeEdit() : ""}`;
  }
  function renderTimeEdit() {
    const ed = state.timesEdit;
    return `<div class="overlay inmain" role="dialog" aria-modal="true"><div class="dialog">
      <h2>${ed.id ? "Eintrag korrigieren" : "Eintrag hinzufügen"}</h2>
      <div class="trow"><label>Datum <input type="date" id="te-date" class="in" value="${ed.date}" ${ed.id ? "disabled" : ""}></label>
        <label>Person <select id="te-pid">${state.cfg.people.map(p => `<option value="${esc(p.id)}"${ed.e.pid === p.id ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
        <label>Rolle <select id="te-role">${Object.entries(ROLE_LABEL).map(([k, v]) => `<option value="${k}"${ed.e.role === k ? " selected" : ""}>${v}</option>`).join("")}</select></label></div>
      <div class="trow"><label>Ein ${timeSelect("te-in", ed.e.in)}</label><label>Aus ${timeSelect("te-out", ed.e.out || "", { allowOpen: true })}</label><label>Pause ${pauseSelect("te-pause", ed.e.pause || 0)}</label></div>
      <label class="tnote">Notiz <input class="in" id="te-note" maxlength="200" value="${esc(ed.e.note || "")}"></label>
      ${ed.e.orig ? `<p class="muted">Ursprünglich: ${esc([ed.e.orig.in, ed.e.orig.out].filter(Boolean).join("–"))}${ed.e.orig.pause !== null ? `, Pause ${ed.e.orig.pause} Min.` : ""}</p>` : ""}
      <div class="row">${ed.id ? `<button class="btn ghost danger" data-act2="te-del">${state.confirm === "te-del" ? "Wirklich löschen?" : "Löschen"}</button>` : ""}<button class="btn ghost" data-act2="te-cancel">Abbrechen</button><button class="btn primary" data-act2="te-save">Speichern</button></div>
    </div></div>`;
  }
  function saveTimeEdit() {
    const ed = state.timesEdit; if (!ed) return;
    const val = (id) => ($(id) || {}).value;
    const date = ed.id ? ed.date : val("te-date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) { setStatus("Bitte ein Datum wählen", true); return; }
    const e = { ...ed.e, pid: val("te-pid"), role: val("te-role"), in: val("te-in"), out: val("te-out") || null, pause: Number(val("te-pause") || 0), note: String(val("te-note") || "").trim().slice(0, 200) };
    if (ed.id) {
      const before = ed.e;
      if (before.in !== e.in || before.out !== e.out || (before.pause || 0) !== e.pause) {
        e.orig = before.orig || { in: before.in, out: before.out, pause: before.pause };
        e.editedAt = new Date().toISOString();
      }
    } else { e.at = new Date().toISOString(); e.orig = { in: null, out: null, pause: null }; e.editedAt = e.at; }
    persistTime(date, ed.id || newId("t"), e);
    state.timesEdit = null; state.confirm = null;
    render();
    setStatus("Zeit gespeichert");
  }

  // Export-Dateien ohne Fremdbibliothek: XLSX (ZIP mit SpreadsheetML) und PDF (A4 quer, Helvetica).
  const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zipStore(files) {
    const enc = new TextEncoder(), parts = [], central = [];
    let offset = 0;
    for (const [name, text] of files) {
      const data = enc.encode(text), nameB = enc.encode(name), crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(8, 0, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nameB.length, true);
      parts.push(new Uint8Array(lh.buffer), nameB, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, nameB.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), nameB);
      offset += 30 + nameB.length + data.length;
    }
    const csize = central.reduce((n, p) => n + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, offset, true);
    const all = [...parts, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0)); let o = 0;
    for (const p of all) { out.set(p, o); o += p.length; }
    return out;
  }
  const xmlEsc = (v) => String(v).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function sheetXml(rows, widths) {
    const col = (i) => String.fromCharCode(65 + i);
    const cells = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => v === null || v === "" ? "" : typeof v === "number" ? `<c r="${col(ci)}${ri + 1}"${ri === 0 ? ' s="1"' : ""}><v>${v}</v></c>` : `<c r="${col(ci)}${ri + 1}" t="inlineStr"${ri === 0 ? ' s="1"' : ""}><is><t>${xmlEsc(v)}</t></is></c>`).join("")}</row>`).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${cells}</sheetData></worksheet>`;
  }
  function exportTables() {
    const rows = timeRows(state.timesPerson || null), [y, m] = (state.timesMonth || state.date.slice(0, 7)).split("-").map(Number);
    const detail = [["Datum", "Name", "Rolle", "Ein", "Aus", "Pause (Min.)", "Stunden", "Stunden (dezimal)", "Geplant", "Korrigiert", "Notiz"]]
      .concat(rows.map(r => [`${dateLabel(r.date)}${y}`, personName(r.e.pid), ROLE_LABEL[r.e.role], r.e.in, r.e.out || "offen", r.e.pause ?? "", fmtHours(r.mins), r.mins === null ? "" : Math.round(r.mins / 60 * 100) / 100, plannedFor(r.date, r.e.pid, r.e.role) || "", r.e.orig ? "ja" : "", r.e.note || ""]));
    const summary = [["Name", "Tage", "Stunden", "Stunden (dezimal)", "Offene Einträge"]]
      .concat(sums(rows).map(x => [personName(x.pid), x.days, x.mins || !x.open ? fmtHours(x.mins) : "–", Math.round(x.mins / 60 * 100) / 100, x.open || ""]));
    const who = state.timesPerson ? personName(state.timesPerson) : "Alle";
    return { detail, summary, title: `Arbeitszeiten ${MONTHS[m - 1]} ${y} – ${who}`, base: `Zeiten-${y}-${pad(m)}-${who.replace(/[^\wÄÖÜäöüß-]+/g, "_")}` };
  }
  function buildXlsx() {
    const t = exportTables();
    const files = [
      ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
      ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
      ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Zeiten" sheetId="1" r:id="rId1"/><sheet name="Summe" sheetId="2" r:id="rId2"/></sheets></workbook>`],
      ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ["xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
      ["xl/worksheets/sheet1.xml", sheetXml(t.detail, [14, 16, 10, 8, 8, 12, 9, 16, 14, 11, 40])],
      ["xl/worksheets/sheet2.xml", sheetXml(t.summary, [18, 8, 10, 16, 15])],
    ];
    return { name: t.base + ".xlsx", bytes: zipStore(files), type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  }
  function buildPdf() {
    const t = exportTables();
    // WinAnsi: Umlaute/ß liegen wie Latin-1; Gedankenstrich auf 0x96.
    const enc = (str) => { const out = []; for (const ch of String(str)) { const c = ch.codePointAt(0); out.push(c === 0x2013 ? 0x96 : c === 0x2026 ? 0x85 : c < 256 ? c : 0x3f); } return out; };
    const pdfStr = (str) => "(" + enc(str).map(b => b === 0x28 || b === 0x29 || b === 0x5c ? "\\" + String.fromCharCode(b) : b < 32 || b > 126 ? "\\" + b.toString(8).padStart(3, "0") : String.fromCharCode(b)).join("") + ")";
    const W = 842, H = 595, M = 36, RH = 16;
    const cols = [[0, "Datum"], [80, "Name"], [190, "Rolle"], [255, "Ein"], [305, "Aus"], [355, "Pause"], [410, "Stunden"], [465, "Geplant"], [540, "Korr."], [580, "Notiz"]];
    const pages = []; let ops = [], y = 0;
    const newPage = () => { if (ops.length) pages.push(ops.join("\n")); ops = []; y = H - M; text(M, y, t.title, 14, true); text(W - M - 160, y, `erstellt ${new Date().toLocaleDateString("de-DE")}`, 9); y -= 26; };
    const text = (x, yy, s2, size = 9, bold = false) => ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${yy} Td ${pdfStr(s2)} Tj ET`);
    const line = (yy) => ops.push(`0.8 G 0.5 w ${M} ${yy} m ${W - M} ${yy} l S`);
    const header = (labels, xs) => { labels.forEach((l, i) => text(M + xs[i], y, l, 9, true)); y -= 5; line(y); y -= RH - 5; };
    newPage();
    header(cols.map(c => c[1]), cols.map(c => c[0]));
    for (const r of t.detail.slice(1)) {
      if (y < M + RH) { newPage(); header(cols.map(c => c[1]), cols.map(c => c[0])); }
      const v = [r[0], r[1], r[2], r[3], r[4], r[5] === "" ? "–" : r[5] + " Min.", r[6], r[8] || "–", r[9], r[10]];
      v.forEach((s2, i) => text(M + cols[i][0], y, String(s2).slice(0, i === 9 ? 48 : 22)));
      y -= RH;
    }
    y -= 12;
    if (y < M + RH * (t.summary.length + 2)) newPage();
    text(M, y, "Summe", 11, true); y -= 18;
    const scol = [0, 160, 220, 300];
    header(["Name", "Tage", "Stunden", "Offen"], scol);
    for (const r of t.summary.slice(1)) { [r[0], r[1], r[2], r[4]].forEach((s2, i) => text(M + scol[i], y, String(s2))); y -= RH; }
    pages.push(ops.join("\n"));
    // Objekte: 1 Katalog, 2 Seitenbaum, 3/4 Schriften, danach je Seite Seite + Inhalt
    const objs = [];
    const kids = pages.map((_, i) => `${5 + i * 2} 0 R`).join(" ");
    objs[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
    objs[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;
    objs[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
    objs[4] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`;
    pages.forEach((content, i) => {
      objs[5 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`;
      objs[6 + i * 2] = { stream: content };
    });
    const bytes = []; const push = (str) => { for (let i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i) & 0xff); };
    push("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
    const offsets = [];
    for (let n = 1; n < objs.length; n++) {
      offsets[n] = bytes.length;
      const o = objs[n];
      if (typeof o === "string") push(`${n} 0 obj\n${o}\nendobj\n`);
      else push(`${n} 0 obj\n<< /Length ${o.stream.length} >>\nstream\n${o.stream}\nendstream\nendobj\n`);
    }
    const xref = bytes.length;
    push(`xref\n0 ${objs.length}\n0000000000 65535 f \n${offsets.slice(1).map(o => String(o).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return { name: t.base + ".pdf", bytes: new Uint8Array(bytes), type: "application/pdf" };
  }
  async function saveExport(file) {
    try {
      if (NATIVE && NATIVE.saveExport) {
        const r = await NATIVE.saveExport(file.name, file.bytes);
        if (r && r.ok) setStatus("Gespeichert: " + r.path); else if (r && r.canceled) setStatus(statusLine()); else setStatus("Export fehlgeschlagen" + (r && r.error ? ": " + r.error : ""), true);
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([file.bytes], { type: file.type }));
      a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      setStatus("Export erstellt: " + file.name);
    } catch (e) { setStatus("Export fehlgeschlagen: " + ((e && e.message) || "Fehler"), true); }
  }

  // ---------- Plan-Editor ----------
  const SOURCE_LABEL = { day: "Tagesanpassung", weekday: "Wochentag-Vorlage", base: "Standard", default: "Standard (Aushang)" };

  function ensureDraft() {
    if (!state.draft || state.draft.date !== state.date) { state.draft = { date: state.date, plan: clone(resolvePlan(state.date, state.dayPlan, true).plan) }; state.draftDirty = false; }
    return state.draft.plan;
  }

  function renderEditor() {
    const plan = ensureDraft();
    const { source } = resolvePlan(state.date, state.dayPlan);
    const wd = parseIso(state.date).getDay();
    const dd = parseIso(state.date);
    const dateTxt = `${WD[wd]}, ${pad(dd.getDate())}.${pad(dd.getMonth() + 1)}.`;
    const wdTemplates = Object.keys(state.cfg.weekday).map(Number).sort();
    const del = (path) => state.confirm === path ? `<button class="mini del confirm" data-act="del" data-path="${path}">Löschen?</button>` : `<button class="mini del" data-act="del" data-path="${path}" aria-label="Löschen">✕</button>`;

    const shiftHtml = (key) => {
      const s = plan[key], meta = SHIFT_META[key];
      const phases = s.phases.map((p, pi) => {
        const base = `${key}.phases.${pi}`;
        const items = p.items.map((it, ii) => {
          const path = `${base}.items.${ii}`;
          const moveOpts = s.phases.map((q, qi) => `<option value="${qi}"${qi === pi ? " selected" : ""}>${esc(q.from)} ${esc(q.title)}</option>`).join("");
          return `<li>
            <div class="order"><button class="mini" data-act="up" data-path="${path}" ${ii === 0 ? "disabled" : ""} aria-label="Nach oben">▲</button><button class="mini" data-act="down" data-path="${path}" ${ii === p.items.length - 1 ? "disabled" : ""} aria-label="Nach unten">▼</button></div>
            <div class="fields">
              <input class="in" id="ed-${path}-t" data-path="${path}.t" value="${esc(it.t)}" maxlength="200" aria-label="Aufgabe">
              <input class="in sub" id="ed-${path}-s" data-path="${path}.s" value="${esc(it.s || "")}" maxlength="300" placeholder="Hinweis (optional)" aria-label="Hinweis">
              <div class="opts">
                <label><input type="checkbox" data-path="${path}.important" ${it.important ? "checked" : ""}> wichtig (rot)</label>
                <label><input type="checkbox" data-path="${path}.optional" ${it.optional ? "checked" : ""}> „entfällt“ erlaubt</label>
                <label>Abschnitt <select data-move="${path}">${moveOpts}</select></label>
              </div>
            </div>
            ${del(path)}
          </li>`;
        }).join("");
        return `<section class="card ed-phase">
          <div class="chead">
            <input class="in title" id="ed-${base}-title" data-path="${base}.title" value="${esc(p.title)}" maxlength="60" aria-label="Abschnitt">
            <input class="in time" inputmode="numeric" maxlength="5" placeholder="HH:MM" id="ed-${base}-from" data-time="${base}.from" value="${p.from}" aria-label="von">
            <span class="hint">–</span>
            <input class="in time" inputmode="numeric" maxlength="5" placeholder="HH:MM" id="ed-${base}-to" data-time="${base}.to" value="${p.to}" aria-label="bis">
            ${del(base)}
          </div>
          <ul class="ed-items">${items}</ul>
          <button class="addrow" data-act="add-item" data-path="${base}">+ Aufgabe</button>
        </section>`;
      }).join("");
      const always = plan.always[key].map((a, ai) => {
        const path = `always.${key}.${ai}`;
        return `<li>
          <div class="order"><button class="mini" data-act="up" data-path="${path}" ${ai === 0 ? "disabled" : ""} aria-label="Nach oben">▲</button><button class="mini" data-act="down" data-path="${path}" ${ai === plan.always[key].length - 1 ? "disabled" : ""} aria-label="Nach unten">▼</button></div>
          <div class="fields">
            <input class="in" id="ed-${path}-t" data-path="${path}.t" value="${esc(a.t)}" maxlength="200" aria-label="Daueraufgabe">
            <div class="opts"><label><input type="checkbox" data-path="${path}.important" ${a.important ? "checked" : ""}> wichtig (rot)</label><label>Art <select data-kind="${path}" aria-label="Art"><option value="rhythm"${a.kind === "rhythm" ? " selected" : ""}>Regelmäßig</option><option value="confirm"${a.kind === "confirm" ? " selected" : ""}>Pflicht – einmal pro Schicht bestätigen</option><option value="hint"${a.kind === "hint" ? " selected" : ""}>Nur Hinweis</option></select></label>${a.kind === "rhythm" ? `<label>alle <input class="in time" data-num="${path}.every" id="ed-${path}-every" value="${a.every || ""}" inputmode="numeric" maxlength="3" aria-label="Rhythmus in Minuten"> Min.</label>` : ""}</div>
          </div>
          ${del(path)}
        </li>`;
      }).join("");
      return `<div class="edshift">
        <h2>${meta.label}
          <label>Beginn <input class="in time" inputmode="numeric" maxlength="5" placeholder="HH:MM" id="ed-${key}-start" data-time="${key}.start" value="${s.start}"></label>
          <label>Ende <input class="in time" inputmode="numeric" maxlength="5" placeholder="HH:MM" id="ed-${key}-end" data-time="${key}.end" value="${s.end}"></label>
        </h2>
        ${phases}
        <button class="btn" data-act="add-phase" data-path="${key}">+ Abschnitt</button>
        <section class="card"><div class="chead"><h2>Immer im Blick</h2><span class="hint">Regelmäßig · Pflicht · Hinweis</span></div>
          <ul class="ed-items">${always}</ul>
          <button class="addrow" data-act="add-always" data-path="always.${key}">+ Daueraufgabe</button></section>
      </div>`;
    };

    const removeBtns = [
      source === "day" ? `<button class="btn ghost danger" data-act="reset-day">Tagesanpassung entfernen</button>` : "",
      state.cfg.weekday[String(wd)] ? `<button class="btn ghost danger" data-act="reset-weekday">${WD[wd]}-Vorlage entfernen</button>` : "",
    ].join("");
    return `<div class="edbar">
        <div class="info">Plan für <b>${dateTxt}</b> · aktuell gilt: <b>${SOURCE_LABEL[source]}</b>${state.draftDirty ? " · <b style=\"color:var(--now)\">ungespeicherte Änderungen</b>" : ""}<br>
          ${wdTemplates.length ? "Wochentag-Vorlagen: " + wdTemplates.map(i => WD[i]).join(", ") + ". " : ""}Abschnitte sortieren sich nach Uhrzeit, Aufgaben mit ▲▼.</div>
        <button class="btn primary" data-act="save-day" ${state.draftDirty ? "" : "disabled"}>Nur ${dateTxt} speichern</button>
        <button class="btn" data-act="save-weekday" ${state.draftDirty ? "" : "disabled"}>Für alle ${WD_PL[wd]}</button>
        <button class="btn" data-act="save-base" ${state.draftDirty ? "" : "disabled"}>Als Standard</button>
        <button class="btn ghost" data-act="discard" ${state.draftDirty ? "" : "disabled"}>Verwerfen</button>
        ${removeBtns}
      </div>
      <div class="editor">${shiftHtml("frueh")}${shiftHtml("spaet")}</div>`;
  }

  function getRef(path) {
    const parts = path.split(".");
    const last = parts.pop();
    let obj = state.draft.plan;
    for (const p of parts) obj = obj[/^\d+$/.test(p) ? Number(p) : p];
    return { parent: obj, key: /^\d+$/.test(last) ? Number(last) : last };
  }
  function markDirty() { state.draftDirty = true; const b = root.querySelectorAll('[data-act^="save-"],[data-act="discard"]'); b.forEach(x => { x.disabled = false; }); }

  function editorAction(act, path) {
    const plan = state.draft.plan;
    if (act === "del") {
      if (state.confirm !== path) { state.confirm = path; render(); return; }
      state.confirm = null;
      const { parent, key } = getRef(path);
      parent.splice(key, 1);
    } else if (act === "up" || act === "down") {
      const { parent, key } = getRef(path);
      const j = act === "up" ? key - 1 : key + 1;
      if (j < 0 || j >= parent.length) return;
      [parent[key], parent[j]] = [parent[j], parent[key]];
    } else if (act === "add-item") {
      const { parent, key } = getRef(path);
      const shift = path.split(".")[0];
      parent[key].items.push({ id: newId(SHIFT_META[shift].prefix), t: "Neue Aufgabe", s: "", important: false, optional: false });
    } else if (act === "add-phase") {
      const s = plan[path];
      const last = s.phases[s.phases.length - 1];
      const from = last ? last.to : s.start;
      const to = fmtMin(Math.min(toMin(from) + 30, 23 * 60 + 59));
      s.phases.push({ id: newId("p"), title: "Neuer Abschnitt", from, to, hint: "", items: [] });
      s.phases = sortPhases(s.phases);
    } else if (act === "add-always") {
      const { parent, key } = getRef(path);
      parent[key].push({ id: newId("a"), t: "Neue Daueraufgabe", s: "", important: false, kind: "hint", every: 0 });
    } else return;
    state.confirm = null;
    markDirty();
    render();
  }

  async function saveDraft(scope) {
    const plan = normalizePlan(state.draft.plan);
    if (!plan) { setStatus("Plan ungültig – bitte Uhrzeiten prüfen", true); return; }
    const wd = String(parseIso(state.date).getDay());
    let ok;
    if (scope === "day") {
      state.dayPlan = plan;
      ok = await persistDay(state.date, { plan });
    } else if (scope === "weekday") {
      state.cfg = { ...state.cfg, weekday: { ...state.cfg.weekday, [wd]: plan } };
      ok = await persistCfg({ weekday: { [wd]: plan } });
    } else {
      state.cfg = { ...state.cfg, base: plan };
      ok = await persistCfg({ base: plan });
    }
    if (ok) {
      state.draft = null; state.draftDirty = false;
      const { source } = resolvePlan(state.date, state.dayPlan);
      const shadow = scope !== "day" && source === "day" ? " Für diesen Tag gilt weiter die Tagesanpassung." : (scope === "base" && source === "weekday" ? ` Für ${WD_PL[Number(wd)]} gilt weiter die Wochentag-Vorlage.` : "");
      setStatus("Plan gespeichert." + shadow, !!shadow);
    }
    render();
  }

  async function resetScope(scope) {
    const wd = String(parseIso(state.date).getDay());
    if (scope === "day") { state.dayPlan = null; await persistDay(state.date, { plan: null }); }
    else { const w = { ...state.cfg.weekday }; delete w[wd]; state.cfg = { ...state.cfg, weekday: w }; await persistCfg({ weekday: { [wd]: null } }); }
    state.draft = null; state.draftDirty = false;
    render();
  }

  // ---------- Rendering ----------
  function renderHeader() {
    const d = parseIso(state.date), plan = P(), ctx = timeCtx();
    const { source } = resolvePlan(state.date, state.dayPlan);
    $("weekday").textContent = WD[d.getDay()] + (state.date === isoDate(new Date()) ? " · heute" : "");
    $("datelabel").textContent = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    $("datesrc").textContent = source === "day" ? "angepasst" : source === "weekday" ? WD[d.getDay()].slice(0, 2) + "-Plan" : "";
    $("datepick").value = state.date;
    const act = activeShift(plan, ctx);
    $("clock").innerHTML = `${fmtMin(nowMin())}${act ? `<small>${SHIFT_META[act].label} bis ${plan[act].end}</small>` : ""}`;
    { const k = state.shiftSel || focusShift(plan, ctx), pr = progress(plan, k, state.checks); $("meta-shift").textContent = `${SHIFT_META[k].short} ${pr.done}/${pr.total}`; }
    const tabView = ["plan", "pin", "monat"].includes(state.view) ? "admin" : state.view;
    root.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", String(t.dataset.view === tabView)));
    const p = currentPerson(), wb = $("whoBtn");
    wb.classList.toggle("none", !p);
    wb.hidden = !state.cfg.people.length;
    $("whoAv").textContent = p ? initials(p.name) : "?";
    $("whoName").innerHTML = p ? `${esc(p.name)} <small>wechseln</small>` : "Einchecken";
    $("outBtn").hidden = !p;
  }

  function render() {
    const active = root.activeElement;
    const typing = active && $("main").contains(active) && (active.tagName === "TEXTAREA" || (active.tagName === "INPUT" && active.type !== "checkbox"));
    if (typing || drag) { renderPending = true; renderHeader(); return; }
    renderPending = false;
    renderHeader();
    const v = state.view, main = $("main");
    if ((v === "plan" || v === "admin" || v === "monat") && !isUnlocked()) { state.pinStage = { mode: state.cfg.adminPin ? "unlock" : "set", next: v }; state.view = "pin"; return render(); }
    main.className = ["plan", "monat", "dienst", "admin", "pin", "zeiten"].includes(v) ? "scroll" : "";
    main.innerHTML = v === "monat" ? renderMonth() : v === "plan" ? renderEditor()
      : v === "dienst" ? renderRoster() : v === "admin" ? renderAdmin() : v === "pin" ? renderPin() : v === "zeiten" ? renderTimes() : renderSchicht();
    maybeAskPerson();
    maybeRemind();
    if (v === "schicht") scrollToNow();
  }
  // Querformat: aktuelle Spalte ins Bild holen.
  function scrollToNow() {
    // Erster offener Abschnitt (überfällig oder aktuell) in Zeitreihenfolge.
    const el = root.querySelector(".stop.is-late, .stop.is-now");
    if (!el) return;
    const board = root.querySelector(".board");
    if (board && board.scrollHeight > board.clientHeight) board.scrollTop = Math.max(0, el.offsetTop - board.offsetTop - 8);
    else if (!scrolledOnce) {
      const head = root.querySelector("header.top");
      if (head) host.style.setProperty("--rz-head", head.offsetHeight + 8 + "px");
      el.scrollIntoView({ block: "start" });
      scrolledOnce = true;
    }
  }



  // ---------- Interaktion ----------
  function goDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    if (state.view === "plan" && state.draftDirty && !confirmLeave()) return;
    state.date = date;
    state.expanded.clear();
    state.draft = null; state.draftDirty = false; state.confirm = null;
    subscribeMonth();
    subscribeDay();
  }
  let leaveArmed = false;
  function confirmLeave() {
    if (leaveArmed) { leaveArmed = false; return true; }
    leaveArmed = true;
    setStatus("Ungespeicherte Plan-Änderungen – nochmal tippen zum Verwerfen", true);
    setTimeout(() => { leaveArmed = false; }, 4000);
    return false;
  }
  function setView(v) {
    if (state.view === "plan" && v !== "plan" && state.draftDirty && !confirmLeave()) return;
    if (v !== "plan") { state.draft = null; state.draftDirty = false; }
    if (v === "admin" || v === "plan" || v === "monat") { if (!requireAdmin(v)) return; }
    if (v === "schicht") state.shiftSel = null; // Tab „Schicht“ zeigt immer die laufende Schicht
    if (v !== "dienst") state.rosterEdit = false;
    if (v === "dienst") { state.rosterMonth = state.date.slice(0, 7); state.rosterDay = null; }
    if (v === "zeiten") { state.timesMonth = state.date.slice(0, 7); state.timesPerson = null; state.timesAll = false; state.timesEdit = null; state.timesData = null; }
    state.view = v; state.confirm = null; scrolledOnce = false;
    if (opts.standalone) window.scrollTo(0, 0);
    render();
  }
  function shiftMonths(n) { const d = parseIso(state.date); d.setDate(1); d.setMonth(d.getMonth() + n); goDate(isoDate(d)); }

  $("prev").addEventListener("click", () => goDate(addDays(state.date, -1)));
  $("next").addEventListener("click", () => goDate(addDays(state.date, 1)));
  $("today").addEventListener("click", () => goDate(isoDate(new Date())));
  $("datepick").addEventListener("change", (e) => goDate(e.target.value));
  root.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => setView(t.dataset.view)));

  const main = $("main");
  main.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || t.disabled) return;
    if (t.dataset.act) {
      const a = t.dataset.act;
      if (a === "save-day") return saveDraft("day");
      if (a === "save-weekday") return saveDraft("weekday");
      if (a === "save-base") return saveDraft("base");
      if (a === "discard") { state.draft = null; state.draftDirty = false; render(); return; }
      if (a === "reset-day") return resetScope("day");
      if (a === "reset-weekday") return resetScope("weekday");
      return editorAction(a, t.dataset.path);
    }
    if (t.dataset.act2) {
      const a = t.dataset.act2;
      if (a === "roster-edit") { if (requireAdmin("dienst-edit")) { state.rosterEdit = true; render(); } return; }
      if (a === "roster-done") { state.rosterEdit = false; render(); return; }
      if (a === "rday-close") { state.rosterDay = null; render(); return; }
      if (a === "t-all") { if (requireAdmin("zeiten-all")) { state.timesAll = true; state.timesPerson = ""; render(); } return; }
      if (a === "t-back") { state.timesPerson = null; render(); return; }
      if (a === "t-add") { if (isUnlocked()) { state.timesEdit = { id: null, date: state.date, e: { pid: (state.cfg.people[0] || {}).id, role: "frueh", in: "08:30", out: null, pause: 0 } }; render(); } return; }
      if (a === "te-cancel") { state.timesEdit = null; state.confirm = null; render(); return; }
      if (a === "te-save") { if (isUnlocked()) saveTimeEdit(); return; }
      if (a === "te-del") {
        if (!isUnlocked() || !state.timesEdit || !state.timesEdit.id) return;
        if (state.confirm !== "te-del") { state.confirm = "te-del"; render(); return; }
        persistTime(state.timesEdit.date, state.timesEdit.id, null); state.timesEdit = null; state.confirm = null; render(); setStatus("Eintrag gelöscht"); return;
      }
      if (a === "t-xlsx") { if (isUnlocked()) saveExport(buildXlsx()); return; }
      if (a === "t-pdf") { if (isUnlocked()) saveExport(buildPdf()); return; }
      if (a === "pin-cancel") { state.pinStage = null; state.view = "schicht"; render(); return; }
      if (a === "open-plan") return setView("plan");
      if (a === "open-month") return setView("monat");
      if (a === "open-roster") { state.view = "dienst"; state.rosterMonth = state.date.slice(0, 7); state.rosterEdit = true; render(); return; }
      if (a === "export") return downloadBackup();
      if (a === "import-cancel") { state.importPreview = null; render(); return; }
      if (a === "import-apply") { if (isUnlocked()) applyImport(); return; }
      if (a === "backup-dir") return chooseBackupDir();
      if (a === "backup-now") return writeBackup("manual");
      if (a === "backup-open") { if (NATIVE) NATIVE.openBackupDir(); return; }
      if (a === "backup-forget") return forgetBackupDir();
      if (a === "person-del") return deletePerson(t.dataset.pid);
      if (a === "pin-change") { state.pinStage = { mode: "set", next: "admin" }; state.view = "pin"; render(); setTimeout(() => { const el = $("pin-in"); if (el) el.focus(); }, 0); return; }
      if (a === "lock") { state.unlockedUntil = 0; state.view = "schicht"; render(); return; }
      return;
    }
    if (t.dataset.roster) { if (isUnlocked()) { state.unlockedUntil = Date.now() + 10 * 60000; toggleRoster(t.dataset.roster, t.dataset.shift, t.dataset.pid); } else { state.rosterEdit = false; render(); } return; }
    if (t.id === "mrprev" || t.id === "mrnext") {
      const [yy, mm] = (state.rosterMonth || state.date.slice(0, 7)).split("-").map(Number);
      const nd = new Date(yy, mm - 1 + (t.id === "mrprev" ? -1 : 1), 1);
      state.rosterMonth = `${nd.getFullYear()}-${pad(nd.getMonth() + 1)}`; state.rosterDay = null; render(); return;
    }
    if (t.dataset.cols) { saveLayout({ cols: t.dataset.cols }); render(); return; }
    if (t.dataset.tperson) { state.timesPerson = t.dataset.tperson; render(); return; }
    if (t.dataset.tedit) {
      if (!isUnlocked()) return;
      state.unlockedUntil = Date.now() + 10 * 60000;
      const [date, id] = t.dataset.tedit.split("|"); const e = ((state.timesData.days || {})[date] || {})[id];
      if (e) { state.timesEdit = { id, date, e }; render(); }
      return;
    }
    if (t.dataset.tstep) { const sel = $(t.dataset.tstep); if (sel) { sel.selectedIndex = Math.max(0, Math.min(sel.options.length - 1, sel.selectedIndex + Number(t.dataset.dir))); } return; }
    if (t.id === "tprev" || t.id === "tnext") {
      const [yy, mm] = (state.timesMonth || state.date.slice(0, 7)).split("-").map(Number);
      const nd = new Date(yy, mm - 1 + (t.id === "tprev" ? -1 : 1), 1);
      state.timesMonth = `${nd.getFullYear()}-${pad(nd.getMonth() + 1)}`; state.timesData = null; render(); return;
    }
    if (t.dataset.rday) { if (isUnlocked()) { state.unlockedUntil = Date.now() + 10 * 60000; state.rosterDay = t.dataset.rday; render(); } return; }
    if (t.dataset.shiftsel) { const k = t.dataset.shiftsel; const plan = P(); state.shiftSel = k === focusShift(plan, timeCtx()) ? null : k; state.expanded.clear(); scrolledOnce = false; render(); return; }
    if (t.dataset.log) return logAlways(t.dataset.shift, t.dataset.log);
    if (t.dataset.unlog) return unlogAlways(t.dataset.shift, t.dataset.unlog);
    if (t.dataset.toggle) { const id = t.dataset.toggle; state.expanded.has(id) ? state.expanded.delete(id) : state.expanded.add(id); render(); return; }
    if (t.id === "mprev") return shiftMonths(-1);
    if (t.id === "mnext") return shiftMonths(1);
    if (t.dataset.date) { const sh = t.dataset.shift; goDate(t.dataset.date); state.view = "schicht"; state.shiftSel = sh; render(); return; }
    const stamp = (s) => ({ s, by: actorId(), at: new Date().toISOString() });
    if (t.dataset.id) { const c = state.checks[t.dataset.id]; setCheck(t.dataset.id, c && c.s === "done" ? null : stamp("done")); }
    else if (t.dataset.skip) { const c = state.checks[t.dataset.skip]; setCheck(t.dataset.skip, c && c.s === "na" ? null : stamp("na")); }
  });
  main.addEventListener("pointerdown", (e) => { const sp = e.target.closest && e.target.closest(".splitter"); if (sp) startDrag(e, sp); });
  main.addEventListener("dblclick", (e) => { if (e.target.closest && e.target.closest(".splitter")) { saveLayout({ side: LAYOUT_DEFAULT.side }); render(); } });
  main.addEventListener("keydown", (e) => {
    if (!(e.target.classList && e.target.classList.contains("splitter")) || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    e.preventDefault();
    saveLayout({ side: Math.min(900, Math.max(280, getLayout().side + (e.key === "ArrowLeft" ? 20 : -20))) });
    render(); const sp = root.querySelector(".splitter"); if (sp) sp.focus();
  });
  main.addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset.note) return queueNote(el.dataset.note, el.value);
    if (el.dataset.num && state.draft) {
      const n = parseInt(el.value, 10);
      const { parent, key } = getRef(el.dataset.num);
      parent[key] = Number.isFinite(n) ? Math.min(480, Math.max(0, n)) : 0;
      markDirty(); return;
    }
    if (el.dataset.path && state.draft && el.type !== "checkbox") { const { parent, key } = getRef(el.dataset.path); parent[key] = el.value; markDirty(); }
  });
  main.addEventListener("change", (e) => {
    const el = e.target;
    if (!state.draft) return;
    if (el.dataset.path && el.type === "checkbox") { const { parent, key } = getRef(el.dataset.path); parent[key] = el.checked; markDirty(); return; }
    if (el.dataset.time) {
      const t = normTime(el.value);
      if (!t) { setStatus("Bitte eine Uhrzeit wie 07:30 eingeben", true); el.value = getRef(el.dataset.time).parent[getRef(el.dataset.time).key]; return; }
      const { parent, key } = getRef(el.dataset.time); parent[key] = t;
      for (const k of KEYS) state.draft.plan[k].phases = sortPhases(state.draft.plan[k].phases);
      markDirty(); el.blur(); render(); return;
    }
    if (el.dataset.kind) {
      const { parent, key } = getRef(el.dataset.kind);
      parent[key].kind = el.value;
      parent[key].every = el.value === "rhythm" ? (parent[key].every || 60) : 0;
      markDirty(); render(); return;
    }
    if (el.dataset.move) {
      const parts = el.dataset.move.split(".");
      const shift = parts[0], pi = Number(parts[2]), ii = Number(parts[4]), target = Number(el.value);
      const phases = state.draft.plan[shift].phases;
      if (target === pi || !phases[target]) return;
      const [item] = phases[pi].items.splice(ii, 1);
      phases[target].items.push(item);
      markDirty(); render();
    }
  });
  main.addEventListener("submit", (e) => {
    e.preventDefault();
    if (e.target.id === "pinform") return submitPin($("pin-in").value);
    if (e.target.id === "addperson") return addPerson($("newperson").value);
  });
  main.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.person) return renamePerson(el.dataset.person, el.value);
    if (el.id === "importfile" && el.files && el.files[0]) return importBackup(el.files[0]);
    if (el.id === "planfile" && el.files && el.files[0]) return onPlanFile(el.files[0]);
    if (el.id === "t-person") { state.timesPerson = el.value; render(); return; }
    if (el.id === "autostart" && NATIVE) {
      NATIVE.setAutoStart(el.checked).then((on) => { nativeInfo = { ...(nativeInfo || {}), autoStart: !!on }; setStatus(on ? "Startet künftig beim Anmelden" : "Autostart aus"); }).catch(() => setStatus("Autostart konnte nicht geändert werden", true));
      return;
    }
    if (state.importPreview && !state.importPreview.error) {
      const ip = state.importPreview;
      if (el.id === "imp-month") { ip.month = Number(el.value); render(); return; }
      if (el.id === "imp-year") { const y = parseInt(el.value, 10); if (y >= 2020 && y <= 2100) ip.year = y; render(); return; }
    }
  });
  main.addEventListener("focusout", () => setTimeout(() => { if (renderPending) render(); }, 0));
  $("whoBtn").addEventListener("click", () => openPicker(true));

  // Uhr, Fälligkeiten und „mitlaufende" Spalten jede Minute aktualisieren (nur Anzeige).
  timers.push(setInterval(() => {
    if (["plan", "monat", "admin", "pin", "dienst", "zeiten"].includes(state.view)) { renderHeader(); maybeAskPerson(); maybeRemind(); }
    else render();
  }, 30000));

  // ---------- Start ----------
  render();
  (async () => {
    const api = opts.mode === "auto" && window.claude && typeof window.claude.use === "function" ? window.claude : null;
    if (opts.mode === "sharepoint") {
      db = createSpDb(opts);
      try { await db.ready(); }
      catch (e) { setStatus("SharePoint-Speicher nicht erreichbar: " + ((e && e.message) || "Fehler"), true); state.readOnly = true; }
    } else if (api) {
      try { db = await api.use("db"); } catch { db = null; }
      try { user = await api.use("user"); } catch { user = null; }
    }
    if (user) { try { myId = await user.id(); } catch { myId = null; } }
    state.mode = db ? "shared" : "local";
    if (user && typeof user.can === "function") {
      try { if ((await user.can("data.write")) === false) state.readOnly = true; } catch { /* unbekannt */ }
    }
    loadWho();
    if (state.mode === "local" && NATIVE) { try { nativeInfo = await NATIVE.info(); } catch { nativeInfo = null; } }
    else if (state.mode === "local") await loadBackupDir();
    setStatus(statusLine(), state.readOnly || !!backupHint());
    if (disposed) return;
    subscribeCfg();
    subscribeMonth();
    subscribeDay();
  })();

  return () => {
    disposed = true;
    timers.forEach((t) => { clearInterval(t); clearTimeout(t); });
    cleanups.forEach((f) => { try { f(); } catch { /* egal */ } });
    try { if (unsubDay) unsubDay(); if (unsubMonth) unsubMonth(); if (unsubCfg) unsubCfg(); } catch { /* egal */ }
    container.innerHTML = "";
  };
}
