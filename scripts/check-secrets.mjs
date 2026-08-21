/**
 * Recusa o commit se houver segredo indo junto.
 *
 * Existe porque isso já aconteceu: o `.env.example` parece um arquivo local,
 * mas é versionado, e um `git add -A` distraído publica tudo que estiver nele
 * num repositório público. O prejuízo não é o arquivo — é ter que revogar
 * token de bot e trocar segredo depois que bot de varredura já leu.
 *
 * Instalado como hook de pre-commit por scripts/install-hooks.mjs.
 * Para rodar à mão:  npm run check:secrets
 */
import { execSync } from "node:child_process";

const problemas = [];

/** Conteúdo que está indexado (staged), não o do disco. */
function staged(file) {
  try {
    return execSync(`git show :${file}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null; // não está no índice
  }
}

function arquivosIndexados() {
  try {
    return execSync("git diff --cached --name-only --diff-filter=ACM", { encoding: "utf8" })
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

const arquivos = arquivosIndexados();

/* 1. Nenhum arquivo .example pode ter valor preenchido. */
for (const arquivo of arquivos.filter((f) => f.endsWith(".example"))) {
  const conteudo = staged(arquivo);
  if (!conteudo) continue;
  conteudo.split("\n").forEach((linha, i) => {
    const m = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.+)$/.exec(linha);
    if (m && m[2].trim()) {
      problemas.push(`${arquivo}:${i + 1}  ${m[1]} está preenchida — o valor vai para o .env.local`);
    }
  });
}

/* 2. Formatos de segredo reconhecíveis em qualquer arquivo indexado. */
const ASSINATURAS = [
  [/\b\d{8,10}:[A-Za-z0-9_-]{35}\b/, "token de bot do Telegram"],
  [/\bghp_[A-Za-z0-9]{36}\b/, "token do GitHub"],
  [/\bAKIA[0-9A-Z]{16}\b/, "chave de acesso da AWS"],
  [/\b[A-Za-z0-9_-]{20,}\.upstash\.io\b/, "endpoint do Upstash com credencial"],
];

for (const arquivo of arquivos) {
  if (arquivo === "scripts/check-secrets.mjs") continue; // os próprios padrões
  const conteudo = staged(arquivo);
  if (!conteudo) continue;
  for (const [padrao, nome] of ASSINATURAS) {
    if (padrao.test(conteudo)) problemas.push(`${arquivo}  parece conter ${nome}`);
  }
}

if (problemas.length) {
  console.error("\nCommit bloqueado — segredo detectado:\n");
  for (const p of problemas) console.error("  " + p);
  console.error("\nMova os valores para .env.local (que está no .gitignore).");
  console.error("Se for falso positivo:  git commit --no-verify\n");
  process.exit(1);
}
