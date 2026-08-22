"use strict";

/**
 * syllabus-manager.js — Editor seguro del sílabo canónico (README.md)
 *
 * Proporciona operaciones atómicas sobre el README.md del curso.
 * Antes de cualquier modificación crea una copia de seguridad timestamped.
 * Después de modificar valida la integridad del documento.
 *
 * Nunca modifica el README.md directamente como texto libre; trabaja sobre
 * un modelo estructurado y lo serializa de vuelta.
 */

const fs   = require("node:fs");
const path = require("node:path");

// ─── Campos canónicos esperados en el README.md ───────────────────────────────

const REQUIRED_FIELDS = [
  { key: "asignatura",  pattern: /^\*\*Asignatura:\*\*/im },
  { key: "periodo",     pattern: /^\*\*Periodo académico ordinario:\*\*/im },
  { key: "semana",      pattern: /^###\s+Semana\s+\d{2}\s+/im },
  { key: "unidad",      pattern: /^\*\*Unidad:\*\*/im },
  { key: "tema",        pattern: /^\*\*Tema\s*\/\s*contenido semanal:\*\*/im },
  { key: "resultado",   pattern: /^\*\*Resultado de aprendizaje:\*\*/im },
  { key: "herramienta", pattern: /^\*\*Herramienta de aprendizaje:\*\*/im },
  { key: "horas",       pattern: /^\*\*Horas:\*\*/im },
  { key: "actividades", pattern: /^\*\*Actividades calificadas:\*\*/im },
];

// ─── Helpers internos ─────────────────────────────────────────────────────────

function timestamp() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
}

/**
 * Crea una copia de seguridad del archivo antes de modificarlo.
 * @returns {string} Ruta del respaldo creado
 */
function createBackup(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const dir  = path.dirname(filePath);
  const base = path.basename(filePath);
  const backup = path.join(dir, `${base}.bak-${timestamp()}`);
  fs.copyFileSync(filePath, backup);
  return backup;
}

/**
 * Restaura el respaldo más reciente del archivo.
 * @returns {{ restored: boolean, backup: string|null }}
 */
function restoreBackup(filePath) {
  const dir  = path.dirname(filePath);
  const base = path.basename(filePath);
  const prefix = `${base}.bak-`;

  let backups = [];
  try {
    backups = fs.readdirSync(dir)
      .filter(f => f.startsWith(prefix))
      .sort()
      .reverse();
  } catch { /* dir no existe */ }

  if (backups.length === 0) return { restored: false, backup: null };
  const latest = path.join(dir, backups[0]);
  fs.copyFileSync(latest, filePath);
  return { restored: true, backup: latest };
}

// ─── Parseo del sílabo a modelo estructurado ─────────────────────────────────

/**
 * Divide el contenido del README.md en bloques semana-a-semana y metadatos
 * de cabecera.
 *
 * Modelo devuelto:
 * {
 *   header: string,       // Todo antes de la primera sección ### Semana
 *   weeks: [
 *     { number: 2, raw: string },
 *     ...
 *   ],
 *   footer: string,       // Texto después de la última semana (normalmente vacío)
 * }
 */
