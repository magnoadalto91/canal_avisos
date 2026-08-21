/**
 * Instala o hook de pre-commit. Roda sozinho depois de `npm install`, via o
 * script "prepare" do package.json.
 *
 * Hooks não viajam no repositório (.git/hooks não é versionado), então sem
 * isto cada clone começaria sem a trava.
 */
import { writeFileSync, chmodSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(raiz, ".git", "hooks");

// Em CI ou num tarball sem .git não há o que instalar, e falhar aqui
// quebraria o `npm install` sem motivo.
if (!existsSync(join(raiz, ".git"))) {
  process.exit(0);
}

mkdirSync(dir, { recursive: true });

const hook = `#!/bin/sh
# Gerado por scripts/install-hooks.mjs
exec node scripts/check-secrets.mjs
`;

const caminho = join(dir, "pre-commit");
writeFileSync(caminho, hook, { mode: 0o755 });
try {
  chmodSync(caminho, 0o755);
} catch {
  /* Windows ignora permissão de execução */
}

console.log("hook de pre-commit instalado");
