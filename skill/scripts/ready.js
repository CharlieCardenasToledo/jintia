#!/usr/bin/env node
"use strict";

/**
 * ready.js — jintia ready: el orquestador completo de publicación
 *
 * Corre, en orden, todo lo determinista que separa "el AST parece
 * publicable" de "el material está listo para entregarse":
 *
 *   validate --publish → evidencia (provenance) → bibliografía (pre-render)
 *   → render → html-lint → bibliografía (post-render) → preflight
 *   → compile (PDF)
 *
 * No invoca a `jintia-selfstudy-reviewer` ni a `jintia-finish-reviewer`:
 * son contratos de agente en lenguaje natural (juicio pedagógico/editorial),
 * no scripts deterministas que este orquestador pueda ejecutar por sí
 * mismo. `FINAL DECISION: READY` aquí es una condición necesaria pero no
 * suficiente — la nota final siempre recuerda confirmar esos dos PASS por
 * separado antes de compartir el material.
 *
 * Uso:
 *   node scripts/ready.js guide.json [--json] [--skip-pdf]
 */

const fs   = require("node:fs");
const path = require("node:path");

const { lintGuide } = require("./content-linter");
const { assertPublishReady, assertRenderedPublishReady } = require("./bibliography-manager");
const { renderGuide } = require("./guide-renderer");
const { lintHtml } = require("./html-linter");
const { lintHtmlContent } = require("./html-content-gate");
const { validateAssets } = require("./asset-validator");
const { checkConsistency } = require("./render-consistency");
const { runPreflight } = require("./pdf-preflight");
const { buildPdf, checkVivliostyle } = require("./vivliostyle-adapter");
const { emitProgress, initProgressJournal, endProgressJournal } = require("./progress-events");
const { createRevisionSnapshot, checkApproval } = require("./revision-manager");

/** `absolute` normalmente sigue la convención `courseRoot/semanas/semana-NN/
 * guide.json` (misma que ya asume `content-linter.js` para el cruce con el
 * sílabo) — de ahí se deriva la raíz del curso para el journal de progreso.
 * Si no sigue esa convención (ej. un fixture de test con guide.json suelto),
 * usar el propio directorio del guide.json evita que el journal termine
 * escribiendo fuera del árbol que el llamador controla. */
function courseRootFromGuidePath(absoluteGuidePath) {
  const weekDir    = path.dirname(absoluteGuidePath);
  const semanasDir = path.dirname(weekDir);
  if (path.basename(semanasDir) === "semanas") return path.dirname(semanasDir);
  return weekDir;
}

/**
 * @param {string} guidePath
 * @param {{ skipPdf?: boolean }} [options]
 * @returns {Promise<object>} Reporte estructurado (ver printReport).
 */
async function runReady(guidePath, options = {}) {
  const absolute = path.resolve(guidePath);
  initProgressJournal(courseRootFromGuidePath(absolute));
  try {
    return await runReadySteps(absolute, options);
  } finally {
    endProgressJournal();
  }
}

