#!/usr/bin/env node
// Hook PostToolUse (Write|Edit): pasa el archivo escrito por Prettier y ESLint --fix.
// Nunca bloquea: cualquier fallo termina en exit 0 y sin volcar salida.
// Solo actúa sobre archivos dentro del proyecto; ignora node_modules/.next/.git/references.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

function done() {
  process.exit(0);
}

let payload;
try {
  payload = JSON.parse(readFileSync(0, "utf8"));
} catch {
  done();
}

const raw = payload?.tool_response?.filePath ?? payload?.tool_input?.file_path;
if (!raw || typeof raw !== "string") done();

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const file = path.resolve(projectDir, raw);

// Fuera del proyecto -> no tocar.
const rel = path.relative(projectDir, file);
if (rel.startsWith("..") || path.isAbsolute(rel)) done();

// Rutas excluidas.
const parts = rel.split(/[\\/]/);
if (["node_modules", ".next", ".git", "references", "out", "build"].some((d) => parts.includes(d))) {
  done();
}

const run = (binRelPath, args) => {
  spawnSync(process.execPath, [path.join(projectDir, binRelPath), ...args, file], {
    cwd: projectDir,
    stdio: "ignore",
    timeout: 25000,
  });
};

// Prettier sobre cualquier extensión que entienda.
run("node_modules/prettier/bin/prettier.cjs", ["--write", "--ignore-unknown"]);

// ESLint --fix solo para fuentes JS/TS.
if (/\.(js|jsx|ts|tsx|mjs|cjs)$/.test(file)) {
  run("node_modules/eslint/bin/eslint.js", ["--fix", "--no-warn-ignored"]);
}

done();
