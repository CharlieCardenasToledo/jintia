#!/usr/bin/env node
"use strict";

/**
 * html-content-gate.js — Validador de contenido semántico del HTML generado
 *
 * Valida que el HTML no sea solo un cascarón visualmente válido sino que
 * conserve información académica real. Bloquea si el título, curso o bloques
 * pedagógicos obligatorios están vacíos, o si la retención de contenido es
 * insuficiente.
 *
 * Reglas:
 *  JIN-HTMLQ-001 — Título principal no puede estar vacío (h1).
 *  JIN-HTMLQ-002 — Curso no puede estar vacío (.jintia-cover__course).
 *  JIN-HTMLQ-003 — Todo bloque pedagógico obligatorio debe contener texto visible.
 *  JIN-HTMLQ-004 — La guía debe superar umbral mínimo de contenido académico.
 *  JIN-HTMLQ-005 — No se permite sección compuesta únicamente por su etiqueta.
 *  JIN-HTMLQ-006 — Bibliografía no puede aparecer vacía si existe bibliography declarada.
 *  JIN-HTMLQ-007 — El HTML debe conservar los targets/contenidos principales del AST.
 *
 * Uso:
 *   node scripts/html-content-gate.js guide.html [--guide guide.json] [--json]
 * API:
 *   const { lintHtmlContent } = require("./html-content-gate");
 *   lintHtmlContent(htmlPath, { guidePath });
 */

const fs = require("node:fs");
const path = require("node:path");

let parse = null;
let parserAvailable = false;
try {
  ({ parse } = require("node-html-parser"));
  parserAvailable = true;
} catch { /* fallback regex */ }

const RULES = {
  "JIN-HTMLQ-001": { id: "JIN-HTMLQ-001", category: "content", severity: "error", description: "Título principal no puede estar vacío." },
  "JIN-HTMLQ-002": { id: "JIN-HTMLQ-002", category: "content", severity: "error", description: "Curso no puede estar vacío." },
  "JIN-HTMLQ-003": { id: "JIN-HTMLQ-003", category: "content", severity: "error", description: "Todo bloque pedagógico obligatorio debe contener texto visible." },
  "JIN-HTMLQ-004": { id: "JIN-HTMLQ-004", category: "content", severity: "error", description: "La guía debe superar un umbral mínimo de contenido académico." },
  "JIN-HTMLQ-005": { id: "JIN-HTMLQ-005", category: "content", severity: "error", description: "No se permite una sección compuesta únicamente por su etiqueta." },
  "JIN-HTMLQ-006": { id: "JIN-HTMLQ-006", category: "content", severity: "error", description: "La bibliografía no puede aparecer vacía si existe bibliografía declarada." },
  "JIN-HTMLQ-007": { id: "JIN-HTMLQ-007", category: "content", severity: "error", description: "El HTML debe conservar los targets y contenidos principales del AST." },
};

const MIN_ACADEMIC_WORDS = 180;
const MIN_WORDS_PER_BLOCK = 12;
const MIN_RETENTION_PCT = 60;

function stripTags(html) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function countWords(text) {
  if (!text || typeof text !== "string") return 0;
  const stripped = stripTags(text);
  if (!stripped) return 0;
  return stripped.split(/\s+/).filter(Boolean).length;
}

function visibleWordsInHtml(source) {
  // Exclude <head>, <style>, <script>
  let cleaned = source.replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ");
  // Remove tags
  return countWords(cleaned);
}

function collectAstWords(guide) {
  let words = 0;
  if (guide.metadata) {
    words += countWords(guide.metadata.topic || "");
    words += countWords(guide.metadata.course || "");
    words += countWords(guide.metadata.outcome || "");
  }
  for (const sec of (guide.sections || [])) {
    words += countWords(sec.title || "");
    // content can be string, array, or structured fields
    const fields = ["content", "purpose", "prompt", "workedExample", "instructions", "product"];
    for (const f of fields) {
      if (sec[f]) {
        if (Array.isArray(sec[f])) words += countWords(sec[f].join(" "));
        else if (typeof sec[f] === "string") words += countWords(sec[f]);
        else words += countWords(String(sec[f]));
      }
    }
    if (Array.isArray(sec.steps)) words += countWords(sec.steps.join(" "));
    if (Array.isArray(sec.items)) words += countWords(sec.items.join(" "));
    if (Array.isArray(sec.criteria)) words += countWords(sec.criteria.map(c => c.description || "").join(" "));
    if (Array.isArray(sec.headers)) words += countWords(sec.headers.join(" "));
    if (Array.isArray(sec.rows)) words += countWords(sec.rows.flat().join(" "));
  }
  return words;
}

