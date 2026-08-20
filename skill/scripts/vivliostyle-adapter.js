#!/usr/bin/env node
"use strict";

/**
 * vivliostyle-adapter.js — Adaptador Vivliostyle CLI para Jintia
 *
 * Invoca Vivliostyle CLI como proceso EXTERNO e INDEPENDIENTE mediante
 * spawnSync. Nunca importa la API interna de @vivliostyle/cli.
 * Esto preserva la licencia MIT de Jintia (Vivliostyle usa AGPL-3.0).
 *
 * Uso CLI:
 *   node scripts/vivliostyle-adapter.js guide.html [--output guide.pdf] [--size A4]
 *
 * Uso programático:
 *   const { buildPdf, checkVivliostyle } = require("./vivliostyle-adapter");
 *   buildPdf("guide.html", "guide.pdf");
 */

const { spawnSync } = require("node:child_process");
const fs   = require("node:fs");
const path = require("node:path");

// ─── Detección de Vivliostyle ─────────────────────────────────────────────────

/**
 * Resuelve un ejecutable en PATH y devuelve cómo invocarlo de forma segura.
 *
 * En Windows, los wrappers npm son archivos .cmd que requieren cmd.exe para
 * ejecutarse. En lugar de usar shell: true (que expone metacaracteres), usamos
 * where.exe para obtener la ruta absoluta y luego invocamos a través de
 * `cmd.exe /C <path_absoluto>` con los args separados (Node los escapa correctamente).
 *
 * @param {string} name - Nombre base del ejecutable (sin extensión)
 * @returns {{ exe: string, prefix: string[] }|null}
 *   exe: ruta resuelta; prefix: argumentos de pre-cmd (vacío en Unix, ["/C", exe] en Windows)
 */
function resolveExecutable(name) {
  if (process.platform !== "win32") {
    const probe = spawnSync("which", [name], { encoding: "utf8", stdio: "pipe", shell: false });
    if (probe.status === 0) {
      const resolved = probe.stdout.trim().split(/\n/)[0];
      if (resolved) return { exe: resolved, prefix: [resolved] };
    }
    return null;
  }

  // Windows: where.exe busca por nombre base (incluye .cmd, .ps1, .exe según PATHEXT)
  const probe = spawnSync("where.exe", [name], { encoding: "utf8", stdio: "pipe", shell: false });
  if (probe.status === 0) {
    const lines = (probe.stdout || "").trim().split(/\r?\n/).filter(l => l.trim());
    // Preferir .cmd/.exe sobre scripts Unix sin extensión (where.exe puede devolver ambos)
    const resolved = lines.find(l => /\.(cmd|exe|bat)$/i.test(l)) || lines[0];
    if (resolved) {
      const isCmd = /\.(cmd|bat)$/i.test(resolved);
      // Para .cmd: invocamos como cmd.exe /C "ruta_absoluta" [args...]
      // Usamos COMSPEC (ruta absoluta a cmd.exe) para no depender de PATH.
      const cmdExe = process.env.COMSPEC || "cmd.exe";
      const prefix = isCmd ? [cmdExe, "/C", resolved] : [resolved];
      return { exe: resolved, prefix };
    }
  }
  return null;
}

/**
 * Comprueba si Vivliostyle CLI está disponible.
 * Primero verifica la ruta administrada por Jintia Desktop (JINTIA_VIVLIOSTYLE_BIN),
 * luego recurre a la búsqueda en PATH via where.exe / which.
 * @returns {{ ok: boolean, version?: string, command: string, invoker: string[] }}
 */
function checkVivliostyle() {
  // Ruta administrada: Jintia Desktop establece esta variable apuntando al
  // ejecutable exacto, evitando depender de que where.exe encuentre el .cmd en PATH.
  const managedBin = process.env.JINTIA_VIVLIOSTYLE_BIN;
  if (managedBin) {
    const isCmd = /\.(cmd|bat)$/i.test(managedBin);
    const cmdExe = process.env.COMSPEC || "cmd.exe";
    const invoker = isCmd ? [cmdExe, "/C", managedBin] : [managedBin];
    const [bin, ...cmdArgs] = invoker;
    const probe = spawnSync(bin, [...cmdArgs, "--version"], {
      encoding: "utf8",
      stdio:    "pipe",
      shell:    false,
    });
    if (probe.status === 0) {
      return {
        ok:      true,
        version: (probe.stdout || "").trim(),
        command: managedBin,
        invoker,
      };
    }
  }

  for (const name of ["vivliostyle", "viv"]) {
    const resolved = resolveExecutable(name);
    if (!resolved) continue;
    const [bin, ...cmdArgs] = resolved.prefix;
    const probe = spawnSync(bin, [...cmdArgs, "--version"], {
      encoding: "utf8",
      stdio:    "pipe",
      shell:    false,
    });
    if (probe.status === 0) {
      return {
        ok:      true,
        version: (probe.stdout || "").trim(),
        command: resolved.exe,
        invoker: resolved.prefix,
      };
    }
  }
  return { ok: false, command: "vivliostyle", invoker: ["vivliostyle"] };
}

// ─── Compilación PDF ──────────────────────────────────────────────────────────

/**
 * Convierte un archivo HTML a PDF usando Vivliostyle CLI.
 *
 * ⚠ IMPORTANTE: Solo usa spawnSync con el ejecutable del sistema.
 *   Nunca importar require("@vivliostyle/cli") — eso convertiría Jintia
 *   en un programa combinado bajo AGPL-3.0.
 *
 * @param {string} htmlPath   - Ruta al archivo HTML de entrada
 * @param {string} outputPath - Ruta al PDF de salida
 * @param {object} [options]
 * @param {string} [options.size]       - Tamaño de página (default: "A4")
 * @param {string} [options.theme]      - Ruta a CSS de tema adicional
 * @param {string} [options.timeout]    - Timeout en ms (default: 60000)
 * @param {boolean} [options.verbose]   - Salida detallada
 */
