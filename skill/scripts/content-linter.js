#!/usr/bin/env node
"use strict";

/**
 * content-linter.js — Validador pedagógico de guide.json
 *
 * Verifica que guide.json cumpla las reglas editoriales y pedagógicas
 * de Jintia: estructura mínima, tipos de nodo, accesibilidad, alineación
 * resultado-práctica-evidencia, e integridad bibliográfica.
 *
 * Reemplaza las reglas JIN-LTX-* y JIN-TMP-* del linter LaTeX.
 * Las reglas JIN-SYL-* siguen viviendo en rules-runner.js.
 *
 * Uso:
 *   node scripts/content-linter.js guide.json [--strict] [--json]
 */

const fs   = require("node:fs");
const path = require("node:path");
const { validate: validateSchema } = require("./schema-validator");
const { collectCitationKeys } = require("./citation-keys");

const ROOT        = path.resolve(__dirname, "..");
const SCHEMA_PATH = path.join(ROOT, "schemas", "guide.schema.json");

// ─── Catálogo de reglas HTML/JSON ────────────────────────────────────────────

const RULES = {
  "JIN-SCH-001": {
    id: "JIN-SCH-001", category: "schema", severity: "error",
    description: "guide.json no cumple el esquema canónico (guide.schema.json).",
  },
  "JIN-CNT-001": {
    id: "JIN-CNT-001", category: "structure", severity: "error",
    description: "guide.json debe contener al menos un nodo 'orientation'.",
  },
  "JIN-CNT-002": {
    id: "JIN-CNT-002", category: "accessibility", severity: "error",
    description: "Todo nodo 'figure' debe declarar 'alt' y 'caption' no vacíos.",
  },
  "JIN-CNT-003": {
    id: "JIN-CNT-003", category: "pedagogy", severity: "warning",
    description: "Todo nodo 'assessment' debería seguir a un nodo 'practice' o 'scenario'.",
  },
  "JIN-CNT-004": {
    id: "JIN-CNT-004", category: "bibliography", severity: "warning",
    description: "Toda clave citada en nodos 'citation' debe existir en reference.bib.",
  },
  "JIN-CNT-005": {
    id: "JIN-CNT-005", category: "alignment", severity: "error",
    description: "guide.json debe incluir el campo 'outcome' en metadata.",
  },
  "JIN-CNT-006": {
    id: "JIN-CNT-006", category: "structure", severity: "error",
    description: "No se permiten tipos de nodo desconocidos.",
  },
  "JIN-CNT-007": {
    id: "JIN-CNT-007", category: "accessibility", severity: "warning",
    description: "Todo nodo 'table' debe declarar 'caption' y 'headers'.",
  },
  "JIN-CNT-008": {
    id: "JIN-CNT-008", category: "structure", severity: "warning",
    description: "Los IDs de nodo deben ser únicos en el documento.",
  },
  "JIN-CNT-009": {
    id: "JIN-CNT-009", category: "bibliography", severity: "warning",
    description: "Si hay nodos 'citation', la metadata debe declarar 'bibliography'.",
  },
  "JIN-CNT-010": {
    id: "JIN-CNT-010", category: "pagination", severity: "warning",
    description: "Los valores de 'pagination' deben ser tipos válidos.",
  },
  "JIN-CNT-011": {
    id: "JIN-CNT-011", category: "structure", severity: "warning",
    description: "El nodo 'bibliography' debe ser el último nodo de sections.",
  },
  "JIN-CNT-012": {
    id: "JIN-CNT-012", category: "bibliography", severity: "warning",
    description: "El nodo 'citation' está deprecado. Usar sintaxis inline {{cite:clave}} en campos content.",
  },
  "JIN-CNT-013": {
    id: "JIN-CNT-013", category: "accessibility", severity: "error",
    description: "Todo nodo 'figure' debe declarar 'src' o 'visualSpec' (no ambos, no ninguno).",
  },
  "JIN-BIB-001": {
    id: "JIN-BIB-001", category: "bibliography", severity: "error",
    description: "metadata.citationStyle debe ser 'apa'; Jintia no admite otro estilo bibliográfico en esta versión.",
  },
};

const VALID_TYPES = new Set([
  "orientation", "theory", "concept", "warning", "critical-error",
  "practice", "figure", "table", "scenario", "assessment",
  "margin-note", "bibliography", "citation",
]);

const VALID_PAGINATION = new Set([
  "atomic", "splittable", "repeatable-header", "keep-with-next", "page-contained",
]);

// ─── Utilidad: extrae claves bib de un .bib mediante regex ───────────────────

