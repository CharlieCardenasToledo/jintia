"use strict";

/**
 * pedagogical-roles.js — Ancla determinista para un vocabulario de `type` abierto.
 *
 * guide.schema.json ya no restringe `type` a un enum cerrado: la IA puede
 * escribir cualquier etiqueta ("debate", "timeline", "decision-tree"...) sin
 * disfrazarla de un tipo clásico. Pero las reglas JIN-ALN, JIN-SELF y JIN-WRK
 * (¿tiene este target enseñanza + práctica + evaluación?) necesitan ANCLARSE en algo
 * determinista — no pueden preguntarle a un string arbitrario "¿eres
 * enseñanza?". Ese ancla es `role`: un enum pequeño y cerrado, independiente
 * de `type`, que declara la FUNCIÓN pedagógica del nodo sin imponer su forma
 * ni su etiqueta visual.
 *
 * - Si el autor declara `role` explícitamente, se usa tal cual.
 * - Si no, se infiere de `type` cuando coincide con uno de los nombres
 *   clásicos (compatibilidad total con guías existentes).
 * - Si `type` es personalizado y no hay `role`, el nodo cae en "supplement":
 *   sigue renderizando y sigue contando para las reglas globales (tiempos,
 *   IDs únicos), pero no participa en las reglas de familia pedagógica hasta
 *   que el autor declare explícitamente qué rol cumple.
 *
 * Esto es lo que hace posible que "case"/"comparison" (teaching) o
 * "activity"/"reflection" (practice) NO necesiten estar hardcodeados por
 * nombre en content-linter.js: son simplemente las entradas legadas de este
 * mapa. Un tipo nuevo como "debate" con `"role":"practice"` obtiene
 * exactamente las mismas verificaciones que "practice" mismo.
 */

const ROLES = new Set(["orientation", "teaching", "practice", "assessment", "supplement"]);

const LEGACY_TYPE_ROLES = {
  orientation: "orientation",
  opening: "orientation",
  theory: "teaching",
  concept: "teaching",
  case: "teaching",
  comparison: "teaching",
  practice: "practice",
  activity: "practice",
  scenario: "practice",
  reflection: "practice",
  assessment: "assessment",
  warning: "supplement",
  "critical-error": "supplement",
  figure: "supplement",
  table: "supplement",
  "margin-note": "supplement",
  bibliography: "supplement",
  citation: "supplement",
};

/** Alias de `type` reconocidos en `children` para detectar una capacidad
 * pedagógica (ej. "¿hay un ejemplo trabajado?") sin exigir el campo plano
 * literal. Vocabulario abierto también aquí: un `children[].type` que no
 * aparezca en estos conjuntos simplemente no se cuenta para esa capacidad
 * (pero se renderiza igual, ver guide-renderer.js). */
const CHILD_CAPABILITY_ALIASES = {
  purpose:         new Set(["purpose", "proposito", "propósito"]),
  materials:       new Set(["materials", "material", "materiales"]),
  route:           new Set(["route", "ruta"]),
  successCriteria: new Set(["success-criteria", "successcriteria", "criterio", "criterios", "criterion"]),
  workedExample:   new Set(["example", "worked-example", "workedexample", "model", "modelo", "ejemplo"]),
  prompt:          new Set(["prompt", "consigna", "question", "pregunta"]),
  selfCheck:       new Set(["self-check", "selfcheck", "autocorreccion", "autocorrección", "autochequeo"]),
  feedback:        new Set(["feedback", "retroalimentacion", "retroalimentación"]),
  remediation:     new Set(["remediation", "remediacion", "remediación"]),
  transfer:        new Set(["transfer", "transferencia"]),
};

function hasContent(value) {
  return value !== undefined && value !== null && value !== "" &&
    !(Array.isArray(value) && value.length === 0);
}

/** Rol pedagógico efectivo de una sección: explícito, heredado del type
 * clásico, o "supplement" si es un type personalizado sin role declarado. */
function resolveRole(section) {
  if (!section) return "supplement";
  if (typeof section.role === "string" && ROLES.has(section.role)) return section.role;
  if (Object.prototype.hasOwnProperty.call(LEGACY_TYPE_ROLES, section.type)) {
    return LEGACY_TYPE_ROLES[section.type];
  }
  return "supplement";
}

function hasRole(section, role) {
  return resolveRole(section) === role;
}

/** true si el rol es determinable (role explícito válido, o type clásico
 * reconocido) — false si es un type personalizado sin role, es decir, el
 * caso que dispara el aviso JIN-CNT-006. */
function hasExplicitRoleAnchor(section) {
  if (!section) return false;
  if (typeof section.role === "string" && ROLES.has(section.role)) return true;
  return Object.prototype.hasOwnProperty.call(LEGACY_TYPE_ROLES, section.type);
}

function childrenWithCapability(section, capability) {
  if (!section || !Array.isArray(section.children)) return [];
  const aliases = CHILD_CAPABILITY_ALIASES[capability];
  if (!aliases) return [];
  return section.children.filter(c => c && typeof c.type === "string" && aliases.has(c.type.toLowerCase()));
}

/** ¿Esta sección satisface la capacidad pedagógica `capability`? Comprueba
 * el campo plano clásico (ej. `workedExample`) O la presencia de al menos
 * una pieza en `children` cuyo type sea un alias reconocido de esa
 * capacidad (ej. un hijo `{"type":"example", ...}`). Ambas rutas son
 * equivalentes: una guía puede usar la que le convenga, o ambas. */
function hasCapability(section, flatField, capability) {
  if (!section) return false;
  if (hasContent(section[flatField])) return true;
  return childrenWithCapability(section, capability)
    .some(c => hasContent(c.content) || hasContent(c.title));
}

/** Todas las fuentes de contenido textual de una sección: su `content` propio
 * más el de cada pieza en `children` (recursivo). Usado por reglas que miden
 * volumen de contenido o buscan citas — una sección compuesta enteramente
 * vía `children` debe contar igual que una con `content` plano. */
function flattenContentSources(section) {
  if (!section) return [];
  const own = section.content !== undefined ? [section.content] : [];
  const fromChildren = Array.isArray(section.children)
    ? section.children.flatMap(c => flattenContentSources(c))
    : [];
  return [...own, ...fromChildren];
}

module.exports = {
  ROLES,
  LEGACY_TYPE_ROLES,
  resolveRole,
  hasRole,
  hasExplicitRoleAnchor,
  hasCapability,
  flattenContentSources,
  hasContent,
};
