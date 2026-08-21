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
const { collectCitationKeys, collectFromContent } = require("./citation-keys");

const ROOT             = path.resolve(__dirname, "..");
const SCHEMA_PATH      = path.join(ROOT, "schemas", "guide.schema.json");
const EVIDENCE_SCHEMA_PATH = path.join(ROOT, "schemas", "evidence.schema.json");

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
  "JIN-ALN-010": {
    id: "JIN-ALN-010", category: "alignment", severity: "error",
    description: "Un target de metadata.targets no tiene ninguna sección de enseñanza (theory/concept).",
  },
  "JIN-ALN-011": {
    id: "JIN-ALN-011", category: "alignment", severity: "error",
    description: "Un target de metadata.targets no tiene ninguna práctica formativa (practice/scenario).",
  },
  "JIN-ALN-012": {
    id: "JIN-ALN-012", category: "alignment", severity: "error",
    description: "Un target tiene práctica pero ninguna declara feedback ni selfCheck.",
  },
  "JIN-ALN-013": {
    id: "JIN-ALN-013", category: "alignment", severity: "error",
    description: "Un target de metadata.targets no tiene ninguna sección 'assessment' que lo evalúe.",
  },
  "JIN-ALN-014": {
    id: "JIN-ALN-014", category: "alignment", severity: "error",
    description: "Un nodo 'assessment' evalúa un target que ninguna sección de enseñanza cubre.",
  },
  "JIN-ALN-015": {
    id: "JIN-ALN-015", category: "bibliography", severity: "warning",
    description: "Las secciones de enseñanza de un target no citan ninguna fuente bibliográfica.",
  },
  "JIN-WRK-001": {
    id: "JIN-WRK-001", category: "workload", severity: "warning",
    description: "La carga instruccional planificada (estimatedMinutes) se aleja de metadata.hours (70-89% o 111-130%).",
  },
  "JIN-WRK-002": {
    id: "JIN-WRK-002", category: "workload", severity: "error",
    description: "La carga instruccional planificada (estimatedMinutes) no corresponde a metadata.hours (<70% o >130%).",
  },
  "JIN-SELF-001": {
    id: "JIN-SELF-001", category: "self-instruction", severity: "error",
    description: "Ninguna sección declara estimatedMinutes: no hay ruta de aprendizaje con tiempo estimado.",
  },
  "JIN-SELF-002": {
    id: "JIN-SELF-002", category: "self-instruction", severity: "error",
    description: "Una práctica guiada (mode='guided') no declara workedExample.",
  },
  "JIN-SELF-003": {
    id: "JIN-SELF-003", category: "self-instruction", severity: "error",
    description: "Un nodo 'practice' no declara successCriteria (criterios de éxito observables).",
  },
  "JIN-SELF-004": {
    id: "JIN-SELF-004", category: "self-instruction", severity: "error",
    description: "Una práctica no declara selfCheck ni feedback: el estudiante no puede autocorregirse.",
  },
  "JIN-SELF-005": {
    id: "JIN-SELF-005", category: "self-instruction", severity: "error",
    description: "Ninguna práctica de la guía declara remediation.",
  },
  "JIN-SELF-006": {
    id: "JIN-SELF-006", category: "self-instruction", severity: "error",
    description: "Ninguna práctica de la guía usa mode='retrieval' (recuperación).",
  },
  "JIN-SELF-007": {
    id: "JIN-SELF-007", category: "self-instruction", severity: "error",
    description: "Ningún conjunto de nodos 'assessment' cubre, en total, todos los targets declarados.",
  },
  "JIN-SELF-008": {
    id: "JIN-SELF-008", category: "self-instruction", severity: "error",
    description: "Ninguna práctica de la guía declara selfCheck: no hay monitorización explícita de progreso.",
  },
  "JIN-SELF-009": {
    id: "JIN-SELF-009", category: "self-instruction", severity: "error",
    description: "Ninguna práctica de la guía usa mode='transfer' ni declara el campo transfer.",
  },
  "JIN-ASM-010": {
    id: "JIN-ASM-010", category: "assessment", severity: "error",
    description: "Un nodo 'assessment' no declara criteria.",
  },
  "JIN-ASM-011": {
    id: "JIN-ASM-011", category: "assessment", severity: "error",
    description: "Un nodo 'assessment' no declara product (producto observable).",
  },
  "JIN-ASM-012": {
    id: "JIN-ASM-012", category: "assessment", severity: "error",
    description: "Un nodo 'assessment' no declara targetIds válidos entre metadata.targets.",
  },
  "JIN-ASM-013": {
    id: "JIN-ASM-013", category: "assessment", severity: "warning",
    description: "La suma de 'score' entre todos los nodos 'assessment' supera 100.",
  },
  "JIN-EVD-005": {
    id: "JIN-EVD-005", category: "evidence", severity: "error",
    description: "guide.json referencia un claimId que no existe en evidence.json (o evidence.json no es JSON válido).",
  },
  "JIN-EVD-006": {
    id: "JIN-EVD-006", category: "evidence", severity: "warning",
    description: "Una afirmación con sourceMode 'notebooklm' o 'local' en evidence.json no declara bibliographyKey.",
  },
  "JIN-EVD-007": {
    id: "JIN-EVD-007", category: "evidence", severity: "error",
    description: "Una afirmación con sourceMode 'ai-knowledge' declara bibliographyKey: no se puede fabricar bibliografía en ese modo.",
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

  // ── JIN-WRK-*: carga horaria real vs. metadata.hours ──
  // Independiente del contrato de targets: solo requiere que se declare
  // metadata.hours y que al menos un nodo use estimatedMinutes (adopción
  // progresiva; guías que no usan el campo no se penalizan).
  const anyEstimated = sections.some(s => typeof s.estimatedMinutes === "number");
  if (typeof metadata.hours === "number" && metadata.hours > 0 && anyEstimated) {
    const declaredMinutes = metadata.hours * 60;
    const plannedMinutes  = sections.reduce((sum, s) => sum + (typeof s.estimatedMinutes === "number" ? s.estimatedMinutes : 0), 0);
    const coverage        = (plannedMinutes / declaredMinutes) * 100;
    const coverageStr     = coverage.toFixed(1);
    if (coverage < 70 || coverage > 130) {
      issue("JIN-WRK-002", `Cobertura de horas: ${coverageStr}% (${plannedMinutes} min planificados de ${declaredMinutes} min declarados en metadata.hours=${metadata.hours}). Fuera del rango aceptable.`);
    } else if (coverage < 90 || coverage > 110) {
      issue("JIN-WRK-001", `Cobertura de horas: ${coverageStr}% (${plannedMinutes} min planificados de ${declaredMinutes} min declarados en metadata.hours=${metadata.hours}). Fuera del rango ideal (90-110%).`);
    }
  }

  // ── Contrato de targets: JIN-ALN-01x, JIN-SELF-*, JIN-ASM-01x ──
  // Se activa solo cuando metadata.targets está declarado; las guías que aún
  // no adoptaron el contrato de targets no se penalizan retroactivamente.
  const targets = Array.isArray(metadata.targets) ? metadata.targets : [];
  if (targets.length > 0) {
    const targetIds       = new Set(targets.map(t => t.id));
    const practiceNodes   = sections.filter(s => s.type === "practice");
    const assessmentNodes = sections.filter(s => s.type === "assessment");
    const hasContent      = value => value !== undefined && value !== null && value !== "" &&
      !(Array.isArray(value) && value.length === 0);

    // JIN-ALN-010 .. JIN-ALN-015: matriz de alineación por target
    for (const target of targets) {
      const nodesForTarget = sections.filter(s => Array.isArray(s.targetIds) && s.targetIds.includes(target.id));
      const teachingNodes  = nodesForTarget.filter(s => s.type === "theory" || s.type === "concept");
      const practiceForT   = nodesForTarget.filter(s => s.type === "practice" || s.type === "scenario");
      const assessmentForT = nodesForTarget.filter(s => s.type === "assessment");

      if (teachingNodes.length === 0) {
        issue("JIN-ALN-010", `Target ${target.id}: no tiene ninguna sección de enseñanza ('theory'/'concept') con targetIds que lo incluya.`);
      }
      if (practiceForT.length === 0) {
        issue("JIN-ALN-011", `Target ${target.id}: no tiene ninguna práctica formativa ('practice'/'scenario') con targetIds que lo incluya.`);
      } else if (!practiceForT.some(s => hasContent(s.feedback) || hasContent(s.selfCheck))) {
        issue("JIN-ALN-012", `Target ${target.id}: tiene práctica pero ninguna declara 'feedback' ni 'selfCheck'.`);
      }
      if (assessmentForT.length === 0) {
        issue("JIN-ALN-013", `Target ${target.id}: no tiene ninguna sección 'assessment' con targetIds que lo evalúe.`);
      }
      if (teachingNodes.length > 0) {
        const citedInTeaching = teachingNodes.flatMap(s => collectFromContent(s.content));
        if (citedInTeaching.length === 0) {
          issue("JIN-ALN-015", `Target ${target.id}: sus secciones de enseñanza no citan ninguna fuente ({{cite:clave}}).`);
        }
      }
    }

    // JIN-ALN-014: assessment evalúa un target sin enseñanza en toda la guía
    const teachingTargetIds = new Set(
      sections
        .filter(s => (s.type === "theory" || s.type === "concept") && Array.isArray(s.targetIds))
        .flatMap(s => s.targetIds)
    );
    assessmentNodes.forEach(node => {
      const idx = sections.indexOf(node);
      for (const tid of (node.targetIds || [])) {
        if (!teachingTargetIds.has(tid)) {
          issue("JIN-ALN-014", `Nodo ${idx + 1} (assessment): evalúa ${tid}, pero ninguna sección de enseñanza declara ese target.`, { nodeIndex: idx });
        }
      }
    });

    // JIN-SELF-001: ruta de aprendizaje con tiempo estimado
    if (!anyEstimated) {
      issue("JIN-SELF-001", "Ninguna sección declara 'estimatedMinutes': no hay ruta de aprendizaje con tiempo estimado.");
    }

    // JIN-SELF-002 .. JIN-SELF-004: por nodo practice
    practiceNodes.forEach(node => {
      const idx  = sections.indexOf(node);
      const mode = node.mode || "guided";
      if (mode === "guided" && !hasContent(node.workedExample)) {
        issue("JIN-SELF-002", `Nodo ${idx + 1} (practice, mode='guided'): no declara 'workedExample'.`, { nodeIndex: idx });
      }
      if (!hasContent(node.successCriteria)) {
        issue("JIN-SELF-003", `Nodo ${idx + 1} (practice): no declara 'successCriteria'.`, { nodeIndex: idx });
      }
      if (!hasContent(node.selfCheck) && !hasContent(node.feedback)) {
        issue("JIN-SELF-004", `Nodo ${idx + 1} (practice): no declara 'selfCheck' ni 'feedback'; el estudiante no puede autocorregirse.`, { nodeIndex: idx });
      }
    });
    // JIN-SELF-005 .. JIN-SELF-009: contratos a nivel de guía completa
    if (!practiceNodes.some(s => hasContent(s.remediation))) {
      issue("JIN-SELF-005", "Ninguna práctica de la guía declara 'remediation'.");
    }
    if (!practiceNodes.some(s => s.mode === "retrieval")) {
      issue("JIN-SELF-006", "Ninguna práctica de la guía usa mode='retrieval' (recuperación).");
    }
    const assessedTargetIds = new Set(assessmentNodes.flatMap(s => s.targetIds || []));
    const missingFromFinalCheck = [...targetIds].filter(id => !assessedTargetIds.has(id));
    if (missingFromFinalCheck.length > 0) {
      issue("JIN-SELF-007", `Ningún nodo 'assessment' cubre, en conjunto, todos los targets declarados. Faltan: ${missingFromFinalCheck.join(", ")}.`);
    }
    if (!practiceNodes.some(s => hasContent(s.selfCheck))) {
      issue("JIN-SELF-008", "Ninguna práctica de la guía declara 'selfCheck': no hay monitorización explícita de progreso.");
    }
    if (!practiceNodes.some(s => s.mode === "transfer" || hasContent(s.transfer))) {
      issue("JIN-SELF-009", "Ninguna práctica de la guía usa mode='transfer' ni declara el campo 'transfer'.");
    }

    // JIN-ASM-010 .. JIN-ASM-013
    assessmentNodes.forEach(node => {
      const idx = sections.indexOf(node);
      if (!hasContent(node.criteria)) {
        issue("JIN-ASM-010", `Nodo ${idx + 1} (assessment): no declara 'criteria'.`, { nodeIndex: idx });
      }
      if (!hasContent(node.product)) {
        issue("JIN-ASM-011", `Nodo ${idx + 1} (assessment): no declara 'product' (producto observable).`, { nodeIndex: idx });
      }
      const nodeTargetIds = node.targetIds || [];
      const invalidTargets = nodeTargetIds.filter(tid => !targetIds.has(tid));
      if (nodeTargetIds.length === 0 || invalidTargets.length > 0) {
        issue("JIN-ASM-012", `Nodo ${idx + 1} (assessment): targetIds ausente o inválido (${invalidTargets.join(", ") || "vacío"}).`, { nodeIndex: idx });
      }
    });
    const totalScore = assessmentNodes.reduce((sum, s) => sum + (typeof s.score === "number" ? s.score : 0), 0);
    if (totalScore > 100) {
      issue("JIN-ASM-013", `La suma de 'score' entre nodos 'assessment' es ${totalScore}, supera 100.`);
    }
  }

  // ── evidence.json (opcional): procedencia por afirmación ──
  // Artefacto hermano de guide.json. Si no existe, no se valida nada (opt-in).
  const evidencePath = path.join(path.dirname(absolute), "evidence.json");
  if (fs.existsSync(evidencePath)) {
    let evidenceDoc = null;
    try {
      evidenceDoc = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
    } catch (err) {
      issues.push({
        rule: "JIN-EVD-005", category: "evidence", severity: "error",
        message: `evidence.json no es JSON válido: ${err.message}`, file: evidencePath,
      });
    }
    if (evidenceDoc) {
      const claims     = Array.isArray(evidenceDoc.claims) ? evidenceDoc.claims : [];
      const claimIds    = new Set(claims.map(c => c.id));
      const referenced  = new Set(sections.flatMap(s => Array.isArray(s.claimIds) ? s.claimIds : []));

      for (const claimId of referenced) {
        if (!claimIds.has(claimId)) {
          issue("JIN-EVD-005", `guide.json referencia claimIds "${claimId}" que no existe en evidence.json.`);
        }
      }
      for (const claim of claims) {
        if (claim.sourceMode === "ai-knowledge" && claim.bibliographyKey) {
          issue("JIN-EVD-007", `Claim "${claim.id}": procedencia 'ai-knowledge' con bibliographyKey "${claim.bibliographyKey}" declarado — no se puede fabricar bibliografía en ese modo.`);
        } else if ((claim.sourceMode === "notebooklm" || claim.sourceMode === "local") && !claim.bibliographyKey) {
          issue("JIN-EVD-006", `Claim "${claim.id}" (sourceMode='${claim.sourceMode}'): no declara bibliographyKey.`);
        }
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
