"use strict";

/**
 * progress-events.js — Eventos de progreso deterministas: stderr + journal.
 *
 * `jintia ready` y `jintia plan approve` ya calculan internamente una
 * secuencia de pasos con nombre (ver ready.js/plan-state.js). Cada
 * transición de paso se reporta por DOS vías independientes:
 *
 * 1. Una línea `##JINTIA-EVENT##{...}` a **stderr** (nunca stdout, para no
 *    alterar el contrato `--json`). Sirve como respaldo/diagnóstico: un
 *    observador que solo ve la salida final del proceso (ej. OpenCode, que
 *    no entrega la salida de una tool de shell hasta que cierra —
 *    confirmado empíricamente contra un servidor real, no es una
 *    suposición) igual puede reconstruir la secuencia completa al final,
 *    aunque no en vivo.
 * 2. Si hay un journal activo (`initProgressJournal()`), además una línea
 *    JSONL en `<courseRoot>/.jintia/runtime/progress/<runId>.jsonl`,
 *    escrita sincrónicamente con `fs.appendFileSync`. Este es el canal
 *    pensado para progreso REALMENTE en vivo: un observador externo que
 *    vigile ese archivo por cambios (ej. un file watcher nativo, no
 *    polling) se entera segundo a segundo, sin depender de nada que pase
 *    por un agente LLM ni por su protocolo de tool calls.
 */

const fs   = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const SENTINEL = "##JINTIA-EVENT##";
const JOURNAL_SCHEMA_VERSION = 1;

let _journal = null; // { dir, file, runId, seq }

/**
 * Activa el journal de esta invocación de proceso. Idempotente respecto a
 * `endProgressJournal()`: si ya hay un journal activo, se reemplaza (no se
 * anidan — cada comando de nivel superior corre un solo journal a la vez).
 * @param {string} courseRoot - Raíz del curso (contenedor de `semanas/`).
 * @returns {string} runId generado para este journal.
 */
function initProgressJournal(courseRoot) {
  const runId = crypto.randomUUID();
  const dir   = path.join(courseRoot, ".jintia", "runtime", "progress");
  fs.mkdirSync(dir, { recursive: true });
  _journal = { dir, file: path.join(dir, `${runId}.jsonl`), runId, seq: 0 };
  return runId;
}

/** Desactiva el journal actual (si hay uno). Llamar siempre en un `finally`
 * al terminar el comando que lo activó — el archivo en sí no se borra (es
 * responsabilidad del observador/limpieza periódica del lado de Desktop). */
function endProgressJournal() {
  _journal = null;
}

/**
 * @param {{ command: string, step: string, status: string, detail?: string }} event
 */
function emitProgress(event) {
  process.stderr.write(`${SENTINEL}${JSON.stringify({ event: "work.progress", ...event })}\n`);
  if (_journal) {
    _journal.seq += 1;
    const line = {
      schemaVersion: JOURNAL_SCHEMA_VERSION,
      runId: _journal.runId,
      seq: _journal.seq,
      at: new Date().toISOString(),
      event: "work.progress",
      ...event,
    };
    fs.appendFileSync(_journal.file, `${JSON.stringify(line)}\n`);
  }
}

module.exports = { emitProgress, initProgressJournal, endProgressJournal, SENTINEL };
