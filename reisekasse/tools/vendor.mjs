// Lädt Tesseract (Texterkennung) mit festen Versionen von npm nach public/vendor/tesseract/.
// Nicht committet (~16 MB). Vor dem lokalen Test und vor jedem Deploy ausführen: npm run vendor
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKGS = {
  'tesseract.js': '7.0.0',
  'tesseract.js-core': '7.0.0',
  '@tesseract.js-data/deu': '1.0.0',
  '@tesseract.js-data/eng': '1.0.0'
};
const out = fileURLToPath(new URL('../public/vendor/tesseract/', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'rk-vendor-'));

try {
  const unpack = (name) => {
    const spec = `${name}@${PKGS[name]}`;
    const file = execFileSync('npm', ['pack', spec, '--silent'], { cwd: tmp, encoding: 'utf8' }).trim().split('\n').pop();
    const dir = join(tmp, name.replace(/[@/]/g, '_'));
    mkdirSync(dir);
    execFileSync('tar', ['xzf', join(tmp, file), '-C', dir]);
    return join(dir, 'package');
  };
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'core'), { recursive: true });
  mkdirSync(join(out, 'lang'), { recursive: true });

  const js = unpack('tesseract.js');
  cpSync(join(js, 'dist/tesseract.min.js'), join(out, 'tesseract.min.js'));
  cpSync(join(js, 'dist/worker.min.js'), join(out, 'worker.min.js'));
  cpSync(join(js, 'LICENSE.md'), join(out, 'LICENSE-tesseract.js.md'));

  // Nur die LSTM-Varianten: tesseract.js wählt je nach Gerät (relaxed SIMD, SIMD, ohne) eine davon.
  const core = unpack('tesseract.js-core');
  for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']) {
    cpSync(join(core, f), join(out, 'core', f));
  }
  cpSync(join(core, 'LICENSE'), join(out, 'LICENSE-tesseract.js-core.txt'));

  for (const lang of ['deu', 'eng']) {
    const p = unpack(`@tesseract.js-data/${lang}`);
    cpSync(join(p, `4.0.0_best_int/${lang}.traineddata.gz`), join(out, 'lang', `${lang}.traineddata.gz`));
  }
  writeFileSync(join(out, 'VERSIONS.json'), JSON.stringify(PKGS, null, 2) + '\n');
  if (!existsSync(join(out, 'core/tesseract-core-lstm.wasm.js'))) throw new Error('Kern fehlt');
  console.log('Tesseract liegt in', out);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
