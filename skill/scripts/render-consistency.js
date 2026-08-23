#!/usr/bin/env node
"use strict";

/**
 * render-consistency.js — Gate de consistencia AST → HTML
 *
 * Compara el AST (guide.json) con el DOM generado para detectar pérdidas
 * masivas de contenido que indican incompatibilidad de esquema (e.g. titulo
 * vs title). Complementa html-content-gate con métricas estructurales.
 *
 * Reglas:
 *  JIN-RENDER-001 — metadata.topic debe aparecer en <h1>
 *  JIN-RENDER-002 — metadata.course debe aparecer en .jintia-cover__course
 *  JIN-RENDER-003 — N secciones AST ≈ N secciones HTML (tolerancia ±1)
 *  JIN-RENDER-004 — N figuras AST = N figuras HTML
 *  JIN-RENDER-005 — N tablas AST = N tablas HTML
 *  JIN-RENDER-006 — Retención global < umbral (duplicado de HTML-CONTENT-007 pero aquí como gate de render)
 *
 * Uso:
 *   node scripts/render-consistency.js guide.json guide.html [--json]
 */

const fs = require("node:fs");
const path = require("node:path");

let parse = null;
let parserAvailable = false;
try { ({ parse } = require("node-html-parser")); parserAvailable = true; } catch {}

const RULES = {
  "JIN-RENDER-001": { id: "JIN-RENDER-001", category: "render", severity: "error", description: "metadata.topic debe renderizarse en <h1>." },
  "JIN-RENDER-002": { id: "JIN-RENDER-002", category: "render", severity: "error", description: "metadata.course debe renderizarse en portada." },
  "JIN-RENDER-003": { id: "JIN-RENDER-003", category: "render", severity: "error", description: "N secciones AST no coincide con secciones HTML." },
  "JIN-RENDER-004": { id: "JIN-RENDER-004", category: "render", severity: "error", description: "N figuras AST no coincide con figuras HTML." },
  "JIN-RENDER-005": { id: "JIN-RENDER-005", category: "render", severity: "error", description: "N tablas AST no coincide con tablas HTML." },
  "JIN-RENDER-006": { id: "JIN-RENDER-006", category: "render", severity: "error", description: "Pérdida masiva de contenido AST→HTML (retención < umbral)." },
};

function stripTags(s) { return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); }
function countWords(s) { if (!s) return 0; const t = stripTags(s); return t ? t.split(/\s+/).filter(Boolean).length : 0; }