function extractBibKeys(bibPath) {
  const absolute = path.resolve(bibPath);
  if (!fs.existsSync(absolute)) return null;
  const raw  = fs.readFileSync(absolute, "utf8");
  const keys = new Set();
  const re   = /@\w+\s*\{\s*([^,\s]+)/g;
  let match;
  while ((match = re.exec(raw)) !== null) keys.add(match[1]);
  return keys;
}

// ─── Runner principal ─────────────────────────────────────────────────────────

function lintGuide(guidePath) {
  const absolute = path.resolve(guidePath);
  const issues   = [];

  function issue(ruleId, message, extra = {}) {
    const rule = RULES[ruleId];
    issues.push({ rule: ruleId, category: rule.category, severity: rule.severity, message, file: absolute, ...extra });
  }

  // ── Cargar guide.json ──
  if (!fs.existsSync(absolute)) {
    throw new Error(`No existe el archivo: ${absolute}`);
  }

  let guide;
  try {
    guide = JSON.parse(fs.readFileSync(absolute, "utf8"));
  } catch (err) {
    throw new Error(`Error de sintaxis JSON: ${err.message}`);
  }

  // ── Validación estructural contra guide.schema.json ──
  if (!fs.existsSync(SCHEMA_PATH)) {
    throw new Error(`guide.schema.json no encontrado en: ${SCHEMA_PATH} — la distribución está incompleta.`);
  }
  let schema;
  try {
    schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  } catch (err) {
    throw new Error(`Error al parsear guide.schema.json: ${err.message}`);
  }
  const schemaErrors = validateSchema(guide, schema, "$", schema);
  for (const msg of schemaErrors) {
    issues.push({
      rule: "JIN-SCH-001", category: "schema", severity: "error",
      message: msg, file: absolute,
    });
  }

  const metadata = guide.metadata || {};
  const sections = guide.sections || [];

  // ── JIN-CNT-005: outcome obligatorio ──
  if (!metadata.outcome || metadata.outcome.trim() === "") {
    issue("JIN-CNT-005", "El campo 'outcome' en metadata está ausente o vacío.");
  }

  // ── JIN-BIB-001: citationStyle debe ser 'apa' ──
  if (metadata.citationStyle && metadata.citationStyle !== "apa") {
    issue("JIN-BIB-001", `citationStyle "${metadata.citationStyle}" no está permitido; Jintia exige "apa" en esta versión.`);
  }

  // ── JIN-CNT-001: al menos un nodo orientation ──
  const hasOrientation = sections.some(s => s.type === "orientation");
  if (!hasOrientation) {
    issue("JIN-CNT-001", "No se encontró ningún nodo de tipo 'orientation'.");
  }

  // ── JIN-CNT-009: citas (nodos o inline) sin bibliography declarado ──
  const allCitedKeys = collectCitationKeys(guide);
  if (allCitedKeys.length > 0 && !metadata.bibliography) {
    issue("JIN-CNT-009", `Se encontraron ${allCitedKeys.length} cita(s) (nodos 'citation' o sintaxis {{cite:}}) pero metadata.bibliography no está declarado.`);
  }

  // ── Cargar claves bib si está disponible ──
  let bibKeys = null;
  if (metadata.bibliography) {
    const bibPath = path.resolve(path.dirname(absolute), metadata.bibliography);
    bibKeys = extractBibKeys(bibPath);
    if (bibKeys === null) {
      issues.push({
        rule: "JIN-CNT-004", category: "bibliography", severity: "warning",
        message: `El archivo bibliography declarado no existe: ${bibPath}`,
        file: absolute,
      });
    }
  }

  // ── Iterar secciones ──
  const ids   = new Set();
  let prevType = null;

  for (let i = 0; i < sections.length; i++) {
    const node   = sections[i];
    const prefix = `Nodo ${i + 1}`;

    // JIN-CNT-006: tipo válido
    if (!VALID_TYPES.has(node.type)) {
      issue("JIN-CNT-006", `${prefix}: tipo desconocido "${node.type}".`, { nodeIndex: i });
    }

    // JIN-CNT-010: pagination válido
    if (node.pagination && !VALID_PAGINATION.has(node.pagination)) {
      issue("JIN-CNT-010", `${prefix}: valor de pagination desconocido "${node.pagination}".`, { nodeIndex: i });
    }

    // JIN-CNT-008: IDs únicos
    if (node.id) {
      if (ids.has(node.id)) {
        issue("JIN-CNT-008", `${prefix}: ID duplicado "${node.id}".`, { nodeIndex: i });
      } else {
        ids.add(node.id);
      }
    }

    // JIN-CNT-002: figure requiere alt y caption
    if (node.type === "figure") {
      if (!node.alt || node.alt.trim() === "") {
        issue("JIN-CNT-002", `${prefix} (figure): falta el campo 'alt'.`, { nodeIndex: i });
      }
      if (!node.caption || node.caption.trim() === "") {
        issue("JIN-CNT-002", `${prefix} (figure): falta el campo 'caption'.`, { nodeIndex: i });
      }
    }

    // JIN-CNT-007: table requiere caption y headers
    if (node.type === "table") {
      if (!node.caption || node.caption.trim() === "") {
        issue("JIN-CNT-007", `${prefix} (table): falta el campo 'caption'.`, { nodeIndex: i });
      }
      if (!node.headers || node.headers.length === 0) {
        issue("JIN-CNT-007", `${prefix} (table): falta el campo 'headers'.`, { nodeIndex: i });
      }
    }

    // JIN-CNT-003: assessment debería seguir a practice o scenario
    if (node.type === "assessment" && prevType !== "practice" && prevType !== "scenario") {
      issue("JIN-CNT-003",
        `${prefix} (assessment): no está precedido por un nodo 'practice' o 'scenario' (previo: "${prevType || "ninguno"}").`,
        { nodeIndex: i }
      );
    }

    // JIN-CNT-004: claves de nodo citation existen en bib (compat)
    if (node.type === "citation" && bibKeys && Array.isArray(node.keys)) {
      for (const key of node.keys) {
        if (!bibKeys.has(key)) {
          issue("JIN-CNT-004",
            `${prefix} (citation): la clave "${key}" no existe en ${metadata.bibliography}.`,
            { nodeIndex: i }
          );
        }
      }
    }

    // JIN-CNT-012: nodo citation deprecado
    if (node.type === "citation") {
      issue("JIN-CNT-012",
        `${prefix}: el nodo 'citation' está deprecado. Usar {{cite:clave}} o {{cite:clave|narrative}} directamente en campos content.`,
        { nodeIndex: i }
      );
    }

    // JIN-CNT-013: figure requiere src XOR visualSpec
    if (node.type === "figure") {
      const hasSrc  = Boolean(node.src  && node.src.trim());
      const hasSpec = Boolean(node.visualSpec && node.visualSpec.trim());
      if (!hasSrc && !hasSpec) {
        issue("JIN-CNT-013",
          `${prefix} (figure): debe declarar 'src' o 'visualSpec' (ninguno encontrado).`,
          { nodeIndex: i }
        );
      }
    }

    prevType = node.type;
  }

  // ── JIN-CNT-011: bibliography debe ser el último nodo ──
  const bibNodeIndices = sections.reduce((acc, s, i) => s.type === "bibliography" ? [...acc, i] : acc, []);
  if (bibNodeIndices.length > 0) {
    const lastBibIndex = bibNodeIndices[bibNodeIndices.length - 1];
    if (lastBibIndex !== sections.length - 1) {
      issue("JIN-CNT-011",
        `El nodo 'bibliography' está en la posición ${lastBibIndex + 1} pero debe ser el último nodo (posición ${sections.length}).`
      );
    }
  }

  // ── JIN-CNT-004: claves inline {{cite:}} existen en bib ──
  if (bibKeys && allCitedKeys.length > 0) {
    for (const key of allCitedKeys) {
      if (!bibKeys.has(key)) {
        issues.push({
          rule: "JIN-CNT-004", category: "bibliography", severity: "warning",
          message: `Clave citada "${key}" (inline o nodo citation) no existe en ${metadata.bibliography}.`,
          file: absolute,
        });
      }
    }
  }

  return {
    tool: "jintia content-linter",
    version: "1.0.0",
    target: absolute,
    issues,
    summary: {
      errors:   issues.filter(i => i.severity === "error").length,
      warnings: issues.filter(i => i.severity === "warning").length,
      passed:   issues.filter(i => i.severity === "error").length === 0,
    },
  };
}

// ─── Salida ───────────────────────────────────────────────────────────────────

function printReport(report, asJson) {
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`Jintia Content Linter · ${report.target}`);

  if (!report.issues.length) {
    console.log("✓ No se encontraron incidencias.");
  } else {
    for (const item of report.issues) {
      const prefix = item.severity === "error" ? "✗" : "⚠";
      console.log(`${prefix} ${item.rule} · ${item.message}`);
    }
  }

  console.log(`\nResultado: ${report.summary.errors} errores, ${report.summary.warnings} advertencias.`);
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args   = process.argv.slice(2);
  const target = args.find(a => !a.startsWith("--"));
  const asJson = args.includes("--json");
  const strict = args.includes("--strict");

  if (!target) {
    console.error("Uso: node scripts/content-linter.js guide.json [--strict] [--json]");
    process.exit(2);
  }

  try {
    const report = lintGuide(target);
    printReport(report, asJson);

    const shouldFail = report.summary.errors > 0 ||
      (strict && report.summary.warnings > 0);

    if (shouldFail) process.exitCode = 1;
  } catch (err) {
    console.error(`content-linter: ${err.message}`);
    process.exitCode = 1;
  }
}

module.exports = { lintGuide, RULES };
