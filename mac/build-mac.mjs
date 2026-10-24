// Baut die Mac-App als ZIP – standardmäßig für Apple-Chip (arm64), mit ARCHS=arm64,x64 auch für Intel.
// Aufruf (im Ordner mac/): npm install && npm run build
// Optional: RCODESIGN=/pfad/zu/rcodesign → Ad-hoc-Signatur (nötig, damit die App auf Apple-Chips startet).
// Optional: ELECTRON_ZIP_DIR=/ordner mit electron-v<version>-darwin-<arch>.zip → kein Download durch den Packer.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { packager } from "@electron/packager";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..");
const stage = join(here, "stage");
const dist = join(here, "dist");
const pkg = JSON.parse(readFileSync(join(here, "package.json"), "utf8"));

// 1. App-Seite neu erzeugen und Dateien bereitstellen
execFileSync(process.execPath, [join(repo, "tools/build.mjs")], { stdio: "inherit" });
rmSync(stage, { recursive: true, force: true });
mkdirSync(join(stage, "app/pdfjs"), { recursive: true });
cpSync(join(here, "main.js"), join(stage, "main.js"));
cpSync(join(here, "preload.js"), join(stage, "preload.js"));
cpSync(join(repo, "index.html"), join(stage, "app/index.html"));
// Check-in-Erstattung (Reiter „Erstattung“) mit SheetJS lokal, damit Excel auch ohne Internet geht.
cpSync(join(repo, "checkin.html"), join(stage, "app/checkin.html"));
mkdirSync(join(stage, "app/vendor"), { recursive: true });
cpSync(join(here, "node_modules/xlsx/dist/xlsx.full.min.js"), join(stage, "app/vendor/xlsx.full.min.js"));
for (const f of ["pdf.min.mjs", "pdf.worker.min.mjs"]) cpSync(join(here, "node_modules/pdfjs-dist/build", f), join(stage, "app/pdfjs", f));
writeFileSync(join(stage, "package.json"), JSON.stringify({ name: pkg.name, productName: pkg.productName, version: pkg.version, description: pkg.description, main: "main.js" }, null, 2));

// 2. Für beide Prozessoren packen
rmSync(dist, { recursive: true, force: true });
const paths = await packager({
  dir: stage, out: dist, overwrite: true, asar: true, prune: false,
  // Standard: nur Apple-Chip (M1 …). ARCHS=arm64,x64 baut zusätzlich die Intel-Version.
  platform: "darwin", arch: (process.env.ARCHS || "arm64").split(","),
  name: "Rezeption", executableName: "Rezeption",
  appBundleId: "de.rezeption.schichtcheck", appCategoryType: "public.app-category.business",
  appVersion: pkg.version, buildVersion: pkg.version,
  icon: join(here, "icon.icns"),
  electronVersion: pkg.devDependencies.electron,
  ...(process.env.ELECTRON_ZIP_DIR ? { electronZipDir: process.env.ELECTRON_ZIP_DIR } : {}),
  extendInfo: { NSHumanReadableCopyright: "Rezeption Schichtcheck", CFBundleDevelopmentRegion: "de" },
});

// 3. Ad-hoc signieren und zippen (zip -y erhält die Symlinks im Electron-Framework)
const names = { arm64: "Rezeption-AppleChip.zip", x64: "Rezeption-Intel.zip" };
for (const p of paths) {
  const arch = p.endsWith("arm64") ? "arm64" : "x64";
  const appPath = join(p, "Rezeption.app");
  if (process.env.RCODESIGN && existsSync(process.env.RCODESIGN)) {
    execFileSync(process.env.RCODESIGN, ["sign", appPath], { stdio: ["ignore", "ignore", "inherit"] });
    console.log("signiert (ad-hoc):", arch);
  } else {
    console.warn("WARNUNG: nicht signiert (RCODESIGN fehlt) – auf Apple-Chips startet die App dann erst nach `codesign --force --deep -s -`.");
  }
  execFileSync("zip", ["-qry", join(dist, names[arch]), "Rezeption.app"], { cwd: p });
  console.log("fertig:", join(dist, names[arch]));
}
