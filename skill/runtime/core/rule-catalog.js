"use strict";

/**
 * rule-catalog.js — Punto de acceso único a rules/catalog.json
 *
 * catalog.json es la única fuente de verdad para severity/category/
 * description de cada código JIN-*. content-linter.js consulta este módulo
 * en vez de mantener una copia local de severidades; rules-runner.js ya
 * carga catalog.json directamente. Esto evita el drift entre el catálogo
 * documentado y el comportamiento real de los validadores.
 */

const fs   = require("node:fs");
const path = require("node:path");

const CATALOG_PATH = path.join(__dirname, "..", "..", "rules", "catalog.json");

let cache = null;

/**
 * Carga (con caché) rules/catalog.json.
 * @returns {{ version: string, rules: object[], byId: Map<string, object> }}
 */
function loadCatalog() {
  if (cache) return cache;
  const data = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  const byId = new Map(data.rules.map(rule => [rule.id, rule]));
  cache = { version: data.version, rules: data.rules, byId };
  return cache;
}

/**
 * Devuelve la entrada del catálogo para un código JIN-*, o null si no existe.
 * @param {string} ruleId
 * @returns {{ id: string, category: string, severity: string, description: string }|null}
 */
function getRule(ruleId) {
  return loadCatalog().byId.get(ruleId) || null;
}

/** Solo para tests: fuerza una relectura de catalog.json en la próxima llamada. */
function clearCache() {
  cache = null;
}

module.exports = { loadCatalog, getRule, clearCache, CATALOG_PATH };
