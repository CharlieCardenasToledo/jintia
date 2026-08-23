"use strict";

/**
 * compile-publish-approval.test.js — `jintia compile --publish` exige una
 * aprobación humana vigente (ver scripts/revision-manager.js) y, cuando la
 * tiene, compila el guide.html congelado del snapshot, no una
 * re-renderización. Prueba el CLI real (bin/jintia.js como subproceso), no
 * solo la función checkApproval() en aislamiento (ya cubierta en
 * revision-manager.test.js) ni el camino equivalente dentro de ready.js
 * (ya cubierto en ready.test.js) — esto fija específicamente el cableado
 * del bloque `compile --publish` en bin/jintia.js.
 */

const test   = require("node:test");
const assert = require("node:assert/strict");
const fs     = require("node:fs");
const os     = require("node:os");
const path   = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

const { snapshotSources, canonicalizeApprovalPayload } = require("../scripts/revision-manager");

const ROOT   = path.resolve(__dirname, "..");
const JINTIA = path.join(ROOT, "bin", "jintia.js");

function createVivliostyleStub(stubDir) {
  const stubJs   = path.join(stubDir, "_vivliostyle-stub.js");
  const argsFile = path.join(stubDir, "vivliostyle-args.json");
  fs.writeFileSync(stubJs, `
"use strict";
const fs   = require("node:fs");
const args = process.argv.slice(2);
fs.writeFileSync(${JSON.stringify(argsFile)}, JSON.stringify({ args, cwd: process.cwd() }));
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

/** Guía completa sin citas/bibliografía (evita depender de Citation.js
 * para este test, que se enfoca en el gate de aprobación, no en el gate
 * bibliográfico — ya cubierto aparte en ready.test.js). */
function buildPublishReadyCourse() {
  const dir     = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-compile-approval-"));
  const weekDir = path.join(dir, "semanas", "semana-01");
  fs.mkdirSync(weekDir, { recursive: true });
  const guide = {
    metadata: {
      course: "C", week: 1, topic: "T", outcome: "Diferenciar entidad de atributo.", hours: 1,
      targets: [{ id: "T1", verb: "diferenciar", description: "Diferenciar entidad de atributo." }],
    },
    sections: [
      { type: "orientation", id: "o", route: ["Teoría", "Práctica", "Evaluación"], purpose: "p", materials: ["m"], successCriteria: ["sc"], estimatedMinutes: 5 },
      {
        type: "theory", id: "t", targetIds: ["T1"], claimIds: ["CLM-1"], estimatedMinutes: 20,
        content: "Una entidad es un objeto distinguible del mundo real sobre el cual se desea almacenar información dentro de un modelo de datos relacional. Cada entidad se representa mediante una tabla, y cada instancia particular de esa entidad corresponde a una fila de dicha tabla. Un atributo, en cambio, es una propiedad o característica que describe a una entidad — por ejemplo, el nombre, la edad o el correo electrónico de un estudiante son atributos de la entidad Estudiante. La diferencia central es que la entidad representa el concepto o el objeto completo, mientras que el atributo representa un dato específico que ese objeto posee. Confundir ambos niveles es un error frecuente al diseñar un modelo entidad-relación, y suele producir tablas mal normalizadas con redundancia innecesaria de información repetida en múltiples filas.",
      },
      {
        type: "practice", id: "p", mode: "guided", targetIds: ["T1"], estimatedMinutes: 20,
        workedExample: "Ejemplo resuelto: en el enunciado 'un estudiante tiene nombre, cédula y correo', Estudiante es la entidad porque es el objeto sobre el que se recopila información, mientras que nombre, cédula y correo son atributos porque describen propiedades individuales de ese objeto.",
        prompt: "Clasifica los siguientes términos de un sistema de biblioteca en entidades o atributos: Libro, título, Autor, fecha de publicación, Préstamo.",
        steps: ["Identifica los términos que representan objetos completos del dominio.", "Identifica los términos que describen una propiedad de otro término.", "Clasifica cada uno como entidad o atributo y justifica brevemente tu elección."],
        successCriteria: ["Clasifica correctamente al menos 3 de los 5 términos propuestos."],
        selfCheck: "Compara tu clasificación contra la solución modelo: Libro y Autor y Préstamo son entidades; título y fecha de publicación son atributos.",
        remediation: "Si tu clasificación no coincide, repite el ejercicio únicamente con el ejemplo trabajado (Estudiante/nombre/cédula/correo) antes de volver a intentar el caso de la biblioteca.",
      },
      { type: "assessment", id: "e", targetIds: ["T1"], estimatedMinutes: 15, product: "Lista de 5 términos clasificados.", criteria: [{ description: "Clasificación correcta", weight: 100 }] },
    ],
  };
  const guidePath = path.join(weekDir, "guide.json");
  fs.writeFileSync(guidePath, JSON.stringify(guide));
  fs.writeFileSync(path.join(weekDir, "evidence.json"), JSON.stringify({ week: 1, claims: [{ id: "CLM-1", claim: "x", sourceMode: "ai-fallback", targetId: "T1" }] }));
  return { dir, weekDir, guidePath };
}

function grantApproval(dir, weekDir, guidePath) {
  const { hash } = snapshotSources(guidePath);
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  fs.mkdirSync(path.join(dir, ".jintia"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".jintia", "approval-public-key.pem"), publicKey.export({ type: "spki", format: "pem" }));
  const payload = { hash, week: 1, approvedAt: new Date().toISOString() };
  const signature = crypto.sign(null, canonicalizeApprovalPayload(payload), privateKey);
  fs.writeFileSync(path.join(weekDir, ".jintia-approval.json"), JSON.stringify(payload));
  fs.writeFileSync(path.join(weekDir, ".jintia-approval.sig"), signature.toString("base64"));
  return hash;
}

test("REGRESIÓN — jintia compile --publish (CLI real) bloquea con JIN-APR-001 sin ninguna aprobación previa", () => {
  const { dir, guidePath } = buildPublishReadyCourse();
  try {
    const result = spawnSync(process.execPath, [JINTIA, "compile", guidePath, "--publish"], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /JIN-APR-001/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("jintia compile --publish (CLI real) compila el guide.html del snapshot aprobado, no una re-renderización, cuando la aprobación es válida", () => {
  const { dir, weekDir, guidePath } = buildPublishReadyCourse();
  try {
    // 1. jintia ready --skip-pdf congela el snapshot y reporta su hash.
    const readyResult = spawnSync(process.execPath, [JINTIA, "ready", guidePath, "--skip-pdf", "--json"], { encoding: "utf8" });
    const readyReport = JSON.parse(readyResult.stdout);
    assert.notEqual(readyReport.data.deterministicDecision, "BLOCKED", JSON.stringify(readyReport.data.issues));
    assert.ok(readyReport.data.revision?.hash, "debe congelar un snapshot y reportar su hash aunque queden warnings pendientes");
    const hash = readyReport.data.revision.hash;
    const revisionPath = readyReport.data.revision.path;

    // 2. Aprobar (simulando lo que Jintia Desktop hace en Rust).
    grantApproval(dir, weekDir, guidePath);

    // 3. Marcar el guide.html DENTRO del snapshot con un comentario único —
    // si compile usara una re-renderización en vez del snapshot, este
    // marcador no aparecería en el HTML que llega a Vivliostyle.
    const revisionHtmlPath = path.join(revisionPath, "guide.html");
    const marked = fs.readFileSync(revisionHtmlPath, "utf8") + "<!-- MARCADOR-SNAPSHOT-CONGELADO -->";
    fs.writeFileSync(revisionHtmlPath, marked);

    const argsFile = createVivliostyleStub(dir);
    const env = { ...process.env, PATH: `${dir}${path.delimiter}${process.env.PATH || ""}` };
    const compileResult = spawnSync(process.execPath, [JINTIA, "compile", guidePath, "--publish"], { env, encoding: "utf8" });

    assert.equal(compileResult.status, 0, compileResult.stderr);
    assert.ok(fs.existsSync(argsFile), "el stub de vivliostyle debe haber sido invocado");
    const { args: stubArgs, cwd: stubCwd } = JSON.parse(fs.readFileSync(argsFile, "utf8"));
    // buildPdf() convierte a rutas relativas antes de invocar el binario
    // real (evita el falso "overwrite" de Vivliostyle CLI con rutas
    // absolutas — ver CHANGELOG 12.4.3) y fija cwd al directorio del HTML de
    // entrada; hay que resolver contra ESE cwd, no contra el del test.
    const relativeHtmlArg = stubArgs.find(a => a.endsWith("guide.html"));
    const compiledHtmlPath = path.resolve(stubCwd, relativeHtmlArg);
    assert.equal(compiledHtmlPath, path.resolve(revisionHtmlPath), "debe compilar exactamente el guide.html del snapshot aprobado");
    assert.match(fs.readFileSync(compiledHtmlPath, "utf8"), /MARCADOR-SNAPSHOT-CONGELADO/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
