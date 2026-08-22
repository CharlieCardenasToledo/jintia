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
const { getRule: getCatalogRule } = require("../runtime/core/rule-catalog");

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
  "JIN-BIB-007": {
    id: "JIN-BIB-007", category: "bibliography", severity: "error",
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
  "JIN-ALN-017": {
    id: "JIN-ALN-017", category: "alignment", severity: "error",
    description: "Un nodo 'assessment' evalúa un target antes de que termine su enseñanza o práctica (orden real de la secuencia).",
  },
  "JIN-WRK-001": {
    id: "JIN-WRK-001", category: "workload", severity: "warning",
    description: "La carga instruccional planificada (estimatedMinutes) se aleja de metadata.hours (70-89% o 111-130%).",
  },
  "JIN-WRK-002": {
    id: "JIN-WRK-002", category: "workload", severity: "error",
    description: "La carga instruccional planificada (estimatedMinutes) no corresponde a metadata.hours (<70% o >130%).",
  },
  "JIN-WRK-003": {
    id: "JIN-WRK-003", category: "workload", severity: "warning",
    description: "Un bloque académico relevante (theory/concept/practice/scenario/assessment) no declara estimatedMinutes.",
  },
  "JIN-WRK-004": {
    id: "JIN-WRK-004", category: "workload", severity: "warning",
    description: "La carga planificada está excesivamente concentrada en enseñanza (theory/concept) frente a práctica y evaluación.",
  },
  "JIN-WRK-005": {
    id: "JIN-WRK-005", category: "workload", severity: "warning",
    description: "El tiempo evaluativo planificado supera al de práctica formativa.",
  },
  "JIN-SELF-001": {
    id: "JIN-SELF-001", category: "self-instruction", severity: "error",
    description: "El nodo 'orientation' no declara 'route' (ruta de aprendizaje) no vacía.",
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
    description: "Una práctica 'guided' o 'independent' no declara remediation.",
  },
  "JIN-SELF-006": {
    id: "JIN-SELF-006", category: "self-instruction", severity: "warning",
    description: "Ninguna práctica de la guía usa mode='retrieval' (recuperación).",
  },
  "JIN-SELF-007": {
    id: "JIN-SELF-007", category: "self-instruction", severity: "error",
    description: "Ningún conjunto de nodos 'assessment' cubre, en total, todos los targets declarados.",
  },
  "JIN-SELF-008": {
    id: "JIN-SELF-008", category: "self-instruction", severity: "warning",
    description: "Ninguna práctica de la guía declara selfCheck: no hay monitorización explícita de progreso.",
  },
  "JIN-SELF-009": {
    id: "JIN-SELF-009", category: "self-instruction", severity: "warning",
    description: "Ninguna práctica de la guía usa mode='transfer' ni declara el campo transfer.",
  },
  "JIN-SELF-010": {
    id: "JIN-SELF-010", category: "self-instruction", severity: "error",
    description: "El nodo 'orientation' no declara 'purpose'; obligatorio en modo publish.",
  },
  "JIN-SELF-011": {
    id: "JIN-SELF-011", category: "self-instruction", severity: "error",
    description: "El nodo 'orientation' no declara 'materials'; obligatorio en modo publish.",
  },
  "JIN-SELF-012": {
    id: "JIN-SELF-012", category: "self-instruction", severity: "error",
    description: "El nodo 'orientation' no declara 'successCriteria'; obligatorio en modo publish.",
  },
  "JIN-SELF-013": {
    id: "JIN-SELF-013", category: "self-instruction", severity: "error",
    description: "El nodo 'orientation' no declara 'estimatedMinutes'; obligatorio en modo publish.",
  },
  "JIN-SELF-014": {
    id: "JIN-SELF-014", category: "self-instruction", severity: "error",
    description: "Una práctica guiada (mode='guided') no declara 'prompt'; obligatorio en modo publish.",
  },
  "JIN-SELF-015": {
    id: "JIN-SELF-015", category: "self-instruction", severity: "error",
    description: "Una práctica guiada (mode='guided') no declara 'steps'; obligatorio en modo publish.",
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
    id: "JIN-ASM-013", category: "assessment", severity: "error",
    description: "El 'points' de un nodo 'assessment' difiere del puntaje declarado en el sílabo para ese código.",
  },
  "JIN-ASM-016": {
    id: "JIN-ASM-016", category: "assessment", severity: "warning",
    description: "La suma de 'points' de actividades con código conocido no coincide con la suma declarada en el sílabo.",
  },
  "JIN-ASM-014": {
    id: "JIN-ASM-014", category: "assessment", severity: "warning",
    description: "Una actividad calificable (points > 0) o extensa (estimatedMinutes > 60) no declara submissionChecklist.",
  },
  "JIN-ASM-015": {
    id: "JIN-ASM-015", category: "assessment", severity: "warning",
    description: "Una actividad extensa (estimatedMinutes > 60) no declara ponderación por criterio (rúbrica).",
  },
  "JIN-EVD-005": {
    id: "JIN-EVD-005", category: "evidence", severity: "error",
    description: "guide.json referencia un claimId que no existe en evidence.json (o evidence.json no es JSON válido).",
  },
  "JIN-EVD-006": {
    id: "JIN-EVD-006", category: "evidence", severity: "warning",
    description: "Una afirmación con sourceMode 'notebook-primary' o 'local-fallback' en evidence.json no declara bibliographyKey.",
  },
  "JIN-EVD-010": {
    id: "JIN-EVD-010", category: "evidence", severity: "error",
    description: "Un keyClaim de evidence.json no declara sourceMode.",
  },
  "JIN-EVD-011": {
    id: "JIN-EVD-011", category: "evidence", severity: "warning",
    description: "NotebookLM devolvió extracción parcial (evidence.extractionStatus='partial') para un keyClaim.",
  },
  "JIN-EVD-012": {
    id: "JIN-EVD-012", category: "evidence", severity: "error",
    description: "Se atribuye a un keyClaim una bibliographyKey que no existe en reference.bib.",
  },
  "JIN-EVD-013": {
    id: "JIN-EVD-013", category: "evidence", severity: "warning",
    description: "Se utilizó ai-fallback (conocimiento del modelo) en al menos un keyClaim.",
  },
  "JIN-EVD-014": {
    id: "JIN-EVD-014", category: "evidence", severity: "error",
    description: "Un keyClaim con sourceMode 'ai-fallback' declara bibliographyKey: no se puede fabricar bibliografía en ese modo.",
  },
  "JIN-EVD-015": {
    id: "JIN-EVD-015", category: "evidence", severity: "warning",
    description: "Academic provenance de la semana = DEGRADED.",
  },
  "JIN-EVD-016": {
    id: "JIN-EVD-016", category: "evidence", severity: "error",
    description: "Academic provenance de la semana = BLOCKED (referencias inventadas, bibliografía rota o keyClaims centrales sin procedencia).",
  },
  "JIN-EVD-017": {
    id: "JIN-EVD-017", category: "evidence", severity: "error",
    description: "Un keyClaim con sourceMode 'notebook-primary' no declara evidencia estructurada (sourceId/sourceName/extractionStatus).",
  },
  "JIN-EVD-018": {
    id: "JIN-EVD-018", category: "evidence", severity: "error",
    description: "Un keyClaim con sourceMode 'local-fallback' no identifica la fuente local (sourceId/sourceName).",
  },
  "JIN-EVD-019": {
    id: "JIN-EVD-019", category: "evidence", severity: "error",
    description: "evidence.json declara un week distinto al de guide.json.",
  },
  "JIN-EVD-020": {
    id: "JIN-EVD-020", category: "evidence", severity: "error",
    description: "evidence.json es requerido para publicar cuando metadata.targets está declarado, y no existe (modo publish).",
  },
  "JIN-EVD-021": {
    id: "JIN-EVD-021", category: "evidence", severity: "error",
    description: "evidence.json no cumple su esquema (evidence.schema.json).",
  },
  "JIN-EVD-022": {
    id: "JIN-EVD-022", category: "evidence", severity: "error",
    description: "evidence.json existe pero no declara ningún keyClaim, y la guía tiene contenido disciplinar (modo publish).",
  },
  "JIN-EVD-023": {
    id: "JIN-EVD-023", category: "evidence", severity: "warning",
    description: "Uno o más claims de evidence.json no están referenciados desde guide.json (huérfanos); no se contabilizan en la procedencia.",
  },
  "JIN-EVD-024": {
    id: "JIN-EVD-024", category: "evidence", severity: "error",
    description: "evidence.json declara keyClaims pero ninguno está referenciado desde guide.json: la procedencia académica no es calculable.",
  },
  "JIN-EVD-025": {
    id: "JIN-EVD-025", category: "evidence", severity: "error",
    description: "evidence.json declara dos o más claims con el mismo id: rompe la identidad única del grafo de evidencia.",
  },
  "JIN-EVD-026": {
    id: "JIN-EVD-026", category: "evidence", severity: "error",
    description: "Un keyClaim usado no declara 'targetId' válido (debe existir en metadata.targets); obligatorio en modo publish.",
  },
  "JIN-EVD-027": {
    id: "JIN-EVD-027", category: "evidence", severity: "error",
    description: "Un target de metadata.targets no tiene ningún keyClaim usado que lo sustente; obligatorio en modo publish.",
  },
  "JIN-SCH-002": {
    id: "JIN-SCH-002", category: "schema", severity: "error",
    description: "metadata.targets es obligatorio para publicar (modo publish).",
  },
  "JIN-SCH-003": {
    id: "JIN-SCH-003", category: "schema", severity: "error",
    description: "metadata.hours es obligatorio para publicar (modo publish).",
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

function lintGuide(guidePath, options = {}) {
  const absolute = path.resolve(guidePath);
  const publish  = options.mode === "publish";
  const issues   = [];

  function issue(ruleId, message, extra = {}) {
    // rules/catalog.json es la fuente única de verdad para severity/category;
    // RULES (local, con description larga para --help/CLI) es solo fallback
    // defensivo si un código aún no se sincronizó al catálogo.
    const rule = getCatalogRule(ruleId) || RULES[ruleId];
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
    const schRule = getCatalogRule("JIN-SCH-001");
    issues.push({
      rule: "JIN-SCH-001", category: schRule.category, severity: schRule.severity,
      message: msg, file: absolute,
    });
  }

  const metadata = guide.metadata || {};
  const sections = guide.sections || [];

  // ── Modo publish: targets y horas dejan de ser opcionales ──
  // En draft/validate normal, metadata.targets y metadata.hours son opt-in
  // (adopción progresiva). En publish, una guía académica final debe
  // declarar ambos: sin ellos no hay matriz de alineación ni presupuesto de
  // horas verificable.
  if (publish) {
    if (!Array.isArray(metadata.targets) || metadata.targets.length === 0) {
      issue("JIN-SCH-002", "metadata.targets es obligatorio para publicar: descompón el resultado de aprendizaje en targets antes de compilar en modo publish.");
    }
    if (typeof metadata.hours !== "number") {
      issue("JIN-SCH-003", "metadata.hours es obligatorio para publicar: declara la carga horaria del sílabo antes de compilar en modo publish.");
    }
  }

  // ── Contrato mínimo de autoinstruccionalidad (obligatorio en publish) ──
  // Independiente del contrato de targets (JIN-SELF-00x más abajo, opt-in
  // vía metadata.targets): orientation y la práctica guiada son
  // estructurales para que el estudiante avance sin un tutor presente, así
  // que se exigen siempre en publish.
  if (publish) {
    const hasContentPub = value => value !== undefined && value !== null && value !== "" &&
      !(Array.isArray(value) && value.length === 0);
    const orientationForPublish = sections.find(s => s.type === "orientation");
    if (orientationForPublish) {
      if (!hasContentPub(orientationForPublish.purpose)) {
        issue("JIN-SELF-010", "El nodo 'orientation' no declara 'purpose' (obligatorio en publish).");
      }
      if (!hasContentPub(orientationForPublish.materials)) {
        issue("JIN-SELF-011", "El nodo 'orientation' no declara 'materials' (obligatorio en publish).");
      }
      if (!hasContentPub(orientationForPublish.successCriteria)) {
        issue("JIN-SELF-012", "El nodo 'orientation' no declara 'successCriteria' (obligatorio en publish).");
      }
      if (typeof orientationForPublish.estimatedMinutes !== "number") {
        issue("JIN-SELF-013", "El nodo 'orientation' no declara 'estimatedMinutes' (obligatorio en publish).");
      }
    }
    sections.forEach((node, idx) => {
      if (node.type !== "practice" || (node.mode || "guided") !== "guided") return;
      if (!hasContentPub(node.prompt)) {
        issue("JIN-SELF-014", `Nodo ${idx + 1} (practice, mode='guided'): no declara 'prompt' (obligatorio en publish).`, { nodeIndex: idx });
      }
      if (!hasContentPub(node.steps)) {
        issue("JIN-SELF-015", `Nodo ${idx + 1} (practice, mode='guided'): no declara 'steps' (obligatorio en publish).`, { nodeIndex: idx });
      }
    });
  }

  // ── JIN-CNT-005: outcome obligatorio ──
  if (!metadata.outcome || metadata.outcome.trim() === "") {
    issue("JIN-CNT-005", "El campo 'outcome' en metadata está ausente o vacío.");
  }

  // ── JIN-BIB-007: citationStyle debe ser 'apa' ──
  if (metadata.citationStyle && metadata.citationStyle !== "apa") {
    issue("JIN-BIB-007", `citationStyle "${metadata.citationStyle}" no está permitido; Jintia exige "apa" en esta versión.`);
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
      const cntRule = getCatalogRule("JIN-CNT-004");
      issues.push({
        rule: "JIN-CNT-004", category: cntRule.category, severity: cntRule.severity,
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
        const cntRule = getCatalogRule("JIN-CNT-004");
        issues.push({
          rule: "JIN-CNT-004", category: cntRule.category, severity: cntRule.severity,
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

  // ── JIN-WRK-004 / JIN-WRK-005: distribución de la carga planificada ──
  if (anyEstimated) {
    const minutesByType = type => sections
      .filter(s => s.type === type && typeof s.estimatedMinutes === "number")
      .reduce((sum, s) => sum + s.estimatedMinutes, 0);
    const teachingMinutes   = minutesByType("theory") + minutesByType("concept");
    const practiceMinutes   = minutesByType("practice") + minutesByType("scenario");
    const assessmentMinutes = minutesByType("assessment");
    const totalMinutes      = sections.reduce((sum, s) => sum + (typeof s.estimatedMinutes === "number" ? s.estimatedMinutes : 0), 0);

    if (totalMinutes > 0 && teachingMinutes / totalMinutes > 0.6) {
      issue("JIN-WRK-004", `La enseñanza (theory/concept) concentra ${((teachingMinutes / totalMinutes) * 100).toFixed(1)}% de la carga planificada; revisar el balance con práctica y evaluación.`);
    }
    if (practiceMinutes > 0 && assessmentMinutes > practiceMinutes) {
      issue("JIN-WRK-005", `El tiempo evaluativo planificado (${assessmentMinutes} min) supera el de práctica formativa (${practiceMinutes} min).`);
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

    // JIN-ALN-016: contenido extenso de teoría/concepto sin targetIds declarado
    const contentLength = value => {
      if (typeof value === "string") return value.length;
      if (Array.isArray(value)) return value.reduce((sum, v) => sum + contentLength(v), 0);
      return 0;
    };
    sections.forEach((node, idx) => {
      if ((node.type !== "theory" && node.type !== "concept") || hasContent(node.targetIds)) return;
      if (contentLength(node.content) > 400) {
        issue("JIN-ALN-016", `Nodo ${idx + 1} (${node.type}): contenido extenso (${contentLength(node.content)} caracteres) sin relación explícita con un target (targetIds vacío).`, { nodeIndex: idx });
      }
    });

    // JIN-WRK-003: bloque académico relevante sin estimatedMinutes
    sections.forEach((node, idx) => {
      if (!["theory", "concept", "practice", "scenario", "assessment"].includes(node.type)) return;
      if (typeof node.estimatedMinutes !== "number") {
        issue("JIN-WRK-003", `Nodo ${idx + 1} (${node.type}): no declara 'estimatedMinutes'.`, { nodeIndex: idx });
      }
    });

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

    // JIN-ALN-017: orden real — un assessment no puede preceder a la última
    // sección de enseñanza o práctica INICIAL (guided/independent) del mismo
    // target (ALN-014 solo comprueba que exista en algún lugar de la guía,
    // no el orden). La práctica 'retrieval'/'transfer' queda excluida a
    // propósito: es un patrón instruccional válido colocarla después de la
    // evaluación (recuperación espaciada, transferencia posterior).
    assessmentNodes.forEach(node => {
      const idx = sections.indexOf(node);
      for (const tid of (node.targetIds || [])) {
        const priorIndices = sections
          .map((s, i) => ({ s, i }))
          .filter(({ s }) => {
            if (!Array.isArray(s.targetIds) || !s.targetIds.includes(tid)) return false;
            if (s.type === "theory" || s.type === "concept") return true;
            if (s.type === "practice" || s.type === "scenario") {
              const mode = s.mode || "guided";
              return mode !== "retrieval" && mode !== "transfer";
            }
            return false;
          })
          .map(({ i }) => i);
        if (priorIndices.length > 0 && idx < Math.max(...priorIndices)) {
          issue("JIN-ALN-017", `Nodo ${idx + 1} (assessment): evalúa ${tid} antes de que termine su enseñanza/práctica (nodo ${Math.max(...priorIndices) + 1}).`, { nodeIndex: idx });
        }
      }
    });

    // JIN-SELF-001: ruta de aprendizaje real (orientation.route), no un proxy de tiempo
    const orientationNode = sections.find(s => s.type === "orientation");
    if (!orientationNode || !hasContent(orientationNode.route)) {
      issue("JIN-SELF-001", "El nodo 'orientation' no declara 'route' (ruta de aprendizaje) no vacía.");
    }

    // JIN-SELF-002 .. JIN-SELF-005: por nodo practice
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
      // JIN-SELF-005: la remediación se exige por práctica crítica (guided/independent),
      // no basta con que exista en alguna práctica cualquiera de la guía.
      if ((mode === "guided" || mode === "independent") && !hasContent(node.remediation)) {
        issue("JIN-SELF-005", `Nodo ${idx + 1} (practice, mode='${mode}'): no declara 'remediation'.`, { nodeIndex: idx });
      }
    });
    // JIN-SELF-006 .. JIN-SELF-009: contratos a nivel de guía completa
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
      const isComplex = (typeof node.points === "number" && node.points > 0) || (typeof node.estimatedMinutes === "number" && node.estimatedMinutes > 60);
      if (isComplex && !hasContent(node.submissionChecklist)) {
        issue("JIN-ASM-014", `Nodo ${idx + 1} (assessment): actividad calificable o extensa sin 'submissionChecklist'.`, { nodeIndex: idx });
      }
      const isExtensive = typeof node.estimatedMinutes === "number" && node.estimatedMinutes > 60;
      const hasRubric    = Array.isArray(node.criteria) && node.criteria.some(c => typeof c.weight === "number");
      if (isExtensive && Array.isArray(node.criteria) && node.criteria.length > 0 && !hasRubric) {
        issue("JIN-ASM-015", `Nodo ${idx + 1} (assessment): actividad extensa sin ponderación por criterio (rúbrica).`, { nodeIndex: idx });
      }
    });
    // JIN-ASM-013 / JIN-ASM-016: cotejar code/points contra el sílabo, cuando
    // la estructura del curso (courseRoot/semanas/semana-XX/guide.json) y el
    // formato de "Actividades calificadas" del README son detectables. Si no
    // lo son, no se fuerza el cruce (evita falsos positivos por formatos
    // institucionales distintos).
    const weekDir     = path.dirname(absolute);
    const semanasDir  = path.dirname(weekDir);
    const courseRoot  = path.dirname(semanasDir);
    const readmePath  = path.join(courseRoot, "README.md");
    if (path.basename(semanasDir) === "semanas" && fs.existsSync(readmePath) && typeof metadata.week === "number") {
      try {
        const { parseSyllabus, parseGradedActivities } = require("../runtime/core/syllabus-manager");
        const model = parseSyllabus(fs.readFileSync(readmePath, "utf8"));
        const week  = model.weeks.find(w => w.number === metadata.week);
        const syllabusActivities = week ? parseGradedActivities(week.raw) : null;
        if (Array.isArray(syllabusActivities) && syllabusActivities.length > 0) {
          const syllabusByCode = new Map(syllabusActivities.map(a => [a.code, a.points]));
          for (const node of assessmentNodes) {
            const idx = sections.indexOf(node);
            if (node.code && syllabusByCode.has(node.code) && typeof node.points === "number") {
              const declared = syllabusByCode.get(node.code);
              if (Math.abs(declared - node.points) > 0.01) {
                issue("JIN-ASM-013", `Nodo ${idx + 1} (assessment ${node.code}): points=${node.points} difiere del sílabo (${declared}).`, { nodeIndex: idx });
              }
            }
          }
          const guidePointsWithCode = assessmentNodes
            .filter(s => s.code && syllabusByCode.has(s.code) && typeof s.points === "number")
            .reduce((sum, s) => sum + s.points, 0);
          const syllabusTotal = syllabusActivities.reduce((sum, a) => sum + a.points, 0);
          if (guidePointsWithCode > 0 && Math.abs(guidePointsWithCode - syllabusTotal) > 0.01) {
            issue("JIN-ASM-016", `La suma de 'points' de actividades con código conocido (${guidePointsWithCode}) no coincide con la suma declarada en el sílabo para esta semana (${syllabusTotal}).`);
          }
        }
      } catch { /* sílabo no parseable en este formato: no forzar el cruce */ }
    }
  }

  // ── evidence.json (opcional): procedencia por afirmación ──
  // Artefacto hermano de guide.json. Si no existe, no se valida nada (opt-in).
  let provenanceSummary = null;
  const evidencePath = path.join(path.dirname(absolute), "evidence.json");
  const targetsDeclared = Array.isArray(metadata.targets) && metadata.targets.length > 0;

  if (publish && targetsDeclared && !fs.existsSync(evidencePath)) {
    issue("JIN-EVD-020", "evidence.json es requerido para publicar cuando metadata.targets está declarado: registra la procedencia de cada keyClaim antes de compilar en modo publish.");
  }

  if (fs.existsSync(evidencePath)) {
    let evidenceDoc = null;
    try {
      evidenceDoc = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
    } catch (err) {
      const evdRule = getCatalogRule("JIN-EVD-005");
      issues.push({
        rule: "JIN-EVD-005", category: evdRule.category, severity: evdRule.severity,
        message: `evidence.json no es JSON válido: ${err.message}`, file: evidencePath,
      });
    }
    if (evidenceDoc) {
      // JIN-EVD-021: evidence.json debe cumplir su JSON Schema real (enum de
      // sourceMode, forma de evidence, etc.) — no solo los checks manuales
      // de abajo. Sin esto, un sourceMode arbitrario podría escapar de las
      // comprobaciones específicas y contaminar el cálculo de procedencia.
      let evidenceSchema;
      try {
        evidenceSchema = JSON.parse(fs.readFileSync(EVIDENCE_SCHEMA_PATH, "utf8"));
      } catch { evidenceSchema = null; }
      if (evidenceSchema) {
        const evidenceSchemaErrors = validateSchema(evidenceDoc, evidenceSchema, "$", evidenceSchema);
        for (const msg of evidenceSchemaErrors) {
          issue("JIN-EVD-021", `evidence.json no cumple su esquema: ${msg}`);
        }
      }

      const claims     = Array.isArray(evidenceDoc.claims) ? evidenceDoc.claims : [];
      const claimIds    = new Set(claims.map(c => c.id));
      const referenced  = new Set(sections.flatMap(s => Array.isArray(s.claimIds) ? s.claimIds : []));

      // JIN-EVD-025: identidad única de claims — un id duplicado podría
      // fusionarse silenciosamente en el cálculo de procedencia y rompe el
      // grafo target → claim → evidencia.
      const claimIdCounts = new Map();
      for (const c of claims) {
        if (!c.id) continue;
        claimIdCounts.set(c.id, (claimIdCounts.get(c.id) || 0) + 1);
      }
      const duplicateClaimIds = [...claimIdCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
      if (duplicateClaimIds.length > 0) {
        issue("JIN-EVD-025", `evidence.json declara id(s) de claim duplicado(s): ${duplicateClaimIds.join(", ")}.`);
      }

      for (const claimId of referenced) {
        if (!claimIds.has(claimId)) {
          issue("JIN-EVD-005", `guide.json referencia claimIds "${claimId}" que no existe en evidence.json.`);
        }
      }

      // JIN-EVD-022: en publish, si la guía tiene contenido disciplinar
      // (theory/concept) evidence.json no puede quedarse con claims: [].
      const hasDisciplinaryContent = sections.some(s => s.type === "theory" || s.type === "concept");
      if (publish && hasDisciplinaryContent && claims.length === 0) {
        issue("JIN-EVD-022", "evidence.json existe pero no declara ningún keyClaim, y la guía tiene contenido disciplinar (theory/concept).");
      }

      // JIN-EVD-023: claims declarados en evidence.json que ningún nodo de
      // guide.json referencia vía claimIds — no cuentan en el cálculo de
      // procedencia (ver más abajo) y podrían inflarlo artificialmente si se
      // contaran.
      const orphanClaims = claims.filter(c => c.id && !referenced.has(c.id));
      if (orphanClaims.length > 0) {
        issue("JIN-EVD-023", `${orphanClaims.length} claim(s) en evidence.json no están referenciados desde guide.json (huérfanos): ${orphanClaims.map(c => c.id).join(", ")}. No se contabilizan en el cálculo de procedencia.`);
      }

      let blocked = false;
      for (const claim of claims) {
        if (!claim.sourceMode) {
          issue("JIN-EVD-010", `Claim "${claim.id}": no declara 'sourceMode'.`);
          blocked = true;
          continue;
        }
        if (claim.sourceMode === "ai-fallback" && claim.bibliographyKey) {
          issue("JIN-EVD-014", `Claim "${claim.id}": procedencia 'ai-fallback' con bibliographyKey "${claim.bibliographyKey}" declarado — no se puede fabricar bibliografía en ese modo.`);
          blocked = true;
        } else if ((claim.sourceMode === "notebook-primary" || claim.sourceMode === "local-fallback") && !claim.bibliographyKey) {
          issue("JIN-EVD-006", `Claim "${claim.id}" (sourceMode='${claim.sourceMode}'): no declara bibliographyKey.`);
        }
        if (claim.bibliographyKey && bibKeys && !bibKeys.has(claim.bibliographyKey)) {
          issue("JIN-EVD-012", `Claim "${claim.id}": bibliographyKey "${claim.bibliographyKey}" no existe en ${metadata.bibliography}.`);
          blocked = true;
        }
        if (claim.evidence && claim.evidence.extractionStatus === "partial") {
          issue("JIN-EVD-011", `Claim "${claim.id}": NotebookLM devolvió extracción parcial (extractionStatus='partial').`);
        }
        // JIN-EVD-017 / JIN-EVD-018: no basta con declarar sourceMode — se exige
        // evidencia estructurada real. Sin esto, un claim "notebook-primary" sin
        // fuente identificable podría fabricar un academicProvenance STRONG falso.
        if (claim.sourceMode === "notebook-primary") {
          const ev = claim.evidence || {};
          if (!ev.sourceId || !ev.sourceName || !ev.extractionStatus) {
            issue("JIN-EVD-017", `Claim "${claim.id}": sourceMode 'notebook-primary' sin evidencia estructurada (requiere evidence.sourceId, sourceName y extractionStatus).`);
            blocked = true;
          }
        }
        if (claim.sourceMode === "local-fallback") {
          const ev = claim.evidence || {};
          if (!ev.sourceId && !ev.sourceName) {
            issue("JIN-EVD-018", `Claim "${claim.id}": sourceMode 'local-fallback' sin identificar la fuente local (evidence.sourceId o sourceName).`);
            blocked = true;
          }
        }
      }

      // JIN-EVD-019: evidence.json debe corresponder a la misma semana que
      // guide.json. En publish, además, declarar 'week' deja de ser opcional.
      if (typeof evidenceDoc.week === "number" && typeof metadata.week === "number" && evidenceDoc.week !== metadata.week) {
        issue("JIN-EVD-019", `evidence.json declara week=${evidenceDoc.week}, pero guide.json es metadata.week=${metadata.week}.`);
        blocked = true;
      } else if (publish && typeof evidenceDoc.week !== "number") {
        issue("JIN-EVD-019", "evidence.json no declara 'week': obligatorio en modo publish para confirmar que corresponde a esta semana.");
        blocked = true;
      }

      // ── provenanceSummary / academicProvenance ──
      // Calculado exclusivamente sobre los keyClaims que guide.json referencia
      // vía claimIds (usedClaims), no sobre todos los claims de evidence.json:
      // de lo contrario se podría inflar notebookPrimary agregando claims
      // NotebookLM que la guía nunca usa (ver JIN-EVD-023, huérfanos).
      const usedClaims = claims.filter(c => c.id && referenced.has(c.id));
      if (claims.length > 0 && usedClaims.length === 0) {
        issue("JIN-EVD-024", "evidence.json declara keyClaims pero ninguno está referenciado desde guide.json: la procedencia académica no es calculable sobre afirmaciones reales de esta guía.");
        blocked = true;
      }

      // JIN-EVD-026 / JIN-EVD-027 (publish): cierra el grafo target → claim →
      // evidencia de forma determinista. La matriz de alineación del plan
      // puede declarar "T3 evidence = true", pero sin esto evidence.json
      // final podría no contener ningún keyClaim asociado específicamente a
      // T3 — targetId hace esa relación verificable en el propio artefacto.
      if (publish && targetsDeclared) {
        const targetIdSet = new Set(targets.map(t => t.id));
        for (const claim of usedClaims) {
          if (!claim.targetId || !targetIdSet.has(claim.targetId)) {
            issue("JIN-EVD-026", `Claim "${claim.id}": no declara 'targetId' válido (debe existir en metadata.targets).`);
            blocked = true;
          }
        }
        const coveredTargetIds = new Set(usedClaims.filter(c => c.targetId).map(c => c.targetId));
        const targetsWithoutEvidence = targets.filter(t => !coveredTargetIds.has(t.id));
        if (targetsWithoutEvidence.length > 0) {
          issue("JIN-EVD-027", `Target(s) sin ningún keyClaim usado que lo sustente: ${targetsWithoutEvidence.map(t => t.id).join(", ")}.`);
        }
      }

      if (usedClaims.length > 0) {
        const pct = mode => (usedClaims.filter(c => c.sourceMode === mode).length / usedClaims.length) * 100;
        const notebookPrimary = pct("notebook-primary");
        const localFallback   = pct("local-fallback");
        const aiFallback      = pct("ai-fallback");
        const hasGap          = [...referenced].some(id => !claimIds.has(id));

        if (aiFallback > 0) {
          issue("JIN-EVD-013", `Se utilizó ai-fallback en ${usedClaims.filter(c => c.sourceMode === "ai-fallback").length} de ${usedClaims.length} keyClaim(s) referenciados.`);
        }

        let academicProvenance;
        if (blocked) {
          academicProvenance = "BLOCKED";
          issue("JIN-EVD-016", "Academic provenance = BLOCKED: hay keyClaims sin sourceMode, con bibliographyKey inexistente, con bibliografía fabricada en modo ai-fallback, o sin evidencia estructurada real.");
        } else if (aiFallback > 30 || hasGap) {
          academicProvenance = "WEAK";
        } else if (aiFallback > 10 || usedClaims.some(c => c.evidence && c.evidence.extractionStatus === "partial")) {
          academicProvenance = "DEGRADED";
          issue("JIN-EVD-015", `Academic provenance = DEGRADED (ai-fallback: ${aiFallback.toFixed(1)}%).`);
        } else if (aiFallback === 0 && notebookPrimary >= 80) {
          academicProvenance = "STRONG";
        } else {
          academicProvenance = "GOOD";
        }

        provenanceSummary = {
          notebookPrimary: Math.round(notebookPrimary * 10) / 10,
          localFallback:   Math.round(localFallback * 10) / 10,
          aiFallback:      Math.round(aiFallback * 10) / 10,
          academicProvenance,
        };
      }
    }
  }

  return {
    tool: "jintia content-linter",
    version: "1.0.0",
    target: absolute,
    issues,
    provenanceSummary,
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
