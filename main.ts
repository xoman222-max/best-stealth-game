// Shadow Courier's entry program (Node 22, standard library only).
//
// It hands the game in: copies this repository's game/ and screenshots/
// into the output directory and writes dossier.json there, the summary the
// judge reads, using the vendored make.fun library. The grader runs
// `node main.ts` with no network, a read-only filesystem, and /output as
// the destination; locally, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps (from the kit's gate): only text_max_bytes shapes
// the dossier's bytes; the rest refuse an entry the scorer would refuse
// (more than 4 screenshots or one over 256 KiB; more than 993 files in
// game/ or 48 MiB of game files in all, or a game path over 1000 bytes).
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function copyTree(source, dest) {
  if (!existsSync(source)) return 0;
  cpSync(source, dest, { recursive: true });
  return countFiles(dest);
}

function countFiles(dir) {
  let n = 0;
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      const p = join(d, entry);
      if (statSync(p).isDirectory()) walk(p);
      else n++;
    }
  };
  walk(dir);
  return n;
}

// Rebuild the output directory from scratch so stale files never leak in.
rmSync(join(outDir, 'game'), { recursive: true, force: true });
rmSync(join(outDir, 'screenshots'), { recursive: true, force: true });
rmSync(join(outDir, 'dossier.json'), { force: true });
mkdirSync(outDir, { recursive: true });

const gameFiles = copyTree(join(repoRoot, 'game'), join(outDir, 'game'));
const shotFiles = copyTree(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));

const dossierBytes = buildDossier(outDir, DOSSIER_CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossierBytes);

console.log(
  `handed in ${gameFiles} game files and ${shotFiles} screenshots; ` +
  `dossier.json is ${dossierBytes.length} bytes`,
);
