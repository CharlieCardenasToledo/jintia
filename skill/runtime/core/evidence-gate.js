"use strict";

/**
 * evidence-gate.js — Compuerta de evidencia verificable
 *
 * Jerarquía única de fuentes (sourceMode): 'notebook-primary' (3 intentos
 * estructurados, ver SKILL.md §2) → 'local-fallback' (fuentes locales
 * verificables) → 'ai-fallback' (conocimiento del modelo) como último
 * recurso. La generación ya no se detiene por falta total de evidencia:
 * continúa con procedencia 'ai-fallback' declarada explícitamente, para que
 * el audit pueda advertirlo (JIN-EVD-001 / JIN-EVD-003) sin bloquear al
 * usuario. Lo que sigue bloqueando es que un agente presente conocimiento
 * general COMO SI fuera evidencia verificada, sin declarar esa procedencia
 * (JIN-EVD-002). En modo 'ai-fallback' nunca se fabrica bibliografía: ningún
 * autor, obra, año, página o DOI inventado.
 *
 * Códigos:
 *   JIN-EVD-001  Sin NotebookLM ni fuentes locales → continúa con ai-fallback (warning)
 *   JIN-EVD-002  Intento de sustituir evidencia por conocimiento genérico sin declararlo (bloquea)
 *   JIN-EVD-003  NotebookLM falló tras 3 intentos y sin fuentes locales → continúa con ai-fallback (warning)
 *   JIN-EVD-028  local-fallback usado sin evidencia de haber agotado la política de 3 intentos (warning)
 *
 * Trazabilidad de intentos (opcional): quien llama a check() puede declarar
 * notebookLM.attempts ([{ attempt, result, reAuth? }]) y notebookLM.
 * fallbackReason para que el resultado incluya notebookResolution — así el
 * "NotebookLM no disponible" deja de ser solo una instrucción de política y
 * queda registrado por qué se activó el fallback local o ai-fallback.
 */

const fs   = require("node:fs");
const path = require("node:path");

// ─── Constantes ───────────────────────────────────────────────────────────────

const ERRORS = {
  JIN_EVD_001: {
    code:    "JIN-EVD-001",
    message: "No existe evidencia verificable (NotebookLM ni fuentes locales) para esta semana.",
    detail:  "Se continúa con conocimiento del modelo (procedencia 'ai-fallback'). No se fabricará bibliografía: registra un notebook o fuente local para elevar la procedencia.",
  },
  JIN_EVD_002: {
    code:    "JIN-EVD-002",
    message: "No está permitido presentar conocimiento general como evidencia verificada sin declarar procedencia 'ai-fallback'.",
    detail:  "Jintia requiere procedencia explícita en cada afirmación disciplinar: 'notebook-primary', 'local-fallback' o 'ai-fallback'.",
  },
  JIN_EVD_003: {
    code:    "JIN-EVD-003",
    message: "NotebookLM no disponible tras los 3 intentos y sin fuentes locales de respaldo.",
    detail:  "Se continúa con conocimiento del modelo (procedencia 'ai-fallback'). No se fabricará bibliografía: registra una fuente local o resuelve NotebookLM para elevar la procedencia.",
  },
  JIN_EVD_028: {
    code:    "JIN-EVD-028",
    message: "local-fallback se usó sin evidencia de haber agotado la política de 3 intentos de NotebookLM.",
    detail:  "Declara notebookLM.attempts (intento 1..3, con su resultado) para que el fallback local quede auditable, no solo declarado por política.",
  },
};

// ─── Utilidades internas ──────────────────────────────────────────────────────

function dirHasFiles(dirPath, extensions) {
  if (!fs.existsSync(dirPath)) return false;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.some(e => {
      if (e.isDirectory()) return dirHasFiles(path.join(dirPath, e.name), extensions);
      return !extensions || extensions.some(ext => e.name.endsWith(ext));
    });
  } catch { return false; }
}