function lintHtmlContent(htmlPath, options = {}) {
  const absolute = path.resolve(htmlPath);
  if (!fs.existsSync(absolute)) throw new Error(`Archivo HTML no encontrado: ${absolute}`);
  const source = fs.readFileSync(absolute, "utf8");
  const issues = [];

  function issue(ruleId, message) {
    const rule = RULES[ruleId];
    issues.push({ rule: ruleId, category: rule.category, severity: rule.severity, message, file: absolute });
  }

  let guide = null;
  let guidePath = options.guidePath ? path.resolve(options.guidePath) : null;
  if (!guidePath) {
    const guessed = absolute.replace(/\.html$/i, ".json");
    if (fs.existsSync(guessed)) guidePath = guessed;
  }
  if (guidePath && fs.existsSync(guidePath)) {
    try { guide = JSON.parse(fs.readFileSync(guidePath, "utf8")); } catch { /* ignore */ }
  }

  // ── Parse helpers ──
  let root = null;
  if (parserAvailable) {
    try { root = parse(source, { comment: false }); } catch { root = null; }
  }

  // JIN-HTMLQ-001: h1 no vacío
  let h1Text = "";
  if (root) {
    const h1 = root.querySelector("h1");
    h1Text = h1 ? (h1.text || "").trim() : "";
  } else {
    const m = source.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    h1Text = m ? stripTags(m[1]).trim() : "";
  }
  if (!h1Text) {
    issue("JIN-HTMLQ-001", "cover.title is empty — el <h1> principal está vacío (metadata.topic no se renderizó).");
  }

  // JIN-HTMLQ-002: curso no vacío
  let courseText = "";
  if (root) {
    const el = root.querySelector(".jintia-cover__course");
    courseText = el ? (el.text || "").trim() : "";
  } else {
    const m = source.match(/class="[^"]*jintia-cover__course[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i);
    courseText = m ? stripTags(m[1]).trim() : "";
  }
  if (!courseText) {
    issue("JIN-HTMLQ-002", "cover.course is empty — metadata.course no se renderizó.");
  }

  // JIN-HTMLQ-003 & 005: bloques pedagógicos con contenido visible
  const blockSelectors = [
    { sel: ".jintia-orientation", label: "orientation" },
    { sel: ".jintia-theory", label: "theory" },
    { sel: ".jintia-concept", label: "concept" },
    { sel: ".jintia-practice", label: "practice" },
    { sel: ".jintia-scenario", label: "scenario" },
    { sel: ".jintia-assessment", label: "assessment" },
  ];

  let blocksFound = 0;
  let blocksEmpty = 0;

  if (root) {
    for (const { sel, label } of blockSelectors) {
      const els = root.querySelectorAll(sel);
      for (const el of els) {
        blocksFound++;
        // Medir el bloque completo, no solo .jintia-block__content: tipos
        // estructurados como 'orientation' (route/purpose/materials) o
        // 'practice' (workedExample/steps/prompt) renderizan su contenido
        // real en sub-elementos propios, no en .jintia-block__content — que
        // puede existir vacío incluso en un bloque legítimamente completo.
        const rawText = el.text || "";
        // Remove the block label text (e.g. "Teoría", "Práctica guiada") to avoid false positives
        const visible = rawText.trim();
        const words = visible.split(/\s+/).filter(Boolean).length;
        if (words < MIN_WORDS_PER_BLOCK) {
          blocksEmpty++;
          issue("JIN-HTMLQ-003", `${label} has ${words} visible words — debe contener texto visible (mínimo ${MIN_WORDS_PER_BLOCK} palabras).`);
        }
        // 005: check if only label+title remain
        const titleEl = el.querySelector(".jintia-block__title");
        const titleWords = titleEl ? countWords(titleEl.text || "") : 0;
        const labelEl = el.querySelector(".jintia-block__label");
        const labelWords = labelEl ? countWords(labelEl.text || "") : 0;
        if (words > 0 && words <= labelWords + titleWords + 2) {
          issue("JIN-HTMLQ-005", `${label}: sección compuesta únicamente por su etiqueta (label+título sin contenido académico).`);
        }
      }
    }
  } else {
    // regex fallback: count blocks by class
    for (const { sel, label } of blockSelectors) {
      const className = sel.replace(".", "");
      const re = new RegExp(`class="[^"]*${className}[^"]*"`, "gi");
      const matches = source.match(re) || [];
      blocksFound += matches.length;
      // Can't accurately measure per-block words without parser; use global heuristic later
    }
  }

  // JIN-HTMLQ-004: umbral mínimo global
  const totalWords = visibleWordsInHtml(source);
  // Heuristic: subtract boilerplate (colophon, cover labels)
  // We already counted total; if very low, block.
  if (totalWords < MIN_ACADEMIC_WORDS) {
    issue("JIN-HTMLQ-004", `La guía tiene ${totalWords} palabras visibles — por debajo del umbral mínimo (${MIN_ACADEMIC_WORDS}). El HTML está vacío o cascarón.`);
  }

  // JIN-HTMLQ-006: bibliografía vacía cuando debería existir
  let bibDeclared = Boolean(guide && guide.metadata && guide.metadata.bibliography);
  if (root) {
    const bibSection = root.querySelector(".jintia-bibliography");
    if (bibSection) {
      const muted = bibSection.querySelector(".jintia-muted");
      const listItems = bibSection.querySelectorAll(".jintia-bibliography__item");
      if (muted && listItems.length === 0) {
        issue("JIN-HTMLQ-006", "bibliography unexpectedly empty — render muestra 'No se encontraron entradas bibliográficas' pero metadata.bibliography está declarado.");
      } else if (bibDeclared && listItems.length === 0 && !muted) {
        // fallback: bibliography section exists but empty
        const bibText = (bibSection.text || "").trim();
        if (countWords(bibText) < 5) {
          issue("JIN-HTMLQ-006", "bibliography section is empty despite bibliography being declared.");
        }
      }
    } else if (bibDeclared) {
      // Bibliography node expected but no HTML section rendered
      // Only warn if guide has bibliography node
      const hasBibNode = guide && Array.isArray(guide.sections) && guide.sections.some(s => s.type === "bibliography");
      if (hasBibNode) {
        issue("JIN-HTMLQ-006", "bibliography node declared in AST but no .jintia-bibliography section in HTML.");
      }
    }
  } else if (bibDeclared) {
    if (/No se encontraron entradas bibliogr/i.test(source)) {
      issue("JIN-HTMLQ-006", "bibliography unexpectedly empty — 'No se encontraron entradas bibliográficas' en HTML.");
    }
  }

  // JIN-HTMLQ-007: retención AST → HTML
  if (guide) {
    const astWords = collectAstWords(guide);
    if (astWords > 50) {
      // Compare only academic words: subtract a small boilerplate allowance
      const retention = totalWords / astWords;
      const retentionPct = (retention * 100).toFixed(1);
      if (retention < 0.35) {
        issue("JIN-HTMLQ-007", `Retención crítica AST→HTML: ${retentionPct}% (${totalWords}/${astWords} palabras). Pérdida masiva — verificar campos title/content vs. titulo/contenido.`);
      } else if (retention < MIN_RETENTION_PCT / 100) {
        issue("JIN-HTMLQ-007", `Retención baja AST→HTML: ${retentionPct}% (${totalWords}/${astWords} palabras) por debajo de ${MIN_RETENTION_PCT}%.`);
      }
      // Expose metric in summary
      // Keep as extra info, not as separate issue
    }
  }

  // Summary metric for callers
  const astWordsForMetric = guide ? collectAstWords(guide) : null;
  const retentionMetric = astWordsForMetric && astWordsForMetric > 0 ? (totalWords / astWordsForMetric) : null;

  return {
    tool: "jintia html-content-gate",
    version: "1.0.0",
    target: absolute,
    guidePath: guidePath || null,
    issues,
    metrics: {
      htmlVisibleWords: totalWords,
      astVisibleWords: astWordsForMetric,
      retention: retentionMetric !== null ? Math.round(retentionMetric * 1000) / 10 : null, // pct with 1 decimal
      blocksFound,
      blocksEmpty,
    },
    summary: {
      errors: issues.filter(i => i.severity === "error").length,
      warnings: issues.filter(i => i.severity === "warning").length,
      passed: issues.filter(i => i.severity === "error").length === 0,
    },
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const target = args.find(a => !a.startsWith("--") && !a.startsWith("-"));
  const asJson = args.includes("--json");
  const guideIdx = args.indexOf("--guide");
  const guidePath = guideIdx >= 0 ? args[guideIdx + 1] : null;

  if (!target) {
    console.error("Uso: node scripts/html-content-gate.js guide.html [--guide guide.json] [--json]");
    process.exit(2);
  }
  try {
    const report = lintHtmlContent(target, { guidePath });
    if (asJson) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`Jintia HTML Content Gate · ${report.target}`);
      console.log(`  HTML words: ${report.metrics.htmlVisibleWords} | AST words: ${report.metrics.astVisibleWords ?? "—"} | retención: ${report.metrics.retention ?? "—"}%`);
      if (!report.issues.length) console.log("✓ Contenido semántico válido.");
      else for (const it of report.issues) console.log(`${it.severity === "error" ? "✗" : "⚠"} ${it.rule} · ${it.message}`);
      console.log(`\nResultado: ${report.summary.errors} errores, ${report.summary.warnings} advertencias.`);
    }
    if (report.summary.errors > 0) process.exitCode = 1;
  } catch (err) {
    console.error(`html-content-gate: ${err.message}`);
    process.exitCode = 1;
  }
}

module.exports = { lintHtmlContent, RULES, MIN_ACADEMIC_WORDS, MIN_WORDS_PER_BLOCK };