function buildPdf(htmlPath, outputPath, options = {}) {
  const vivliostyle = checkVivliostyle();

  if (!vivliostyle.ok) {
    throw new Error(
      "Vivliostyle CLI no encontrado. Instálalo con:\n" +
      "  npm install --global @vivliostyle/cli\n" +
      "Requiere Node.js >=22.12.0."
    );
  }

  const absHtml   = path.resolve(htmlPath);
  const absOutput = path.resolve(outputPath);

  if (!fs.existsSync(absHtml)) {
    throw new Error(`Archivo HTML no encontrado: ${absHtml}`);
  }

  fs.mkdirSync(path.dirname(absOutput), { recursive: true });

  const args = [
    "build",
    absHtml,
    "--output",   absOutput,
    "--size",     options.size || "A4",
  ];

  if (options.theme)   args.push("--theme",   path.resolve(options.theme));
  if (options.verbose) args.push("--verbose");

  if (options.verbose) {
    console.log(`[vivliostyle-adapter] ${vivliostyle.invoker.join(" ")} ${args.join(" ")}`);
  }

  // invoker = [exec, ...prefixArgs] — cmd.exe /C path.cmd en Windows, path directo en Unix
  const [bin, ...invokerArgs] = vivliostyle.invoker;
  const result = spawnSync(bin, [...invokerArgs, ...args], {
    encoding: "utf8",
    stdio:    "inherit",
    shell:    false,
    timeout:  options.timeout || 60_000,
  });

  if (result.error) {
    // spawnSync agota el timeout y mata el proceso (SIGTERM) antes de que
    // Vivliostyle termine de reportar su salida — pero el PDF puede haber
    // quedado completamente escrito en disco justo antes del kill (frecuente
    // en el primer render tras una instalación en frío: antivirus escaneando
    // binarios recién descargados, arranque en frío del motor de páginas).
    // Igual que abajo con un código de salida != 0, se acepta como éxito si
    // el archivo de salida realmente existe.
    const killedByTimeout = result.error.code === "ETIMEDOUT" || Boolean(result.signal);
    if (!killedByTimeout || !fs.existsSync(absOutput)) {
      throw result.error;
    }
  }

  // Si el PDF fue generado, consideramos éxito aunque vivliostyle salga con código != 0
  // (ocurre en algunos entornos donde emite advertencias tratadas como errores).
  if (result.status !== 0 && !fs.existsSync(absOutput)) {
    throw new Error(
      `Vivliostyle terminó con código de salida ${result.status}.\n` +
      "Verifica que el HTML sea válido y que el tema CSS esté accesible."
    );
  }

  return absOutput;
}

// ─── Vista previa (abre en navegador) ────────────────────────────────────────

/**
 * Lanza el servidor de vista previa de Vivliostyle.
 * @param {string} htmlPath
 * @param {object} [options]
 * @param {number} [options.port] - Puerto (default: 13000)
 */
function previewHtml(htmlPath, options = {}) {
  const vivliostyle = checkVivliostyle();

  if (!vivliostyle.ok) {
    throw new Error("Vivliostyle CLI no encontrado. Ver instrucciones de instalación.");
  }

  const absHtml = path.resolve(htmlPath);
  const port    = options.port || 13000;

  const args = ["preview", absHtml, "--port", String(port)];

  console.log(`[vivliostyle-adapter] Iniciando vista previa en http://localhost:${port}`);
  console.log("Presiona Ctrl+C para detener.");

  const { spawn } = require("node:child_process");
  const [bin, ...invokerArgs] = vivliostyle.invoker;
  const child = spawn(bin, [...invokerArgs, ...args], {
    stdio: "inherit",
    shell: false,
  });

  child.on("error", err => {
    console.error(`[vivliostyle-adapter] Error al iniciar vista previa: ${err.message}`);
    process.exit(1);
  });

  child.on("exit", code => {
    process.exit(code || 0);
  });
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args      = process.argv.slice(2);
  const subcommand = args[0];

  function argValue(name) {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  }

  if (subcommand === "--version" || subcommand === "version") {
    const v = checkVivliostyle();
    console.log(v.ok
      ? `Vivliostyle CLI: ${v.version} (${v.command})`
      : "Vivliostyle CLI: no encontrado"
    );
    process.exit(v.ok ? 0 : 1);
  }

  if (subcommand === "preview") {
    const htmlPath = args[1] || "guide.html";
    try {
      previewHtml(htmlPath, { port: Number(argValue("--port")) || 13000 });
    } catch (err) {
      console.error(`vivliostyle-adapter: ${err.message}`);
      process.exit(1);
    }
    return; // child process mantiene el proceso vivo
  }

  // Por defecto: build
  const htmlPath   = args.find(a => !a.startsWith("--") && a !== "build") || "guide.html";
  const outputPath = argValue("--output") || htmlPath.replace(/\.html?$/, ".pdf") || "guide.pdf";
  const theme      = argValue("--theme");
  const size       = argValue("--size") || "A4";
  const verbose    = args.includes("--verbose");

  try {
    const out = buildPdf(htmlPath, outputPath, { size, theme, verbose });
    console.log(`✓ PDF generado: ${out}`);
  } catch (err) {
    console.error(`vivliostyle-adapter: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { buildPdf, checkVivliostyle, previewHtml };