function parseSyllabus(markdown) {
  const weekRegex = /^(###\s+Semana\s+(\d{1,2})\b[^\n]*)/im;
  const allWeeks  = [];
  let remaining   = markdown;
  let header      = "";
  let firstMatch  = null;

  // Encontrar el índice de la primera semana
  const firstIndex = remaining.search(/^###\s+Semana\s+\d{1,2}\b/im);
  if (firstIndex === -1) {
    return { header: remaining, weeks: [], footer: "" };
  }

  header    = remaining.slice(0, firstIndex);
  remaining = remaining.slice(firstIndex);

  // Dividir por separadores --- entre semanas
  const blocks = remaining.split(/^---\s*$/m);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^###\s+Semana\s+(\d{1,2})\b/im);
    if (m) {
      allWeeks.push({ number: parseInt(m[1], 10), raw: trimmed });
    } else if (allWeeks.length === 0) {
      header += trimmed + "\n";
    }
  }

  return { header, weeks: allWeeks, footer: "" };
}

/**
 * Serializa el modelo estructurado de vuelta a Markdown.
 */
function serializeSyllabus({ header, weeks, footer }) {
  const parts = [header.trimEnd()];
  if (weeks.length > 0) {
    parts.push("");
    parts.push(weeks.map(w => w.raw).join("\n\n---\n\n"));
  }
  if (footer && footer.trim()) parts.push(footer.trimEnd());
  return parts.join("\n") + "\n";
}

// ─── Operaciones de edición ───────────────────────────────────────────────────

/**
 * Reemplaza o inserta la semana `weekNumber` en el modelo.
 * Si la semana ya existe la reemplaza; si no, la añade en orden.
 *
 * @param {object} model        Resultado de parseSyllabus
 * @param {number} weekNumber   Número de semana
 * @param {string} weekMarkdown Contenido Markdown de la semana (sin ---  separador)
 * @returns {object}            Modelo actualizado
 */
function replaceWeek(model, weekNumber, weekMarkdown) {
  const entry = { number: weekNumber, raw: weekMarkdown.trim() };
  // Eliminar TODAS las entradas con el mismo número de semana (evita duplicados)
  model.weeks = model.weeks.filter(w => w.number !== weekNumber);
  model.weeks.push(entry);
  model.weeks.sort((a, b) => a.number - b.number);
  return model;
}

/**
 * Actualiza metadatos en la cabecera del sílabo (ej. Asignatura, Periodo).
 *
 * @param {object} model    Modelo del sílabo
 * @param {object} changes  { asignatura?, periodo?, ... }
 * @returns {object}        Modelo actualizado
 */
function updateCourseMetadata(model, changes) {
  let header = model.header;

  if (changes.asignatura) {
    header = header.replace(
      /(\*\*Asignatura:\*\*\s*)([^\n]+)/i,
      `$1${changes.asignatura}`
    );
  }
  if (changes.periodo) {
    header = header.replace(
      /(\*\*Periodo académico ordinario:\*\*\s*)([^\n]+)/i,
      `$1${changes.periodo}`
    );
  }

  return { ...model, header };
}

// ─── Validación ───────────────────────────────────────────────────────────────

/**
 * Valida el contenido Markdown de un sílabo.
 *
 * @param {string} markdown  Contenido del README.md
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateSyllabus(markdown) {
  const errors = [];

  // 1. Un solo encabezado principal (#)
  const h1Matches = markdown.match(/^#\s+[^\n]+/gm) || [];
  if (h1Matches.length === 0) errors.push("Falta el encabezado principal (# Nombre del curso).");
  if (h1Matches.length > 1)  errors.push(`Encabezado principal duplicado: se encontraron ${h1Matches.length} líneas # en lugar de 1.`);

  // 2. Un solo campo Asignatura
  const asigMatches = markdown.match(/^\*\*Asignatura:\*\*/gim) || [];
  if (asigMatches.length === 0) errors.push("Falta el campo **Asignatura:**.");
  if (asigMatches.length > 1)  errors.push(`Campo **Asignatura:** duplicado (${asigMatches.length} ocurrencias).`);

  // 3. Semanas con dos dígitos
  const malformedWeeks = [...markdown.matchAll(/^###\s+Semana\s+(\d+)/gim)]
    .filter(m => m[1].length === 1);
  if (malformedWeeks.length > 0) {
    errors.push(`Semanas sin dos dígitos: ${malformedWeeks.map(m => m[1]).join(", ")}. Usa Semana 01, Semana 02, etc.`);
  }

  // 4. Sin semanas duplicadas
  const weekNumbers = [...markdown.matchAll(/^###\s+Semana\s+(\d{1,2})/gim)]
    .map(m => parseInt(m[1], 10));
  const seen = new Set();
  const dupes = [];
  for (const n of weekNumbers) {
    if (seen.has(n)) dupes.push(n);
    seen.add(n);
  }
  if (dupes.length > 0) errors.push(`Semanas duplicadas: ${[...new Set(dupes)].join(", ")}.`);

  // 5. Ninguna no puede coexistir con actividades reales en el mismo bloque (misma línea o siguientes)
  const blocks = markdown.split(/^---\s*$/m);
  for (const block of blocks) {
    const ningunaLine = /\*\*Actividades calificadas:\*\*\s*Ninguna(.*)/i.exec(block);
    if (ningunaLine) {
      const restOfLine = ningunaLine[1] || "";
      const hasSameLine  = /\[(P|F|E|T)\d/i.test(restOfLine);
      const hasNextLines = /\*\*Actividades calificadas:\*\*[^\n]*\n(?:[^\n]+\n)*?[^\n]*\[(P|F|E|T)\d/i.test(block);
      if (hasSameLine || hasNextLines) {
        errors.push("Una semana tiene 'Ninguna' como actividad calificada pero también lista actividades reales.");
      }
    }
  }

  // 6. Campos obligatorios mínimos
  for (const field of REQUIRED_FIELDS) {
    if (!field.pattern.test(markdown)) {
      errors.push(`Falta el campo canónico: ${field.key}.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Operación de alto nivel ──────────────────────────────────────────────────

/**
 * Actualiza de forma segura el sílabo:
 * 1. Crea backup
 * 2. Parsea
 * 3. Aplica cambios
 * 4. Serializa
 * 5. Valida
 * 6. Guarda o restaura
 *
 * @param {string} readmePath    Ruta absoluta del README.md
 * @param {object} changes       { weekNumber?, weekMarkdown?, metadata? }
 * @returns {{ ok: boolean, backup: string|null, errors?: string[], path: string }}
 */
function safeUpdate(readmePath, changes) {
  if (!fs.existsSync(readmePath)) {
    return { ok: false, backup: null, errors: [`El archivo no existe: ${readmePath}`], path: readmePath };
  }

  const backup = createBackup(readmePath);
  const original = fs.readFileSync(readmePath, "utf8");

  let model = parseSyllabus(original);

  if (changes.metadata) {
    model = updateCourseMetadata(model, changes.metadata);
  }

  if (changes.weekNumber && changes.weekMarkdown) {
    model = replaceWeek(model, changes.weekNumber, changes.weekMarkdown);
  }

  const updated = serializeSyllabus(model);
  const { valid, errors } = validateSyllabus(updated);

  if (!valid) {
    // Restaurar automáticamente
    fs.writeFileSync(readmePath, original);
    return { ok: false, backup, errors, path: readmePath };
  }

  fs.writeFileSync(readmePath, updated);
  return { ok: true, backup, path: readmePath };
}

// ─── Validación por semana individual ────────────────────────────────────────

const WEEK_FIELD_PATTERNS = {
  unit:       /^\*\*Unidad:\*\*/im,
  topic:      /^\*\*Tema\s*\/\s*contenido semanal:\*\*/im,
  outcome:    /^\*\*Resultado de aprendizaje:\*\*/im,
  sources:    /^\*\*Herramienta de aprendizaje:\*\*/im,
  hours:      /^\*\*Horas:\*\*/im,
  activities: /^\*\*Actividades calificadas:\*\*/im,
};

const WEEK_FIELD_NAMES = {
  unit:       "Unidad",
  topic:      "Tema / contenido semanal",
  outcome:    "Resultado de aprendizaje",
  sources:    "Herramienta de aprendizaje",
  hours:      "Horas",
  activities: "Actividades calificadas",
};

/**
 * Valida que una semana específica existe en el sílabo y tiene todos sus campos.
 *
 * @param {string} markdown    Contenido completo del README.md
 * @param {number} weekNumber  Número de semana a validar
 * @returns {{ found: boolean, valid: boolean, week: number, fields: object, errors: string[] }}
 */
function validateWeek(markdown, weekNumber) {
  const model  = parseSyllabus(markdown);
  const n      = Number(weekNumber);
  const padded = String(n).padStart(2, "0");
  const week   = model.weeks.find(w => w.number === n);

  if (!week) {
    return {
      found:  false,
      valid:  false,
      week:   n,
      fields: {},
      errors: [`La semana ${padded} no existe en el sílabo.`],
    };
  }

  const raw    = week.raw;
  const fields = {};
  const errors = [];

  for (const [key, pattern] of Object.entries(WEEK_FIELD_PATTERNS)) {
    fields[key] = pattern.test(raw);
    if (!fields[key]) {
      errors.push(`Falta el campo "${WEEK_FIELD_NAMES[key]}" en semana ${padded}.`);
    }
  }

  return { found: true, valid: errors.length === 0, week: n, fields, errors };
}

/**
 * Extrae código y puntaje de las actividades calificadas declaradas en el
 * bloque de una semana (formato `- CÓDIGO — Nombre — N puntos`, ver
 * references/esquema-silabo.md). Best-effort: solo para cruzar contra
 * guide.json (JIN-ASM-013/016) cuando el sílabo sí declara esa información
 * en el formato canónico.
 *
 * @param {string} weekRaw  Bloque markdown de la semana (week.raw de parseSyllabus)
 * @returns {{code: string, points: number}[]|null}
 *   Array de actividades, [] si el sílabo declara "Ninguna" explícitamente,
 *   o null si el bloque no es parseable (no forzar el cruce en ese caso).
 */
function parseGradedActivities(weekRaw) {
  const match = /\*\*Actividades calificadas:\*\*([\s\S]*?)(?=\n\*\*|\n---|$)/i.exec(weekRaw);
  if (!match) return null;
  const block = match[1];
  if (/^\s*[-*]?\s*Ninguna\b/im.test(block)) return [];

  const activities = [];

  // Formato canónico: "- AC-01 — Nombre — 10 puntos" / "- PE-1.1 — Informe — 2.25 pts"
  const dashRe = /^[ \t]*[-*][ \t]*([A-Za-z]{1,4}-[\d.]+)\b[^\n]*?([\d]+(?:\.\d+)?)\s*(?:puntos?|pts?|%)/gim;
  let m;
  while ((m = dashRe.exec(block)) !== null) {
    activities.push({ code: m[1], points: parseFloat(m[2]) });
  }
  if (activities.length > 0) return activities;

  // Formato alterno: "[P1] Ejercicio relacional (20%)"
  const bracketRe = /\[([A-Za-z]{1,2}\d+)\][^\n(]*\(\s*([\d]+(?:\.\d+)?)\s*%\s*\)/gim;
  while ((m = bracketRe.exec(block)) !== null) {
    activities.push({ code: m[1], points: parseFloat(m[2]) });
  }
  return activities.length > 0 ? activities : null;
}

module.exports = {
  createBackup,
  restoreBackup,
  parseSyllabus,
  serializeSyllabus,
  replaceWeek,
  updateCourseMetadata,
  validateSyllabus,
  validateWeek,
  parseGradedActivities,
  safeUpdate,
  REQUIRED_FIELDS,
  WEEK_FIELD_PATTERNS,
  WEEK_FIELD_NAMES,
};
