"use strict";

// Levenshtein distance for field suggestion
function lev(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}
function suggestField(input, candidates) {
  let best = null, bestDist = Infinity;
  for (const c of candidates) {
    const d = lev(input.toLowerCase(), c.toLowerCase());
    if (d < bestDist && d <= 3) { bestDist = d; best = c; }
  }
  return best;
}

function typeMatches(value, type) {
  if (type === "null")    return value === null;
  if (type === "array")   return Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "object")  return value !== null && typeof value === "object" && !Array.isArray(value);
  return typeof value === type;
}

function resolveRef(ref, root) {
  if (typeof ref !== "string" || !ref.startsWith("#/")) return null;
  const parts = ref.slice(2).split("/");
  let node = root;
  for (const part of parts) {
    if (node == null || typeof node !== "object") return null;
    node = node[decodeURIComponent(part.replace(/~1/g, "/").replace(/~0/g, "~"))];
  }
  return node != null ? node : null;
}

/**
 * Valida `value` contra `schema`.
 * @param {*}      value    - Valor a validar
 * @param {object} schema   - Esquema JSON Schema (Draft-07 subset)
 * @param {string} location - Ruta para mensajes de error (ej. "$.metadata")
 * @param {object} [root]   - Esquema raíz para resolver $ref (se pasa automáticamente)
 * @returns {string[]} Lista de mensajes de error (vacía = válido)
 */
function validate(value, schema, location, root) {
  if (root === undefined) root = schema;
  const errors = [];

  // $ref — intra-schema
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, root);
    if (resolved) errors.push(...validate(value, resolved, location, root));
    return errors;
  }

  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${location}: debe ser ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${location}: valor no permitido (esperado uno de ${JSON.stringify(schema.enum)})`);
  }

  // type
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some(t => typeMatches(value, t))) {
      errors.push(`${location}: tipo esperado ${types.join("|")}`);
      return errors; // no continuar con subvalidaciones si el tipo no coincide
    }
  }

  // string
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${location}: longitud mínima ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${location}: longitud máxima ${schema.maxLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${location}: no cumple el patrón ${schema.pattern}`);
    }
  }

  // number / integer
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${location}: debe ser >= ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${location}: debe ser <= ${schema.maximum}`);
    }
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      errors.push(`${location}: debe ser > ${schema.exclusiveMinimum}`);
    }
  }

  // array
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${location}: mínimo ${schema.minItems} elemento(s) (tiene ${value.length})`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${location}: máximo ${schema.maxItems} elemento(s)`);
    }
    if (schema.items) {
      value.forEach((item, i) => {
        errors.push(...validate(item, schema.items, `${location}[${i}]`, root));
      });
    }
  }

  // object
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const req of (schema.required || [])) {
      if (!(req in value)) errors.push(`${location}.${req}: campo obligatorio`);
    }
    if (schema.additionalProperties === false && schema.properties) {
      // Las claves habilitadas condicionalmente por allOf/if-then (ej. campos
      // específicos de 'practice' o 'figure' en guide.schema.json) también
      // cuentan como permitidas: additionalProperties solo mira su propio
      // `properties`, así que sin esto, cualquier allOf.then.properties
      // rompería additionalProperties:false para los tipos que lo usan.
      const allowedKeys = new Set(Object.keys(schema.properties));
      if (Array.isArray(schema.allOf)) {
        for (const sub of schema.allOf) {
          for (const branch of [sub, sub.then, sub.else]) {
            if (branch && branch.properties) {
              for (const k of Object.keys(branch.properties)) allowedKeys.add(k);
            }
          }
        }
      }
      for (const key of Object.keys(value)) {
        if (!allowedKeys.has(key)) {
          const hint = suggestField(key, [...allowedKeys]);
          const extra = hint ? `; did you mean "${hint}"?` : "";
          // Map Spanish field aliases to canonical English for better diagnostics
          const aliasMap = {
            asignatura: 'course',
            semana: 'week',
            titulo: typeof location === "string" && location.endsWith('.metadata') ? 'topic' : 'title',
            contenido: 'content',
            horas: 'hours',
            unidad: 'unit',
            periodoAcademicoOrdinar: 'period',
            periodoAcademico: 'period',
            referencias: 'bibliography',
            bibliografia: 'bibliography',
          };
          const aliasHint = aliasMap[key] ? ` (alias ES → "${aliasMap[key]}")` : "";
          errors.push(`${location}.${key}: propiedad no permitida${aliasHint}${extra}`);
        }
      }
    }
    for (const [key, child] of Object.entries(schema.properties || {})) {
      if (key in value) {
        errors.push(...validate(value[key], child, `${location}.${key}`, root));
      }
    }
  }

  // allOf
  if (Array.isArray(schema.allOf)) {
    for (const sub of schema.allOf) {
      errors.push(...validate(value, sub, location, root));
    }
  }

  // oneOf
  if (Array.isArray(schema.oneOf)) {
    const passing = schema.oneOf.filter(sub => validate(value, sub, location, root).length === 0);
    if (passing.length !== 1) {
      errors.push(`${location}: debe cumplir exactamente una alternativa oneOf (cumple ${passing.length})`);
    }
  }

  // anyOf
  if (Array.isArray(schema.anyOf)) {
    const passing = schema.anyOf.filter(sub => validate(value, sub, location, root).length === 0);
    if (passing.length === 0) {
      errors.push(`${location}: debe cumplir al menos una alternativa anyOf`);
    }
  }

  // if / then / else
  if (schema.if) {
    const condErrors = validate(value, schema.if, location, root);
    if (condErrors.length === 0 && schema.then) {
      errors.push(...validate(value, schema.then, location, root));
    } else if (condErrors.length > 0 && schema.else) {
      errors.push(...validate(value, schema.else, location, root));
    }
  }

  return errors;
}

module.exports = { validate, resolveRef };
