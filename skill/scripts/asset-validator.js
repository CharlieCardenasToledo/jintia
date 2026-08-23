#!/usr/bin/env node
"use strict";

/**
 * asset-validator.js — Validador de assets pedagógicos (SVG/figuras)
 *
 * Verifica que cada nodo figure con src apunte a un SVG válido y renderizable,
 * no solo que tenga alt/caption. Bloquea si el SVG es malformado, vacío o
 * contiene elementos prohibidos.
 *
 * Reglas:
 *  JIN-ASSET-001 — Archivo de figura no existe
 *  JIN-ASSET-002 — SVG no parseable (XML malformado)
 *  JIN-ASSET-003 — Raíz no es <svg> o namespace incorrecto
 *  JIN-ASSET-004 — viewBox/dimensiones inválidas o cero
 *  JIN-ASSET-005 — SVG visualmente vacío (sin elementos gráficos)
 *  JIN-ASSET-006 — Referencias externas prohibidas o href no resuelve
 *  JIN-ASSET-007 — Contiene <script> o foreignObject no permitido
 *  JIN-ASSET-008 — IDs duplicados o conflictivos (warning)
 *
 * Uso:
 *   node scripts/asset-validator.js guide.json [--json]
 * API:
 *   const { validateAssets } = require("./asset-validator");
 */

const fs = require("node:fs");
const path = require("node:path");

const RULES = {
  "JIN-ASSET-001": { id: "JIN-ASSET-001", category: "asset", severity: "error", description: "Archivo de figura no existe." },
  "JIN-ASSET-002": { id: "JIN-ASSET-002", category: "asset", severity: "error", description: "SVG no parseable (XML malformado)." },
  "JIN-ASSET-003": { id: "JIN-ASSET-003", category: "asset", severity: "error", description: "Raíz no es <svg> o namespace incorrecto." },
  "JIN-ASSET-004": { id: "JIN-ASSET-004", category: "asset", severity: "error", description: "viewBox o dimensiones inválidas." },
  "JIN-ASSET-005": { id: "JIN-ASSET-005", category: "asset", severity: "error", description: "SVG visualmente vacío." },
  "JIN-ASSET-006": { id: "JIN-ASSET-006", category: "asset", severity: "error", description: "Referencias externas prohibidas o href no resuelve." },
  "JIN-ASSET-007": { id: "JIN-ASSET-007", category: "asset", severity: "error", description: "Contiene <script> o contenido prohibido." },
  "JIN-ASSET-008": { id: "JIN-ASSET-008", category: "asset", severity: "warning", description: "IDs duplicados o conflictivos en SVG." },
};