async function runReadySteps(absolute, options) {
  const steps  = [];
  const issues = [];
  let blocked  = false;

  function record(step, status, detail) {
    steps.push({ step, status, detail });
    if (status === "error") blocked = true;
    emitProgress({ command: "ready", step, status, detail });
  }

  emitProgress({ command: "ready", step: "validate --publish", status: "running" });

  let revision = null; // {hash, path} — solo se llena si se llega a congelar un snapshot (ver paso 8)

  function finalize(provenance) {
    const hasWarning  = issues.some(i => i.severity === "warning");
    const compileStep = steps.find(s => s.step === "compile (PDF)");
    const pdfSkipped  = Boolean(compileStep) && compileStep.status === "skipped";
    let deterministicDecision;
    if (blocked) deterministicDecision = "BLOCKED";
    else if (hasWarning) deterministicDecision = "NEEDS_CHANGES";
    else if (pdfSkipped) deterministicDecision = "PRECHECK_READY";
    else deterministicDecision = "READY";
    return {
      tool: "jintia ready",
      target: absolute,
      steps,
      issues,
      provenance: provenance || null,
      deterministicDecision,
      revision,
      notes: [
        "jintia ready cubre lo determinista: validate --publish, procedencia de evidencia, bibliografía (pre y post render), render, html-lint, preflight y compile (PDF).",
        "No invoca a jintia-selfstudy-reviewer ni a jintia-finish-reviewer (contratos de agente, no deterministas). FINAL DECISION: READY exige también su confirmación por separado antes de compartir el material.",
        ...(pdfSkipped ? ["PRECHECK_READY: todos los pasos deterministas previos al PDF están en orden, pero el PDF no se generó (--skip-pdf). No es un cierre completo — falta compilar el PDF antes de considerar la guía lista para entrega. Usa el hash de 'revision' para solicitar aprobación humana antes de compilar."] : []),
      ],
    };
  }

  // 1. validate --publish
  let lint;
  try {
    lint = lintGuide(absolute, { mode: "publish" });
    issues.push(...lint.issues);
    record("validate --publish", lint.summary.errors === 0 ? "ok" : "error", `${lint.summary.errors} error(es), ${lint.summary.warnings} advertencia(s)`);
  } catch (err) {
    record("validate --publish", "error", err.message);
    return finalize(null);
  }

  const guide = JSON.parse(fs.readFileSync(absolute, "utf8"));
  const provenance = lint.provenanceSummary;

  // 2. procedencia de evidencia (ya calculada por lintGuide; solo se reporta aquí)
  if (Array.isArray(guide.metadata?.targets) && guide.metadata.targets.length > 0) {
    const ok = Boolean(provenance) && provenance.academicProvenance !== "BLOCKED";
    record("evidence provenance", ok ? "ok" : "error", provenance ? provenance.academicProvenance : "no calculable");
  }

  // 3. bibliografía (pre-render): Citation.js, .bib, claves, estilo APA
  const bibGate = assertPublishReady(guide, absolute);
  for (const err of bibGate.errors) issues.push({ rule: err.code, category: "bibliography", severity: "error", message: err.message, file: absolute });
  record("bibliography (pre-render)", bibGate.ready ? "ok" : "error", bibGate.ready ? "OK" : bibGate.errors.map(e => e.code).join(", "));

  // Si ya hay bloqueos estructurales/pedagógicos/bibliográficos, no renderizar.
  if (blocked) return finalize(provenance);

  // 3b. asset/SVG gate — bloqueante antes de render
  try {
    const assetReport = validateAssets(absolute);
    issues.push(...assetReport.issues);
    record("assets (SVG)", assetReport.summary.errors === 0 ? "ok" : "error", `${assetReport.summary.errors} error(es), ${assetReport.summary.warnings} advertencia(s) (${assetReport.metrics.figuresChecked} figura(s))`);
  } catch (err) {
    record("assets (SVG)", "error", err.message);
  }
  if (blocked) return finalize(provenance);

  // 4. render
  const htmlPath = absolute.replace(/\.json$/i, ".html");
  let html;
  try {
    html = renderGuide(absolute, { outputPath: htmlPath });
    fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
    fs.writeFileSync(htmlPath, html, "utf8");
    record("render", "ok", htmlPath);
  } catch (err) {
    record("render", "error", err.message);
    return finalize(provenance);
  }

  // 5. html-lint
  try {
    const htmlReport = lintHtml(htmlPath);
    issues.push(...htmlReport.issues.map(i => ({ ...i, file: i.file || htmlPath })));
    record("html lint", htmlReport.summary.errors === 0 ? "ok" : "error", `${htmlReport.summary.errors} error(es), ${htmlReport.summary.warnings} advertencia(s)`);
  } catch (err) {
    record("html lint", "error", err.message);
  }
  if (blocked) return finalize(provenance);

  // 5b. render-consistency — AST vs HTML
  try {
    const consistency = checkConsistency(absolute, htmlPath);
    issues.push(...consistency.issues);
    record("render consistency", consistency.summary.errors === 0 ? "ok" : "error", consistency.summary.errors === 0 ? `retención ${consistency.metrics.retention ?? "—"}%` : consistency.issues.map(i => i.rule).join(", "));
  } catch (err) {
    record("render consistency", "error", err.message);
  }
  if (blocked) return finalize(provenance);

  // 5c. html-content gate — contenido semántico real
  try {
    const contentGate = lintHtmlContent(htmlPath, { guidePath: absolute });
    issues.push(...contentGate.issues);
    record("html content", contentGate.summary.errors === 0 ? "ok" : "error", contentGate.summary.errors === 0 ? `${contentGate.metrics.htmlVisibleWords} palabras, retención ${contentGate.metrics.retention ?? "—"}%` : contentGate.issues.map(i => i.rule).join(", "));
  } catch (err) {
    record("html content", "error", err.message);
  }
  if (blocked) return finalize(provenance);

  // 6. bibliografía (post-render): defensa en profundidad sobre el HTML ya renderizado
  const renderedGate = assertRenderedPublishReady(html);
  for (const err of renderedGate.errors) issues.push({ rule: err.code, category: "bibliography", severity: "error", message: err.message, file: htmlPath });
  record("bibliography (post-render)", renderedGate.ready ? "ok" : "error", renderedGate.ready ? "OK" : renderedGate.errors.map(e => e.code).join(", "));
  if (blocked) return finalize(provenance);

  // 7. preflight (paginación del PDF)
  try {
    const preflightReport = await runPreflight(htmlPath);
    record("preflight", preflightReport.summary.errors === 0 ? "ok" : "error", `${preflightReport.summary.errors} error(es) (${preflightReport.engine})`);
  } catch (err) {
    record("preflight", "error", err.message);
  }
  if (blocked) return finalize(provenance);

  // 8. compile (PDF) — --skip-pdf omite el cierre completo a propósito (útil
  // en entornos sin Vivliostyle CLI): el resultado queda como PRECHECK_READY,
  // no READY (ver finalize()). Sin --skip-pdf, Vivliostyle ausente SÍ bloquea:
  // el usuario pidió explícitamente el cierre completo y no puede alcanzarlo.
  //
  // Congelar el snapshot (con --skip-pdf) y compilar (sin --skip-pdf) son
  // momentos distintos a propósito: no se puede aprobar en la misma llamada
  // que genera el contenido — la aprobación humana ocurre DESPUÉS, fuera de
  // esta invocación (ver revision-manager.js). Por eso, sin --skip-pdf,
  // NUNCA se crea un snapshot nuevo aquí ni se compila el HTML recién
  // renderizado por esta corrida: se exige que ya exista una aprobación
  // vigente (checkApproval) atada a un snapshot previo, y se compila
  // exactamente ese HTML congelado — así el PDF corresponde siempre a lo
  // que un humano realmente vio y aprobó, nunca a una re-renderización.
  if (options.skipPdf) {
    revision = createRevisionSnapshot(absolute, htmlPath);
    record("compile (PDF)", "skipped", "--skip-pdf");
  } else {
    const approval = checkApproval(absolute);
    if (!approval.allowed) {
      record("compile (PDF)", "error", `${approval.code}: ${approval.message}`);
    } else {
      revision = { hash: approval.hash, path: approval.revisionPath };
      const vivliostyle = checkVivliostyle();
      if (!vivliostyle.ok) {
        record("compile (PDF)", "error", "Vivliostyle CLI no instalado (npm install --global @vivliostyle/cli) — usa --skip-pdf para un precheck sin PDF.");
      } else {
        try {
          const approvedHtmlPath = path.join(approval.revisionPath, "guide.html");
          const pdfPath = htmlPath.replace(/\.html$/i, ".pdf");
          buildPdf(approvedHtmlPath, pdfPath);
          record("compile (PDF)", "ok", pdfPath);
        } catch (err) {
          record("compile (PDF)", "error", err.message);
        }
      }
    }
  }

  return finalize(provenance);
}

