"use strict";

/**
 * regression-compile-schema-bypass.test.js — Incidente 2026-08-23
 *
 * Un guide.json redactado a mano con campos en español (metadata.asignatura/
 * semana/titulo, section.titulo/contenido) llegó a producir un guide.html y
 * un guide.pdf "compilados con éxito" pero vacíos, porque el agente ejecutó
 * `jintia compile guide.json` sin `--publish`. Esa variante no corría
 * ninguna validación de schema/contenido — iba directo de guide.json a PDF.
 *
 * Este test fija dos invariantes:
 *  1. `jintia compile` (con o sin --publish) debe bloquear ese guide.json
 *     ANTES de generar guide.html o guide.pdf.
 *  2. Un guide.json correctamente formado sigue compilando sin problemas
 *     (los gates nuevos no deben producir falsos positivos).
 */

const test   = require("node:test");
const assert = require("node:assert/strict");
const fs     = require("node:fs");
const os     = require("node:os");
const path   = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT       = path.resolve(__dirname, "..");
const JINTIA     = path.join(ROOT, "bin", "jintia.js");
const FIXTURES   = path.join(__dirname, "fixtures");
const BAD_GUIDE  = path.join(FIXTURES, "regression-2026-08-23-guide-es-fields.json");
const GOOD_GUIDE = path.join(FIXTURES, "guide-sample.json");

function createVivliostyleStub(stubDir) {
  const stubJs   = path.join(stubDir, "_vivliostyle-stub.js");
  const argsFile = path.join(stubDir, "vivliostyle-args.json");
  fs.writeFileSync(stubJs, `
"use strict";
const fs   = require("node:fs");
const args = process.argv.slice(2);
fs.writeFileSync(${JSON.stringify(argsFile)}, JSON.stringify(args));
const outIdx = args.indexOf("--output");
if (outIdx >= 0 && args[outIdx + 1]) fs.writeFileSync(args[outIdx + 1], "%PDF-1.4 jintia-stub\\n");
process.exit(0);
`);
  if (process.platform === "win32") {
    fs.writeFileSync(path.join(stubDir, "vivliostyle.cmd"), `@echo off\nnode "${stubJs}" %*\n`);
  } else {
    const sh = path.join(stubDir, "vivliostyle");
    fs.writeFileSync(sh, `#!/bin/sh\nexec node "${stubJs}" "$@"\n`);
    fs.chmodSync(sh, "755");
  }
  return argsFile;
}

test("REGRESIÓN 2026-08-23 — compile sin --publish bloquea guide.json con campos en español (antes producía PDF vacío)", () => {
  const tmpDir    = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-reg-bypass-"));
  const guideDst  = path.join(tmpDir, "guide.json");
  fs.copyFileSync(BAD_GUIDE, guideDst);

  const result = spawnSync(process.execPath, [JINTIA, "compile", guideDst], {
    encoding: "utf8", stdio: "pipe", cwd: tmpDir,
  });

  try {
    assert.notEqual(result.status, 0, "compile debe fallar (exit != 0) con un guide.json inválido");
    assert.match(
      result.stderr,
      /bloqueado por incidencias pedag/i,
      `stderr debe explicar el bloqueo por schema/pedagogía: ${result.stderr}`,
    );
    assert.ok(
      !fs.existsSync(path.join(tmpDir, "guide.html")),
      "guide.html NO debe generarse cuando el schema bloquea",
    );
    assert.ok(
      !fs.existsSync(path.join(tmpDir, "guide.pdf")),
      "guide.pdf NO debe generarse cuando el schema bloquea",
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("REGRESIÓN 2026-08-23 — compile --publish también bloquea el mismo guide.json inválido", () => {
  const tmpDir   = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-reg-bypass-pub-"));
  const guideDst = path.join(tmpDir, "guide.json");
  fs.copyFileSync(BAD_GUIDE, guideDst);

  const result = spawnSync(process.execPath, [JINTIA, "compile", guideDst, "--publish"], {
    encoding: "utf8", stdio: "pipe", cwd: tmpDir,
  });

  try {
    assert.notEqual(result.status, 0, "compile --publish debe fallar con un guide.json inválido");
    assert.ok(!fs.existsSync(path.join(tmpDir, "guide.pdf")), "guide.pdf NO debe generarse");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("REGRESIÓN 2026-08-23 — jintia validate reporta los alias ES→EN para metadata y sections", () => {
  const tmpDir   = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-reg-validate-"));
  const guideDst = path.join(tmpDir, "guide.json");
  fs.copyFileSync(BAD_GUIDE, guideDst);

  const result = spawnSync(process.execPath, [JINTIA, "validate", guideDst], {
    encoding: "utf8", stdio: "pipe", cwd: tmpDir,
  });

  try {
    const out = result.stdout + result.stderr;
    assert.notEqual(result.status, 0, "validate debe fallar con este guide.json");
    assert.match(out, /asignatura/, "debe señalar metadata.asignatura como propiedad no permitida");
    assert.match(out, /alias ES.*course/i, "debe sugerir el alias 'course' para 'asignatura'");
    assert.match(out, /titulo/, "debe señalar section.titulo como propiedad no permitida");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("REGRESIÓN 2026-08-23 — un guide.json correcto sigue compilando (los gates nuevos no dan falsos positivos)", () => {
  const tmpDir   = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-reg-ok-"));
  const argsFile = createVivliostyleStub(tmpDir);
  const outDir   = path.join(tmpDir, "out");
  fs.mkdirSync(outDir);
  const guideDst = path.join(outDir, "guide.json");
  fs.copyFileSync(GOOD_GUIDE, guideDst);
  // guide-sample.json cita {{cite:codd1970}}/{{cite:date2004}}: sin el .bib
  // real, el gate de degradación bibliográfica (siempre activo en compile)
  // bloquearía esto correctamente como bibliografía rota, no como falso positivo.
  fs.copyFileSync(path.join(FIXTURES, "reference.bib"), path.join(outDir, "reference.bib"));

  const env    = { ...process.env, PATH: `${tmpDir}${path.delimiter}${process.env.PATH || ""}` };
  const result = spawnSync(process.execPath, [JINTIA, "compile", guideDst], {
    env, encoding: "utf8", stdio: "pipe", cwd: outDir,
  });

  try {
    assert.equal(result.status, 0, `compile no debería fallar con un guide.json válido: ${result.stderr}`);
    assert.ok(fs.existsSync(path.join(outDir, "guide.html")), "guide.html debe generarse");
    assert.ok(fs.existsSync(argsFile), "vivliostyle (stub) debe haber sido invocado");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