function checkLocalSources(courseRoot, weekNumber) {
  const weekPadded = String(weekNumber).padStart(2, "0");
  const sources = [];

  // reference.bib en la carpeta de la semana
  const bibPath = path.join(courseRoot, "semanas", `semana-${weekPadded}`, "reference.bib");
  if (fs.existsSync(bibPath) && fs.statSync(bibPath).size > 20) {
    sources.push({ type: "bib", path: bibPath });
  }

  // Recortes en bibliografia/recortes_por_semana/semana-XX/
  const clipsDir = path.join(courseRoot, "bibliografia", "recortes_por_semana", `semana-${weekPadded}`);
  if (dirHasFiles(clipsDir, [".md", ".txt", ".pdf"])) {
    sources.push({ type: "clips", path: clipsDir });
  }

  // Bibliografía local general en bibliografia/
  const biblioDir = path.join(courseRoot, "bibliografia");
  if (dirHasFiles(biblioDir, [".pdf", ".epub", ".bib"])) {
    sources.push({ type: "local_bibliography", path: biblioDir });
  }

  // Sílabo con fuentes declaradas (la línea debe tener contenido real, no solo espacios)
  const readmePath = path.join(courseRoot, "README.md");
  if (fs.existsSync(readmePath)) {
    const content = fs.readFileSync(readmePath, "utf8");
    // Acepta fuente en la misma línea o en bullet list inmediata (formato multi-línea)
    const hasSameLine  = /\*\*Herramienta de aprendizaje:\*\*[ \t]+\S/i.test(content);
    const hasMultiLine = /\*\*Herramienta de aprendizaje:\*\*[ \t]*\r?\n[ \t]*[-*•][ \t]+\S/i.test(content);
    if (hasSameLine || hasMultiLine) sources.push({ type: "syllabus_sources", path: readmePath });
  }

  return sources;
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Evalúa si existe evidencia suficiente para generar una sección de guía.
 *
 * @param {object} options
 * @param {string}  options.courseRoot       Ruta absoluta del curso
 * @param {number}  options.weekNumber       Número de semana (1-52)
 * @param {object}  [options.notebookLM]     Estado de NotebookLM:
 *                    { configured, available, reason }
 * @param {boolean} [options.allowGeneric]   Si true, genera JIN-EVD-002 en lugar
 *                                           de bloquear (para registrar el intento)
 * @returns {{ allowed: boolean, provenance: string, code?: string, message?: string,
 *             detail?: string, warning?: string, sources: object[] }}
 */
function check({ courseRoot, weekNumber, notebookLM = {} }) {
  if (!courseRoot) throw new TypeError("Se requiere courseRoot.");
  if (!weekNumber) throw new TypeError("Se requiere weekNumber.");

  const nlmConfigured = Boolean(notebookLM.configured);
  const nlmAvailable  = Boolean(notebookLM.available);
  const attempts       = Array.isArray(notebookLM.attempts) ? notebookLM.attempts : null;

  // notebookResolution (opcional): solo se adjunta si quien llama declaró
  // attempts — hace auditable POR QUÉ se activó el fallback, en vez de
  // asumir que la política de 3 intentos se siguió.
  const notebookResolution = attempts ? {
    status:         nlmAvailable ? "available" : "unavailable",
    attempts,
    fallbackReason: notebookLM.fallbackReason || null,
  } : null;

  const localSources = checkLocalSources(courseRoot, weekNumber);

  // NotebookLM disponible → siempre permitir (la comprobación de autenticación
  // es responsabilidad del flujo de trabajo, no de esta compuerta)
  if (nlmConfigured && nlmAvailable) {
    return { allowed: true, provenance: "notebook-primary", sources: [{ type: "notebooklm" }, ...localSources], notebookResolution };
  }

  // NotebookLM falló tras sus 3 intentos + sin fuentes locales → continuar con
  // ai-fallback, advertido mediante JIN-EVD-003 (ya no bloquea la generación).
  if (nlmConfigured && !nlmAvailable && localSources.length === 0) {
    return { allowed: true, provenance: "ai-fallback", ...ERRORS.JIN_EVD_003, sources: [], notebookResolution };
  }

  // Sin NotebookLM configurado y sin fuentes locales → continuar con
  // ai-fallback, advertido mediante JIN-EVD-001 (ya no bloquea la generación).
  if (!nlmConfigured && localSources.length === 0) {
    return { allowed: true, provenance: "ai-fallback", ...ERRORS.JIN_EVD_001, sources: [], notebookResolution };
  }

  // Fuentes locales disponibles (con o sin NotebookLM) → permitir con procedencia local-fallback.
  // Si NotebookLM estaba configurado pero se saltó a local sin declarar (o
  // sin agotar) los 3 intentos, JIN-EVD-028 lo deja advertido: no basta con
  // decir "no disponible", debe quedar demostrado.
  const attemptsExhausted = Boolean(attempts && attempts.length >= 3);
  if (nlmConfigured && !attemptsExhausted) {
    return {
      allowed: true, provenance: "local-fallback", sources: localSources,
      ...ERRORS.JIN_EVD_028, notebookResolution,
    };
  }
  return {
    allowed: true,
    provenance: "local-fallback",
    sources: localSources,
    warning: nlmConfigured ? "NotebookLM no disponible; se usarán fuentes locales." : undefined,
    notebookResolution,
  };
}

/**
 * Registra un intento de presentar conocimiento genérico como evidencia
 * verificada sin declarar procedencia 'ai-fallback'. Siempre devuelve
 * allowed: false con JIN-EVD-002. A diferencia del fallback de check(), esto
 * bloquea porque oculta la procedencia en vez de declararla.
 *
 * Llamar esto cuando el agente detecte que está a punto de afirmar algo
 * disciplinar sin respaldo verificable y sin marcarlo como 'ai-fallback'.
 */
function blockGenericKnowledge() {
  return { allowed: false, provenance: "ai-fallback", ...ERRORS.JIN_EVD_002, sources: [] };
}

/**
 * Serializa el resultado de la compuerta en formato de reporte CLI.
 */
function toReport(result) {
  return {
    allowed:    result.allowed,
    provenance: result.provenance || null,
    code:       result.code || null,
    message:    result.message || null,
    detail:     result.detail || null,
    warning:    result.warning || null,
    sources:    result.sources || [],
  };
}

module.exports = { check, blockGenericKnowledge, toReport, ERRORS };