function validateSvgFile(absolutePath) {
  const issues = [];
  function issue(ruleId, message) {
    const rule = RULES[ruleId];
    issues.push({ rule: ruleId, category: rule.category, severity: rule.severity, message, file: absolutePath });
  }

  // JIN-ASSET-001: existe
  if (!fs.existsSync(absolutePath)) {
    issue("JIN-ASSET-001", `Archivo no existe: ${absolutePath}`);
    return issues;
  }

  const raw = fs.readFileSync(absolutePath, "utf8");

  // JIN-ASSET-002: XML parseable (heurística sin parser pesado)
  // Check for unclosed tags, mismatched brackets
  const trimmed = raw.trim();
  if (!trimmed) {
    issue("JIN-ASSET-002", "Archivo vacío.");
    return issues;
  }
  // Simple XML well-formedness: count < and >, check svg closing
  // Use a lightweight parser attempt via regex for critical errors
  const openTags = (raw.match(/<[^!?][^>]*>/g) || []).length;
  const closeTags = (raw.match(/<\/[^>]+>/g) || []).length;
  // Check for truncated file (e.g. "</svg" without ">")
  if (/<\/svg\s*$/.test(trimmed) || /<svg[^>]*$/.test(trimmed) || /<path[^>]*$/.test(trimmed)) {
    issue("JIN-ASSET-002", "XML truncado — posible tag sin cerrar (</svg sin >).");
  }
  // Detect obvious malformed attribute like d="M ???" with ???
  // That's not a parse error per se, but we flag as warning via 002 if d attribute is syntactically invalid
  // For now, only flag if XML is not parseable via attempting to use a DOMParser-like check:
  // Check balanced <svg> tags
  const svgOpen = (raw.match(/<svg\b/gi) || []).length;
  const svgClose = (raw.match(/<\/svg>/gi) || []).length;
  if (svgOpen !== svgClose && svgOpen > 0) {
    issue("JIN-ASSET-002", `Desbalance <svg>: ${svgOpen} apertura(s) vs ${svgClose} cierre(s).`);
  }

  // JIN-ASSET-003: raíz <svg> y namespace
  const hasSvgRoot = /<svg\b/i.test(raw);
  if (!hasSvgRoot) {
    issue("JIN-ASSET-003", "Raíz no es <svg> — no se encontró tag <svg>.");
    return issues;
  }
  // Check namespace if present is correct when declared
  const nsMatch = raw.match(/xmlns\s*=\s*["']([^"']+)["']/i);
  if (nsMatch && nsMatch[1] !== "http://www.w3.org/2000/svg") {
    issue("JIN-ASSET-003", `Namespace SVG incorrecto: "${nsMatch[1]}" (esperado http://www.w3.org/2000/svg).`);
  }

  // Extract opening svg tag
  const svgTagMatch = raw.match(/<svg\b[^>]*>/i);
  const svgTag = svgTagMatch ? svgTagMatch[0] : "";

  // JIN-ASSET-004: viewBox o dimensiones
  const hasViewBox = /viewBox\s*=\s*["'][^"']+["']/i.test(svgTag);
  const widthMatch = svgTag.match(/width\s*=\s*["']([^"']+)["']/i);
  const heightMatch = svgTag.match(/height\s*=\s*["']([^"']+)["']/i);
  let widthVal = widthMatch ? parseFloat(widthMatch[1]) : NaN;
  let heightVal = heightMatch ? parseFloat(heightMatch[1]) : NaN;

  if (!hasViewBox && (isNaN(widthVal) || isNaN(heightVal) || widthVal <= 0 || heightVal <= 0)) {
    issue("JIN-ASSET-004", "viewBox ausente y dimensiones inválidas o cero — el SVG no tiene tamaño definido.");
  }
  if (!isNaN(widthVal) && widthVal <= 0) issue("JIN-ASSET-004", `width <= 0 (${widthMatch[1]}).`);
  if (!isNaN(heightVal) && heightVal <= 0) issue("JIN-ASSET-004", `height <= 0 (${heightMatch[1]}).`);
  if (hasViewBox) {
    const vb = svgTag.match(/viewBox\s*=\s*["']([^"']+)["']/i);
    if (vb) {
      const parts = vb[1].trim().split(/[\s,]+/).map(Number);
      if (parts.length !== 4 || parts.some(isNaN) || parts[2] <= 0 || parts[3] <= 0) {
        issue("JIN-ASSET-004", `viewBox inválido: "${vb[1]}" — debe ser "minX minY width height" con width/height > 0.`);
      }
    }
  }

  // JIN-ASSET-007: <script> y foreignObject
  if (/<script\b/i.test(raw)) {
    issue("JIN-ASSET-007", "SVG contiene <script> — prohibido por seguridad y determinismo.");
  }
  if (/<foreignObject\b/i.test(raw)) {
    // Policy: allow but warn if not explicitly needed; here treat as warning via 007 error? We'll make it error for publish consistency but catalog says error
    // Keep as error for now, but could be relaxed to warning
    issue("JIN-ASSET-007", "SVG contiene <foreignObject> — revisar política (puede fallar en Vivliostyle/resvg).");
  }

  // JIN-ASSET-005: visualmente vacío
  const graphicTags = ["path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "g", "use", "image"];
  const hasGraphic = graphicTags.some(tag => new RegExp(`<${tag}\\b`, "i").test(raw));
  // More precise: check if svg body has only whitespace between <svg> and </svg>
  const svgBody = raw.replace(/<svg\b[^>]*>/i, "").replace(/<\/svg>[\s\S]*/i, "").trim();
  const bodyWithoutComments = svgBody.replace(/<!--[\s\S]*?-->/g, "").trim();
  if (!hasGraphic || !bodyWithoutComments) {
    issue("JIN-ASSET-005", "SVG visualmente vacío — no contiene elementos gráficos (<path>, <rect>, <circle>, etc.).");
  } else {
    // Check for empty path d="M ???" or d="" 
    const pathDMatches = [...raw.matchAll(/<path\b[^>]*\bd\s*=\s*["']([^"']*)["']/gi)];
    for (const m of pathDMatches) {
      const d = m[1].trim();
      if (!d || /\?\?\?/.test(d) || d.length < 2) {
        issue("JIN-ASSET-002", `path d inválido: "${d}" — comando SVG malformado.`);
      }
    }
  }

  // JIN-ASSET-006: referencias externas prohibidas
  if (/xlink:href\s*=\s*["']https?:\/\//i.test(raw) || /href\s*=\s*["']https?:\/\//i.test(raw)) {
    issue("JIN-ASSET-006", "SVG contiene referencias externas http(s) — prohibidas (determinismo offline).");
  }
  // href internos #id should resolve within file (check if referenced id exists)
  const hrefIds = [...raw.matchAll(/href\s*=\s*["']#([^"']+)["']/gi)].map(m => m[1]);
  const definedIds = [...raw.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]);
  for (const hid of hrefIds) {
    if (!definedIds.includes(hid)) {
      issue("JIN-ASSET-006", `href interno "#${hid}" no resuelve a ningún id definido en el SVG.`);
    }
  }

  // JIN-ASSET-008: IDs duplicados
  const idCounts = new Map();
  for (const id of definedIds) idCounts.set(id, (idCounts.get(id) || 0) + 1);
  for (const [id, count] of idCounts) {
    if (count > 1) issue("JIN-ASSET-008", `ID duplicado en SVG: "${id}" (${count} veces).`);
  }

  return issues;
}

function validateAssets(guidePath) {
  const absolute = path.resolve(guidePath);
  if (!fs.existsSync(absolute)) throw new Error(`guide.json no encontrado: ${absolute}`);
  let guide;
  try { guide = JSON.parse(fs.readFileSync(absolute, "utf8")); } catch (e) { throw new Error(`JSON inválido: ${e.message}`); }

  const issues = [];
  const baseDir = path.dirname(absolute);
  const sections = guide.sections || [];
  let figuresChecked = 0;

  for (let i = 0; i < sections.length; i++) {
    const node = sections[i];
    if (node.type !== "figure") continue;
    figuresChecked++;

    // src XOR visualSpec already validated by JIN-CNT-013, but we check asset existence here
    if (node.visualSpec) {
      // visualSpec is a spec file; we don't validate it as SVG here (visual-pipeline does)
      continue;
    }
    if (!node.src) {
      // Already error in content-linter; skip
      continue;
    }
    const assetPath = path.resolve(baseDir, node.src);
    // Solo SVG pasa por validación profunda; otros formatos solo verifican existencia
    if (assetPath.toLowerCase().endsWith(".svg")) {
      const svgIssues = validateSvgFile(assetPath);
      for (const iss of svgIssues) {
        issues.push({ ...iss, nodeIndex: i, nodeId: node.id || null });
      }
    } else {
      if (!fs.existsSync(assetPath)) {
        issues.push({ rule: "JIN-ASSET-001", category: "asset", severity: "error", message: `Archivo no existe: ${assetPath}`, file: assetPath, nodeIndex: i, nodeId: node.id || null });
      }
    }
  }

  return {
    tool: "jintia asset-validator",
    version: "1.0.0",
    target: absolute,
    issues,
    metrics: { figuresChecked, errors: issues.filter(x => x.severity === "error").length, warnings: issues.filter(x => x.severity === "warning").length },
    summary: {
      errors: issues.filter(x => x.severity === "error").length,
      warnings: issues.filter(x => x.severity === "warning").length,
      passed: issues.filter(x => x.severity === "error").length === 0,
    },
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const target = args.find(a => !a.startsWith("--"));
  const asJson = args.includes("--json");
  if (!target) {
    console.error("Uso: node scripts/asset-validator.js guide.json [--json]");
    process.exit(2);
  }
  try {
    const report = validateAssets(target);
    if (asJson) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`Jintia Asset Validator · ${report.target}`);
      console.log(`  Figuras verificadas: ${report.metrics.figuresChecked}`);
      if (!report.issues.length) console.log("✓ Assets válidos.");
      else for (const it of report.issues) console.log(`${it.severity === "error" ? "✗" : "⚠"} ${it.rule} · ${it.message}${it.nodeId ? ` (node: ${it.nodeId})` : ""}`);
      console.log(`\nResultado: ${report.summary.errors} errores, ${report.summary.warnings} advertencias.`);
    }
    if (report.summary.errors > 0) process.exitCode = 1;
  } catch (err) {
    console.error(`asset-validator: ${err.message}`);
    process.exitCode = 1;
  }
}

module.exports = { validateAssets, validateSvgFile, RULES };
