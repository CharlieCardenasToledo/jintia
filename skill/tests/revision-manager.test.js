"use strict";

/**
 * revision-manager.test.js — Snapshot inmutable + aprobación firmada.
 *
 * La firma real la produce Jintia Desktop en Rust (src-tauri/src/approval.rs,
 * fuera de este repo) — aquí se simula con un keypair Ed25519 generado con
 * el propio `crypto` de Node, firmando el MISMO payload canónico que
 * `canonicalizeApprovalPayload()` produce, para probar el lado de
 * VERIFICACIÓN (`checkApproval`) de punta a punta sin necesitar Rust.
 */

const test   = require("node:test");
const assert = require("node:assert/strict");
const fs     = require("node:fs");
const os     = require("node:os");
const path   = require("node:path");
const crypto = require("node:crypto");

const {
  computeManifestHash,
  snapshotSources,
  createRevisionSnapshot,
  checkApproval,
  canonicalizeApprovalPayload,
} = require("../scripts/revision-manager");

function tmpCourse() {
  const dir     = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-revision-"));
  const weekDir = path.join(dir, "semanas", "semana-01");
  fs.mkdirSync(weekDir, { recursive: true });
  return { dir, weekDir };
}

function writeMinimalGuide(weekDir, overrides = {}) {
  const guide = {
    metadata: { course: "C", week: 1, topic: "T", outcome: "O", hours: 1 },
    sections: [{ type: "orientation", route: ["a"], purpose: "p", materials: ["m"], successCriteria: ["sc"], estimatedMinutes: 5 }],
    ...overrides,
  };
  const guidePath = path.join(weekDir, "guide.json");
  fs.writeFileSync(guidePath, JSON.stringify(guide));
  const htmlPath = path.join(weekDir, "guide.html");
  fs.writeFileSync(htmlPath, "<html><body>guía</body></html>");
  return { guidePath, htmlPath, guide };
}

function signApproval(courseDir, weekDir, payload) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const pem = publicKey.export({ type: "spki", format: "pem" });
  fs.mkdirSync(path.join(courseDir, ".jintia"), { recursive: true });
  fs.writeFileSync(path.join(courseDir, ".jintia", "approval-public-key.pem"), pem);

  const signature = crypto.sign(null, canonicalizeApprovalPayload(payload), privateKey);
  fs.writeFileSync(path.join(weekDir, ".jintia-approval.json"), JSON.stringify(payload));
  fs.writeFileSync(path.join(weekDir, ".jintia-approval.sig"), signature.toString("base64"));
  return { publicKey, privateKey };
}

test("computeManifestHash es estable ante reordenar el array de entrada", () => {
  const a = computeManifestHash([{ relPath: "b.txt", content: "2" }, { relPath: "a.txt", content: "1" }]);
  const b = computeManifestHash([{ relPath: "a.txt", content: "1" }, { relPath: "b.txt", content: "2" }]);
  assert.equal(a.hash, b.hash);
});

test("computeManifestHash cambia si cambia cualquier byte de cualquier archivo del manifest", () => {
  const a = computeManifestHash([{ relPath: "a.txt", content: "1" }]);
  const b = computeManifestHash([{ relPath: "a.txt", content: "2" }]);
  assert.notEqual(a.hash, b.hash);
});

