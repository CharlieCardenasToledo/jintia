"use strict";

/**
 * plan-state.js — Estado persistente del plan semanal
 *
 * Persiste .jintia-plan.json dentro de semanas/semana-XX/ para que la
 * operación guide pueda verificar que el plan fue aprobado antes de
 * generar cualquier archivo.
 *
 * Estados del plan:
 *   pending    Plan calculado, pendiente de aprobación del usuario
 *   blocked    Contrato curricular irresoluble (semana/RA inexistente,
 *              sílabo inconsistente — verificado en approvePlan()). NUNCA
 *              por ausencia de fuentes externas: evidence-gate.js garantiza
 *              que siempre hay un fallback (ai-fallback como último
 *              recurso), así que la falta de evidencia verificada no bloquea
 *              el plan por sí sola — solo se registra para trazabilidad.
 *   approved   El usuario aprobó explícitamente el plan
 *   generated  guide.json fue creado con éxito
 */

const fs     = require("node:fs");
const path   = require("node:path");
const crypto = require("node:crypto");

function hashContent(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex").slice(0, 16);
}

const PLAN_FILE = ".jintia-plan.json";

const VALID_STATUSES = ["pending", "blocked", "approved", "generated"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function weekPadded(weekNumber) {
  const n = Number(weekNumber);
  if (!Number.isInteger(n) || n < 1 || n > 52) {
    throw new RangeError(`Número de semana inválido: ${weekNumber}. Debe ser un entero entre 1 y 52.`);
  }
  return String(n).padStart(2, "0");
}

function planPath(courseRoot, weekNumber) {
  return path.join(
    path.resolve(courseRoot),
    "semanas",
    `semana-${weekPadded(weekNumber)}`,
    PLAN_FILE
  );
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Guarda un plan en estado pending. Ya no bloquea por falta de fuentes
 * verificadas: ai-fallback (evidence-gate.js) garantiza que siempre hay un
 * camino hacia adelante. missingEvidence se conserva para trazabilidad.
 *
 * @param {string} courseRoot  Ruta absoluta del curso
 * @param {number} weekNumber  Número de semana
 * @param {object} planData    Datos del plan (topic, outcomes, evidence, etc.)
 * @returns {string}           Ruta del archivo guardado
 */
function savePlan(courseRoot, weekNumber, planData) {
  const file = planPath(courseRoot, weekNumber);
  fs.mkdirSync(path.dirname(file), { recursive: true });

  // topic es obligatorio — no se puede planificar sin tema
  const topic = (planData.topic || "").trim();
  if (!topic) {
    throw new TypeError(
      "El plan debe incluir un campo 'topic' (tema de la semana). " +
      "No se puede guardar un plan sin tema declarado."
    );
  }

  const evidence        = Array.isArray(planData.evidence) ? planData.evidence : [];
  const missingEvidence = planData.missingEvidence || [];
  const provenance       = planData.provenance || null; // "notebook-primary" | "local-fallback" | "ai-fallback"

  // El plan ya NO se bloquea por falta de fuentes externas verificadas:
  // evidence-gate.js garantiza que siempre existe un fallback (ai-fallback
  // como último recurso), así que la ausencia de fuentes se registra en
  // missingEvidence para trazabilidad pero no fuerza "blocked". "blocked"
  // queda reservado para contrato curricular irresoluble, verificado
  // aparte en approvePlan() (semana/RA inexistente, sílabo inconsistente).
  const status = "pending";

  // Hash del sílabo en el momento de guardar el plan
  let syllabusHash = null;
  const readmePath = path.join(path.resolve(courseRoot), "README.md");
  if (fs.existsSync(readmePath)) {
    syllabusHash = hashContent(fs.readFileSync(readmePath, "utf8"));
  }

  const record = {
    schemaVersion:  "1.1",
    course:         planData.course || path.basename(path.resolve(courseRoot)),
    week:           Number(weekNumber),
    topic,
    outcomes:       planData.outcomes || {},
    evidence,
    missingEvidence,
    provenance,
    syllabusHash,
    plannedFiles:   planData.plannedFiles || [
      `semanas/semana-${weekPadded(weekNumber)}/guide.json`,
      `semanas/semana-${weekPadded(weekNumber)}/reference.bib`,
      `semanas/semana-${weekPadded(weekNumber)}/figure/`,
    ],
    status,
    savedAt:        new Date().toISOString(),
    approvedAt:     null,
    generatedAt:    null,
  };

  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  return file;
}

/**
 * Marca el plan como aprobado por el usuario.
 *
 * @param {string} courseRoot  Ruta absoluta del curso
 * @param {number} weekNumber  Número de semana
 * @returns {{ ok: boolean, message: string, path: string }}
 */
function approvePlan(courseRoot, weekNumber) {
  const file = planPath(courseRoot, weekNumber);

  if (!fs.existsSync(file)) {
    return {
      ok:      false,
      message: `No existe un plan para la semana ${weekNumber}. Ejecuta primero 'jintia plan save'.`,
      path:    file,
    };
  }

  const record = JSON.parse(fs.readFileSync(file, "utf8"));

  if (record.status === "blocked") {
    return {
      ok:      false,
      message: `El plan está bloqueado por evidencia faltante: ${(record.missingEvidence || []).join(", ")}. Resuelve las fuentes primero.`,
      path:    file,
    };
  }

  const root = path.resolve(courseRoot);

  // Verificar que el sílabo no cambió desde que se guardó el plan
  if (record.syllabusHash) {
    const readmePath = path.join(root, "README.md");
    if (fs.existsSync(readmePath)) {
      const currentHash = hashContent(fs.readFileSync(readmePath, "utf8"));
      if (currentHash !== record.syllabusHash) {
        return {
          ok:      false,
          message: `El sílabo cambió desde que se guardó el plan (semana ${weekNumber}). Ejecuta 'jintia plan save' de nuevo para actualizar.`,
          path:    file,
        };
      }
    }
  }

  // Verificar que la semana existe y tiene todos los campos requeridos
  const readmePath = path.join(root, "README.md");
  if (fs.existsSync(readmePath)) {
    const { validateWeek } = require("./syllabus-manager");
    const content    = fs.readFileSync(readmePath, "utf8");
    const weekResult = validateWeek(content, weekNumber);
    if (!weekResult.found) {
      return {
        ok:      false,
        message: `La semana ${weekNumber} no existe en el sílabo. Edita el README.md antes de aprobar.`,
        path:    file,
      };
    }
    if (!weekResult.valid) {
      return {
        ok:      false,
        message: `La semana ${weekNumber} tiene campos incompletos: ${weekResult.errors.join("; ")}`,
        path:    file,
      };
    }
  }

  // Re-verificar compuerta de evidencia (fuentes locales, sin notebookLM por defecto)
  const evidenceGate = require("./evidence-gate");
  const evResult     = evidenceGate.check({ courseRoot: root, weekNumber: Number(weekNumber) });
  if (!evResult.allowed) {
    return {
      ok:      false,
      message: `La compuerta de evidencia bloqueó la aprobación: ${evResult.code} — ${evResult.message}`,
      path:    file,
    };
  }

  record.status     = "approved";
  record.approvedAt = new Date().toISOString();
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);

  return { ok: true, message: `Plan de la semana ${weekNumber} aprobado.`, path: file };
}

/**
 * Comprueba si el plan de la semana está en estado approved.
 * La operación guide DEBE llamar esto antes de crear guide.json.
 *
 * @param {string} courseRoot  Ruta absoluta del curso
 * @param {number} weekNumber  Número de semana
 * @returns {{ approved: boolean, status: string|null, message: string }}
 */
function checkPlanApproved(courseRoot, weekNumber) {
  const file = planPath(courseRoot, weekNumber);

  if (!fs.existsSync(file)) {
    return {
      approved: false,
      status:   null,
      message:  `No existe plan para la semana ${weekNumber}. Ejecuta '/jintia plan' primero y obtén aprobación explícita del usuario.`,
    };
  }

  const record = JSON.parse(fs.readFileSync(file, "utf8"));

  if (record.status === "approved" || record.status === "generated") {
    return { approved: true, status: record.status, message: "Plan aprobado. Puedes generar guide.json." };
  }

  if (record.status === "blocked") {
    return {
      approved: false,
      status:   "blocked",
      message:  `El plan está bloqueado. Evidencia faltante: ${(record.missingEvidence || []).join(", ")}`,
    };
  }

  return {
    approved: false,
    status:   record.status,
    message:  `El plan existe pero aún no fue aprobado (estado: ${record.status}). Muestra el plan al usuario y espera confirmación explícita.`,
  };
}

/**
 * Marca el plan como generated después de crear guide.json.
 *
 * @param {string} courseRoot  Ruta absoluta del curso
 * @param {number} weekNumber  Número de semana
 * @returns {string}           Ruta del archivo actualizado
 */
function markGenerated(courseRoot, weekNumber) {
  const file = planPath(courseRoot, weekNumber);
  if (!fs.existsSync(file)) return file;

  const record = JSON.parse(fs.readFileSync(file, "utf8"));
  record.status      = "generated";
  record.generatedAt = new Date().toISOString();
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  return file;
}

/**
 * Lee el estado actual del plan de una semana.
 *
 * @param {string} courseRoot  Ruta absoluta del curso
 * @param {number} weekNumber  Número de semana
 * @returns {object|null}      Registro del plan o null si no existe
 */
function getPlan(courseRoot, weekNumber) {
  const file = planPath(courseRoot, weekNumber);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

module.exports = {
  PLAN_FILE,
  VALID_STATUSES,
  savePlan,
  approvePlan,
  checkPlanApproved,
  markGenerated,
  getPlan,
  planPath,
};