function printReport(report, asJson) {
  if (asJson) { console.log(JSON.stringify(report, null, 2)); return; }

  console.log("JINTIA READY");
  console.log(`Objetivo: ${report.target}`);
  console.log("");
  for (const s of report.steps) {
    const icon = s.status === "ok" ? "✓" : s.status === "skipped" ? "○" : "✗";
    console.log(`${icon} ${s.step} — ${s.detail}`);
  }
  console.log("");
  console.log(`DETERMINISTIC DECISION: ${report.deterministicDecision}`);

  if (report.issues.length > 0) {
    console.log("");
    console.log("Incidencias:");
    for (const issue of report.issues) {
      console.log(`  ${issue.severity === "error" ? "✗" : "⚠"} ${issue.rule} · ${issue.message}`);
    }
  }

  console.log("");
  for (const note of report.notes) console.log(`ℹ ${note}`);
}

if (require.main === module) {
  const args    = process.argv.slice(2);
  const target  = args.find(a => !a.startsWith("--"));
  const asJson  = args.includes("--json");
  const skipPdf = args.includes("--skip-pdf");

  if (!target) {
    console.error("Uso: node scripts/ready.js guide.json [--json] [--skip-pdf]");
    process.exit(2);
  }

  runReady(target, { skipPdf })
    .then(report => {
      printReport(report, asJson);
      if (report.deterministicDecision === "BLOCKED") process.exitCode = 1;
    })
    .catch(err => {
      console.error(`ready: ${err.message}`);
      process.exitCode = 1;
    });
}

module.exports = { runReady, printReport };
