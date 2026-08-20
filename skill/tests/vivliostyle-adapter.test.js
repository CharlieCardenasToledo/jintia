"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const childProcess = require("node:child_process");

const ADAPTER_PATH = require.resolve("../scripts/vivliostyle-adapter.js");

function withMockedSpawnSync(impl, run) {
  const original = childProcess.spawnSync;
  const originalEnv = process.env.JINTIA_VIVLIOSTYLE_BIN;
  // Fuerza la ruta "administrada" (sin extensión .cmd) para que checkVivliostyle()
  // llame directo a spawnSync(bin, [..., "--version"]) sin pasar por where.exe/which.
  process.env.JINTIA_VIVLIOSTYLE_BIN = path.join(os.tmpdir(), "fake-vivliostyle-bin");
  childProcess.spawnSync = impl;
  delete require.cache[ADAPTER_PATH];
  try {
    const adapter = require(ADAPTER_PATH);
    return run(adapter);
  } finally {
    childProcess.spawnSync = original;
    if (originalEnv === undefined) delete process.env.JINTIA_VIVLIOSTYLE_BIN;
    else process.env.JINTIA_VIVLIOSTYLE_BIN = originalEnv;
    delete require.cache[ADAPTER_PATH];
  }
}

function tmpHtml() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-vivliostyle-test-"));
  const htmlPath = path.join(dir, "guide.html");
  fs.writeFileSync(htmlPath, "<html><body>test</body></html>");
  return { dir, htmlPath, outputPath: path.join(dir, "guide.pdf") };
}

test("buildPdf: acepta un PDF ya escrito aunque el proceso muera por timeout", () => {
  const { dir, htmlPath, outputPath } = tmpHtml();
  try {
    withMockedSpawnSync((bin, args) => {
      if (args.includes("--version")) {
        return { status: 0, stdout: "1.0.0", stderr: "" };
      }
      // Simula que Vivliostyle sí completó el PDF justo antes de que
      // spawnSync matara el proceso por timeout.
      fs.writeFileSync(outputPath, "%PDF-1.7 fake");
      const error = new Error("spawnSync vivliostyle ETIMEDOUT");
      error.code = "ETIMEDOUT";
      return { status: null, signal: "SIGTERM", error, stdout: "", stderr: "" };
    }, (adapter) => {
      const result = adapter.buildPdf(htmlPath, outputPath, { timeout: 10 });
      assert.equal(result, path.resolve(outputPath));
      assert.ok(fs.existsSync(outputPath));
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("buildPdf: sigue fallando si el timeout ocurre sin que exista el PDF", () => {
  const { dir, htmlPath, outputPath } = tmpHtml();
  try {
    withMockedSpawnSync((bin, args) => {
      if (args.includes("--version")) {
        return { status: 0, stdout: "1.0.0", stderr: "" };
      }
      const error = new Error("spawnSync vivliostyle ETIMEDOUT");
      error.code = "ETIMEDOUT";
      return { status: null, signal: "SIGTERM", error, stdout: "", stderr: "" };
    }, (adapter) => {
      assert.throws(() => adapter.buildPdf(htmlPath, outputPath, { timeout: 10 }), /ETIMEDOUT/);
      assert.ok(!fs.existsSync(outputPath));
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("buildPdf: un error de spawn que no es timeout (ej. binario ausente) sigue lanzando aunque exista un PDF viejo", () => {
  const { dir, htmlPath, outputPath } = tmpHtml();
  try {
    // PDF preexistente de una corrida anterior — no debe engañar al fallback.
    fs.writeFileSync(outputPath, "%PDF-1.7 old");
    withMockedSpawnSync((bin, args) => {
      if (args.includes("--version")) {
        return { status: 0, stdout: "1.0.0", stderr: "" };
      }
      const error = new Error("spawnSync vivliostyle ENOENT");
      error.code = "ENOENT";
      return { status: null, signal: null, error, stdout: "", stderr: "" };
    }, (adapter) => {
      assert.throws(() => adapter.buildPdf(htmlPath, outputPath, { timeout: 10 }), /ENOENT/);
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("buildPdf: comportamiento previo se conserva — código de salida != 0 con PDF existente es éxito", () => {
  const { dir, htmlPath, outputPath } = tmpHtml();
  try {
    withMockedSpawnSync((bin, args) => {
      if (args.includes("--version")) {
        return { status: 0, stdout: "1.0.0", stderr: "" };
      }
      fs.writeFileSync(outputPath, "%PDF-1.7 fake");
      return { status: 1, signal: null, error: null, stdout: "", stderr: "warning tratado como error" };
    }, (adapter) => {
      const result = adapter.buildPdf(htmlPath, outputPath, { timeout: 10 });
      assert.equal(result, path.resolve(outputPath));
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
