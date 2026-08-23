"use strict";

/**
 * progress-events.js — Eventos de progreso deterministas hacia stderr.
 *
 * `jintia ready` y `jintia plan approve` ya calculan internamente una
 * secuencia de pasos con nombre (ver ready.js/plan-state.js), pero hoy solo
 * se reportan como un único JSON al final del proceso. Un orquestador
 * externo (ej. Jintia Desktop, observando la salida de la tool de shell que
 * invocó este CLI) no tiene forma de saber en qué paso está mientras el
 * proceso corre.
 *
 * Este módulo imprime una línea por transición de paso a **stderr** (nunca
 * stdout, para no alterar el contrato de `--json` que ya consumen otros
 * procesos) con un sentinel que la distingue de cualquier log humano
 * mezclado en el mismo stream, así un consumidor puede extraer solo estas
 * líneas de un blob de texto mixto sin necesitar un modo "solo NDJSON".
 */

const SENTINEL = "##JINTIA-EVENT##";

/**
 * @param {{ command: string, step: string, status: string, detail?: string }} event
 */
function emitProgress(event) {
  process.stderr.write(`${SENTINEL}${JSON.stringify({ event: "work.progress", ...event })}\n`);
}

module.exports = { emitProgress, SENTINEL };