function checkConsistency(guidePath, htmlPath) {
  const gAbs = path.resolve(guidePath);
  const hAbs = path.resolve(htmlPath);
  if (!fs.existsSync(gAbs)) throw new Error(`guide.json no encontrado: ${gAbs}`);
  if (!fs.existsSync(hAbs)) throw new Error(`guide.html no encontrado: ${hAbs}`);

  const guide = JSON.parse(fs.readFileSync(gAbs, "utf8"));
  const html = fs.readFileSync(hAbs, "utf8");
  const issues = [];
  function issue(ruleId, message) {
    const r = RULES[ruleId];
    issues.push({ rule: ruleId, category: r.category, severity: r.severity, message, file: hAbs });
  }

  let root = null;
  if (parserAvailable) { try { root = parse(html, { comment: false }); } catch {} }

  // JIN-RENDER-001: topic → h1
  const topic = (guide.metadata && guide.metadata.topic) ? String(guide.metadata.topic).trim() : "";
  if (topic) {
    let h1Text = "";
    if (root) { const h1 = root.querySelector("h1"); h1Text = h1 ? (h1.text || "").trim() : ""; }
    else { const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i); h1Text = m ? stripTags(m[1]).trim() : ""; }
    if (!h1Text) issue("JIN-RENDER-001", `metadata.topic="${topic.slice(0,60)}" no aparece en <h1> (h1 vacío). Posible incompatibilidad de campo (titulo vs topic).`);
    else if (!h1Text.includes(topic.slice(0, 20)) && topic.length > 5) {
      // loose check: at least first 20 chars should appear
      issue("JIN-RENDER-001", `metadata.topic no coincide con <h1>. AST: "${topic.slice(0,60)}" vs HTML h1: "${h1Text.slice(0,60)}".`);
    }
  }

  // JIN-RENDER-002: course → cover
  const course = (guide.metadata && guide.metadata.course) ? String(guide.metadata.course).trim() : "";
  if (course) {
    let courseText = "";
    if (root) { const el = root.querySelector(".jintia-cover__course"); courseText = el ? (el.text || "").trim() : ""; }
    else { const m = html.match(/jintia-cover__course[^>]*>([\s\S]*?)</i); courseText = m ? stripTags(m[1]).trim() : ""; }
    if (!courseText) issue("JIN-RENDER-002", `metadata.course="${course}" no aparece en portada (.jintia-cover__course vacío). Posible campo asignatura vs course.`);
  }

  // JIN-RENDER-003: sections count
  const astSections = (guide.sections || []).length;
  let htmlSections = 0;
  if (root) {
    // Count blocks + figures + tables + bibliography inside <main>
    const main = root.querySelector("main");
    const scope = main || root;
    htmlSections = scope.querySelectorAll(".jintia-block, .jintia-figure, .jintia-table, .jintia-bibliography").length;
    // If parser not counting correctly, fallback to regex
    if (htmlSections === 0) htmlSections = (html.match(/class="[^"]*jintia-(?:block|figure|table|bibliography)/gi) || []).length;
  } else {
    htmlSections = (html.match(/class="[^"]*jintia-(?:block|figure|table|bibliography)/gi) || []).length;
  }
  // Allow bibliografía + colophon not counted; but if diff > 2, block
  if (Math.abs(astSections - htmlSections) > 2) {
    issue("JIN-RENDER-003", `N secciones AST (${astSections}) ≠ N secciones HTML (${htmlSections}). Pérdida estructural — verificar tipos de nodo.`);
  }

  // JIN-RENDER-004: figures
  const astFigures = (guide.sections || []).filter(s => s.type === "figure").length;
  let htmlFigures = 0;
  if (root) htmlFigures = root.querySelectorAll("figure.jintia-figure, .jintia-figure").length;
  else htmlFigures = (html.match(/<figure[^>]*class="[^"]*jintia-figure/gi) || []).length;
  if (astFigures !== htmlFigures) {
    issue("JIN-RENDER-004", `N figuras AST (${astFigures}) ≠ N figuras HTML (${htmlFigures}).`);
  }

  // JIN-RENDER-005: tables
  const astTables = (guide.sections || []).filter(s => s.type === "table").length;
  let htmlTables = 0;
  if (root) htmlTables = root.querySelectorAll(".jintia-table table").length;
  else htmlTables = (html.match(/<table/gi) || []).length;
  // Only compare if either has tables
  if (astTables > 0 || htmlTables > 0) {
    if (astTables !== htmlTables) issue("JIN-RENDER-005", `N tablas AST (${astTables}) ≠ N tablas HTML (${htmlTables}).`);
  }

  // JIN-RENDER-006: retención (re-use logic from html-content-gate)
  function collectAstWords(g) {
    let w = 0;
    w += countWords(g.metadata.topic || "");
    w += countWords(g.metadata.outcome || "");
    for (const s of (g.sections || [])) {
      w += countWords(s.title || "");
      if (typeof s.content === "string") w += countWords(s.content);
      else if (Array.isArray(s.content)) w += countWords(s.content.join(" "));
      if (Array.isArray(s.steps)) w += countWords(s.steps.join(" "));
      if (Array.isArray(s.items)) w += countWords(s.items.join(" "));
    }
    return w;
  }
  const astWords = collectAstWords(guide);
  const htmlWords = countWords(html.replace(/<head[\s\S]*?<\/head>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " "));
  let retention = astWords > 0 ? htmlWords / astWords : null;
  if (astWords > 50 && retention !== null && retention < 0.5) {
    issue("JIN-RENDER-006", `Retención AST→HTML ${(retention*100).toFixed(1)}% (${htmlWords}/${astWords} palabras) — pérdida masiva, posible renderer consumiendo campos inexistentes.`);
  }

  return {
    tool: "jintia render-consistency",
    version: "1.0.0",
    target: hAbs,
    guidePath: gAbs,
    issues,
    metrics: { astSections, htmlSections, astFigures, htmlFigures, astTables, htmlTables, astWords, htmlWords, retention: retention !== null ? Math.round(retention*1000)/10 : null },
    summary: { errors: issues.filter(i=>i.severity==="error").length, warnings: issues.filter(i=>i.severity==="warning").length, passed: issues.filter(i=>i.severity==="error").length===0 },
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const guideArg = args.find(a => a.endsWith(".json"));
  const htmlArg = args.find(a => a.endsWith(".html"));
  const asJson = args.includes("--json");
  if (!guideArg || !htmlArg) {
    console.error("Uso: node scripts/render-consistency.js guide.json guide.html [--json]");
    process.exit(2);
  }
  try {
    const report = checkConsistency(guideArg, htmlArg);
    if (asJson) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`Jintia Render Consistency · ${report.guidePath} → ${report.target}`);
      console.log(`  Secciones: AST ${report.metrics.astSections} vs HTML ${report.metrics.htmlSections} | Figs: ${report.metrics.astFigures} vs ${report.metrics.htmlFigures} | Retención: ${report.metrics.retention ?? "—"}%`);
      if (!report.issues.length) console.log("✓ Consistencia OK.");
      else for (const it of report.issues) console.log(`${it.severity==="error"?"✗":"⚠"} ${it.rule} · ${it.message}`);
      console.log(`\nResultado: ${report.summary.errors} errores, ${report.summary.warnings} advertencias.`);
    }
    if (report.summary.errors > 0) process.exitCode = 1;
  } catch (err) {
    console.error(`render-consistency: ${err.message}`);
    process.exitCode = 1;
  }
}

module.exports = { checkConsistency, RULES };