test("snapshotSources reúne guide.json, bibliografía y figuras (src, no visualSpec)", () => {
  const { dir, weekDir } = tmpCourse();
  try {
    fs.writeFileSync(path.join(weekDir, "reference.bib"), "@book{x, title={X}}");
    fs.mkdirSync(path.join(weekDir, "figure"), { recursive: true });
    fs.writeFileSync(path.join(weekDir, "figure", "f1.svg"), "<svg></svg>");
    const { guidePath } = writeMinimalGuide(weekDir, {
      metadata: { course: "C", week: 1, topic: "T", outcome: "O", hours: 1, bibliography: "reference.bib" },
      sections: [
        { type: "orientation", route: ["a"], purpose: "p", materials: ["m"], successCriteria: ["sc"], estimatedMinutes: 5 },
        { type: "figure", id: "f1", alt: "x", caption: "x", src: "figure/f1.svg" },
      ],
    });
    const { manifest } = snapshotSources(guidePath);
    const relPaths = manifest.map(m => m.relPath).sort();
    assert.deepEqual(relPaths, ["figure/f1.svg", "guide.json", "reference.bib"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("createRevisionSnapshot congela guide.json/guide.html/manifest.json en .jintia-revisions/<hash>/ y es idempotente", () => {
  const { dir, weekDir } = tmpCourse();
  try {
    const { guidePath, htmlPath } = writeMinimalGuide(weekDir);
    const first  = createRevisionSnapshot(guidePath, htmlPath);
    const second = createRevisionSnapshot(guidePath, htmlPath);
    assert.equal(first.hash, second.hash, "el mismo contenido de fuentes produce el mismo hash");
    assert.equal(first.path, second.path);

    assert.ok(fs.existsSync(path.join(first.path, "guide.json")));
    assert.ok(fs.existsSync(path.join(first.path, "guide.html")));
    assert.ok(fs.existsSync(path.join(first.path, "manifest.json")));
    assert.equal(fs.readFileSync(path.join(first.path, "guide.html"), "utf8"), "<html><body>guía</body></html>");

    const manifest = JSON.parse(fs.readFileSync(path.join(first.path, "manifest.json"), "utf8"));
    assert.equal(manifest.hash, first.hash);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("createRevisionSnapshot produce un hash distinto si cambia el contenido de guide.json", () => {
  const { dir, weekDir } = tmpCourse();
  try {
    const { guidePath, htmlPath } = writeMinimalGuide(weekDir);
    const before = createRevisionSnapshot(guidePath, htmlPath);
    writeMinimalGuide(weekDir, { metadata: { course: "Otro curso", week: 1, topic: "T", outcome: "O", hours: 1 } });
    const after = createRevisionSnapshot(guidePath, htmlPath);
    assert.notEqual(before.hash, after.hash);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("checkApproval: JIN-APR-001 si no existe ningún registro de aprobación", () => {
  const { dir, weekDir } = tmpCourse();
  try {
    const { guidePath } = writeMinimalGuide(weekDir);
    const result = checkApproval(guidePath);
    assert.equal(result.allowed, false);
    assert.equal(result.code, "JIN-APR-001");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("checkApproval: JIN-APR-003 si el registro de aprobación existe pero falta la clave pública de Desktop", () => {
  const { dir, weekDir } = tmpCourse();
  try {
    const { guidePath } = writeMinimalGuide(weekDir);
    const { hash } = snapshotSources(guidePath);
    // Escribe approval+sig SIN pasar por signApproval (que también escribe la clave pública).
    fs.writeFileSync(path.join(weekDir, ".jintia-approval.json"), JSON.stringify({ hash, week: 1, approvedAt: new Date().toISOString() }));
    fs.writeFileSync(path.join(weekDir, ".jintia-approval.sig"), "AAAA");
    const result = checkApproval(guidePath);
    assert.equal(result.allowed, false);
    assert.equal(result.code, "JIN-APR-003");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("checkApproval: JIN-APR-004 si la firma no verifica (ej. el agente fabricó el archivo a mano, sin la clave privada real)", () => {
  const { dir, weekDir } = tmpCourse();
  try {
    const { guidePath } = writeMinimalGuide(weekDir);
    const { hash } = snapshotSources(guidePath);
    const payload = { hash, week: 1, approvedAt: new Date().toISOString() };
    // Firma con UN keypair, pero deja la clave pública de OTRO keypair en el curso.
    const { privateKey } = crypto.generateKeyPairSync("ed25519");
    const { publicKey: otherPublicKey } = crypto.generateKeyPairSync("ed25519");
    fs.mkdirSync(path.join(dir, ".jintia"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".jintia", "approval-public-key.pem"), otherPublicKey.export({ type: "spki", format: "pem" }));
    const signature = crypto.sign(null, canonicalizeApprovalPayload(payload), privateKey);
    fs.writeFileSync(path.join(weekDir, ".jintia-approval.json"), JSON.stringify(payload));
    fs.writeFileSync(path.join(weekDir, ".jintia-approval.sig"), signature.toString("base64"));

    const result = checkApproval(guidePath);
    assert.equal(result.allowed, false);
    assert.equal(result.code, "JIN-APR-004");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("checkApproval: JIN-APR-002 si las fuentes cambiaron después de la aprobación", () => {
  const { dir, weekDir } = tmpCourse();
  try {
    const { guidePath } = writeMinimalGuide(weekDir);
    const { hash } = snapshotSources(guidePath);
    signApproval(dir, weekDir, { hash, week: 1, approvedAt: new Date().toISOString() });

    writeMinimalGuide(weekDir, { metadata: { course: "Cambiado", week: 1, topic: "T", outcome: "O", hours: 1 } });

    const result = checkApproval(guidePath);
    assert.equal(result.allowed, false);
    assert.equal(result.code, "JIN-APR-002");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("checkApproval: allowed:true con firma válida y fuentes sin cambios desde la aprobación", () => {
  const { dir, weekDir } = tmpCourse();
  try {
    const { guidePath, htmlPath } = writeMinimalGuide(weekDir);
    const { hash, path: revisionPath } = createRevisionSnapshot(guidePath, htmlPath);
    signApproval(dir, weekDir, { hash, week: 1, approvedAt: new Date().toISOString() });

    const result = checkApproval(guidePath);
    assert.equal(result.allowed, true);
    assert.equal(result.hash, hash);
    assert.equal(result.revisionPath, revisionPath);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
