#!/usr/bin/env node
"use strict";

/**
 * guide-renderer.js — Motor de renderizado HTML de Jintia
 *
 * Convierte guide.json (AST neutral) en HTML semántico listo para
 * Vivliostyle o para vista previa en navegador.
 *
 * Al escribir a un archivo, copia automáticamente el CSS del tema activo
 * (y de los temas padre declarados en meta.json["extends"]) a
 * `.jintia-assets/themes/` junto al HTML, garantizando que todos los
 * `@import` resuelvan correctamente.
 *
 * Uso CLI:
 *   node scripts/guide-renderer.js guide.json [--theme jintia-clasico] [--output guide.html]
 *   (sin --output, genera guide.html al lado del guide.json)
 *
 * Uso programático:
 *   const { renderGuide } = require("./guide-renderer");
 *   const html = renderGuide("guide.json", { outputPath: "semana-01/guide.html" });
 */

const fs     = require("node:fs");
const path   = require("node:path");
const bibMgr  = require("./bibliography-manager");
const { collectCitationKeys } = require("./citation-keys");

const ROOT       = path.resolve(__dirname, "..");
const THEMES_DIR = path.join(ROOT, "themes");
const BRAND_LOGO_PATH = path.join(ROOT, "assets", "brand", "jintia-logo.svg");

// ─── Utilidades ──────────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Procesa marcado inline controlado dentro de texto plano.
 *
 * Sintaxis soportada:
 *   {{keyterm:término}}          → <span class="jintia-keyterm">término</span>
 *   {{cite:clave}}               → cita parentética  (Apellido, año)
 *   {{cite:clave|narrative}}     → cita narrativa    Apellido (año)
 *
 * El resto del texto se escapa con escapeHtml() para prevenir XSS.
 * Las citas requieren contexto bibliográfico (bib); sin él se muestran como [clave].
 */
function processInlineMarkup(text, bib = null, style = "apa") {
  if (typeof text !== "string") return "";
  const parts   = [];
  const pattern = /\{\{(keyterm|cite):([^|}]+)(?:\|([^}]+))?\}\}/g;
  let last = 0;
  let m;
  while ((m = pattern.exec(text)) !== null) {
    parts.push(escapeHtml(text.slice(last, m.index)));
    const [, tag, value, modifier] = m;
    if (tag === "keyterm") {
      parts.push(`<span class="jintia-keyterm">${escapeHtml(value)}</span>`);
    } else {
      // cite: value=clave, modifier=mode (parenthetical|narrative)
      const mode = modifier === "narrative" ? "narrative" : "parenthetical";
      const ctx  = bib || { available: false };
      parts.push(bibMgr.renderCitation([value.trim()], mode, ctx, style));
    }
    last = m.index + m[0].length;
  }
  parts.push(escapeHtml(text.slice(last)));
  return parts.join("");
}

// Detecta si un valor de content/steps/etc. YA es HTML (el agente puede
// escribirlo directamente en vez de texto plano con {{cite:}}/{{keyterm:}}).
// Exige que el string EMPIECE con una etiqueta reconocida para no disparar
// en falso con texto legítimo como "< 5 minutos" — "<p>La semana..." sí
// cuenta, "< 5 minutos" no (falta el nombre de etiqueta pegado al "<").
const HTML_TAG_START = /^\s*<(p|ul|ol|li|div|table|thead|tbody|tr|td|th|blockquote|h[1-6]|figure|strong|em|b|i|span|a|code|pre)[\s>/]/i;

function looksLikeHtml(text) {
  return typeof text === "string" && HTML_TAG_START.test(text);
}

// Sanitización mínima para HTML que el agente escribió directamente (en vez
// de texto plano): ese HTML se inserta sin escapar en el documento que
// Vivliostyle compila con un Chromium headless — un <script>/manejador de
// evento ahí es ejecución real durante el render, no solo cosmética. No es
// un sanitizador completo (no hay parser HTML en las dependencias de este
// paquete): cubre el vector real (ejecución de script), no cada variante
// teórica de HTML inválido.
function sanitizeInlineHtml(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<(iframe|object|embed)\b[\s\S]*?(?:\/>|<\/\1\s*>)/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|"data:(?!image\/)[^"]*"|'data:(?!image\/)[^']*')/gi, "");
}

/** Convierte texto plano (con saltos de línea) en párrafos HTML. Si el
 * valor ya es HTML de bloque, se inserta tal cual (sanitizado) en vez de
 * escaparlo y volver a envolverlo en <p> — evita el <p>&lt;p&gt;...&lt;/p&gt;</p>
 * que resulta de tratar HTML ya válido como texto plano. Como contrapartida,
 * {{cite:}}/{{keyterm:}} no se procesan dentro de HTML ya escrito por el
 * agente: para citas inline, usar texto plano con esa sintaxis. */
function textToHtml(text, bib = null, style = "apa") {
  if (typeof text !== "string") return "";
  if (looksLikeHtml(text)) return sanitizeInlineHtml(text.trim());
  return text
    .split(/\n{2,}/)
    .filter(Boolean)
    .map(para => `<p>${processInlineMarkup(para.trim(), bib, style)}</p>`)
    .join("\n");
}

/** Renderiza el campo `content` de un nodo: puede ser string, array o null. */
function renderContent(content, bib = null, style = "apa") {
  if (!content) return "";
  if (typeof content === "string") return textToHtml(content, bib, style);
  if (Array.isArray(content)) return content.map(c => renderContent(c, bib, style)).join("\n");
  return escapeHtml(String(content));
}

// ─── Herencia y copia de assets del tema ─────────────────────────────────────

/**
 * Resuelve la cadena de dependencias de un tema usando el campo `extends`
 * de cada meta.json. Devuelve los IDs de tema en orden padre→hijo.
 *
 * Ejemplo: resolveThemeDeps("jintia-tecnico")
 *   → ["jintia-clasico", "jintia-tecnico"]
 */
function resolveThemeDeps(themeId, visited = new Set()) {
  if (visited.has(themeId)) return [];
  visited.add(themeId);
  const result   = [];
  const metaPath = path.join(THEMES_DIR, themeId, "meta.json");
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      if (meta.extends) {
        const parentMeta = path.resolve(path.join(THEMES_DIR, themeId), meta.extends);
        const parentId   = path.basename(path.dirname(parentMeta));
        result.push(...resolveThemeDeps(parentId, visited));
      }
    } catch { /* meta.json malformado: continuar sin herencia */ }
  }
  result.push(themeId);
  return result;
}

/**
 * Copia los archivos CSS del tema activo y de todos sus temas padre a
 * `.jintia-assets/themes/` junto al HTML de salida.
 *
 * @param {string} themeId        - ID del tema seleccionado
 * @param {string} outputHtmlPath - Ruta absoluta al HTML de salida
 * @returns {string} href relativo del CSS principal (barras forward)
 */
function copyThemeAssets(themeId, outputHtmlPath) {
  const deps      = resolveThemeDeps(themeId);
  const outputDir = path.dirname(path.resolve(outputHtmlPath));

  for (const id of deps) {
    const themeDir = path.join(THEMES_DIR, id);
    if (!fs.existsSync(themeDir)) continue;
    const assetsDir = path.join(outputDir, ".jintia-assets", "themes", id);
    fs.mkdirSync(assetsDir, { recursive: true });
    for (const file of fs.readdirSync(themeDir)) {
      if (file.endsWith(".css")) {
        fs.copyFileSync(path.join(themeDir, file), path.join(assetsDir, file));
      }
    }
  }

  return `.jintia-assets/themes/${themeId}/theme.css`;
}

// ─── Renders por tipo de nodo ────────────────────────────────────────────────

function renderCover(metadata) {
  const week       = metadata.week ? `Semana ${metadata.week}` : "";
  const weekNumber = metadata.week ? String(metadata.week).padStart(2, "0") : "";
  const authors    = (metadata.authors || []).map(escapeHtml).join(" · ");
  const hours      = Number.isFinite(metadata.hours)
    ? `${metadata.hours} ${metadata.hours === 1 ? "hora" : "horas"}`
    : "";

  const footerParts = [
    authors ? `<p class="jintia-cover__authors">${authors}</p>` : "",
    metadata.period ? `<p class="jintia-cover__period">${escapeHtml(metadata.period)}</p>` : "",
    `<p class="jintia-cover__format">Jintia Clásico</p>`,
  ].filter(Boolean).join("\n  ");

  return `
<header class="jintia-cover" data-pagination="page-contained" role="banner">
  <div class="jintia-cover__masthead">
    <span class="jintia-cover__brand" aria-hidden="true">${brandLogoSvg() || "jintia"}</span>
    <span>
      ${metadata.code ? `<span class="jintia-cover__code">${escapeHtml(metadata.code)}</span>` : ""}
      <span class="jintia-cover__masthead-label">Guía semanal</span>
    </span>
  </div>
  <div class="jintia-cover__main">
    ${metadata.unit ? `<p class="jintia-cover__unit">${escapeHtml(metadata.unit)}</p>` : ""}
    ${weekNumber ? `<p class="jintia-cover__week-number" aria-hidden="true">${escapeHtml(weekNumber)}</p>` : ""}
    <h1 class="jintia-cover__title">${escapeHtml(metadata.topic || "")}</h1>
    <p class="jintia-cover__course">${escapeHtml(metadata.course || "")}</p>
    ${week ? `<p class="jintia-cover__week">${escapeHtml(week)}</p>` : ""}
    ${hours ? `<p class="jintia-cover__hours">${escapeHtml(hours)} de trabajo académico</p>` : ""}
    ${metadata.outcome
      ? `<div class="jintia-cover__outcome">
      <span class="jintia-cover__outcome-label">Resultado de aprendizaje</span>
      <p>${escapeHtml(metadata.outcome)}</p>
    </div>`
      : ""}
  </div>
  <div class="jintia-cover__footer">
  ${footerParts}
  </div>
</header>`;
}

/**
 * @param {string} [tag="aside"] - "aside" para advertencias/notas complementarias;
 *   "section" para contenido pedagógico principal (teoría, concepto, práctica).
 *   Ambos comparten las mismas clases CSS — el tag no afecta el estilo visual.
 */
function renderBlock(node, typeClass, label, bib = null, style = "apa", tag = "aside") {
  const pagination = node.pagination || "atomic";
  const titleHtml  = node.title
    ? `<h2 class="jintia-block__title">${escapeHtml(node.title)}</h2>`
    : "";
  const idAttr    = node.id ? ` id="${escapeHtml(node.id)}"` : "";
  const roleAttr  = tag === "aside" ? ` role="note"` : "";
  const timeHtml  = typeof node.estimatedMinutes === "number"
    ? `<p class="jintia-block__estimated-minutes">Tiempo estimado: ${escapeHtml(String(node.estimatedMinutes))} min</p>`
    : "";
  return `
<${tag} class="jintia-block ${typeClass}"
       data-pagination="${escapeHtml(pagination)}"${roleAttr}${idAttr}>
  <span class="jintia-block__label" aria-hidden="true">${escapeHtml(label)}</span>
  ${titleHtml}
  ${timeHtml}
  <div class="jintia-block__content">
${renderContent(node.content, bib, style)}
  </div>
</${tag}>`;
}

/**
 * Orientation: además del content libre, renderiza los campos estructurados
 * opcionales (purpose, priorKnowledge, materials, route, successCriteria).
 */
function renderOrientation(node, bib, style) {
  const base = renderBlock(node, "jintia-orientation", "Orientación", bib, style);

  const listBlock = (className, heading, value) => {
    if (!Array.isArray(value) || value.length === 0) return "";
    const items = value.map(item => `<li>${processInlineMarkup(String(item), bib, style)}</li>`).join("\n");
    return `<div class="${className}"><h3>${escapeHtml(heading)}</h3><ul>${items}</ul></div>`;
  };

  const extraHtml = [
    node.purpose ? `<div class="jintia-orientation__purpose">${renderContent(node.purpose, bib, style)}</div>` : "",
    listBlock("jintia-orientation__before-start", "Antes de empezar", [...(node.priorKnowledge || []), ...(node.materials || [])]),
    listBlock("jintia-orientation__route", "Ruta de esta semana", node.route),
    listBlock("jintia-orientation__success-criteria", "Criterios de éxito", node.successCriteria),
  ].filter(Boolean).join("\n  ");

  if (!extraHtml) return base;
  return base.replace(/<\/aside>$/, `  ${extraHtml}\n</aside>`);
}
function renderTheory(node, bib, style)         { return renderBlock(node, "jintia-theory",         "Teoría",       bib, style, "section"); }
function renderConcept(node, bib, style)        { return renderBlock(node, "jintia-concept",        "Concepto",     bib, style, "section"); }

const PRACTICE_MODE_LABELS = {
  guided:      "Práctica guiada",
  retrieval:   "Recuperación",
  independent: "Práctica autónoma",
  transfer:    "Transferencia",
};

/**
 * Practice: además del content libre, renderiza los campos estructurados
 * opcionales de guide.schema.json (workedExample, prompt, steps, hints,
 * successCriteria, selfCheck, feedback, remediation, transfer). La etiqueta
 * del bloque depende de `mode`. Reutiliza las mismas clases y jerarquía de
 * encabezado que el resto de bloques — no introduce CSS nueva.
 */
function renderPractice(node, bib, style) {
  const mode       = node.mode || "guided";
  const label      = PRACTICE_MODE_LABELS[mode] || PRACTICE_MODE_LABELS.guided;
  const pagination = node.pagination || "atomic";
  const idAttr     = node.id ? ` id="${escapeHtml(node.id)}"` : "";
  const titleHtml  = node.title ? `<h2 class="jintia-block__title">${escapeHtml(node.title)}</h2>` : "";
  const timeHtml   = typeof node.estimatedMinutes === "number"
    ? `<p class="jintia-block__estimated-minutes">Tiempo estimado: ${escapeHtml(String(node.estimatedMinutes))} min</p>`
    : "";

  const extraBlock = (className, heading, value, asList = false) => {
    if (asList) {
      if (!Array.isArray(value) || value.length === 0) return "";
      const items = value
        .map(item => `<li>${looksLikeHtml(String(item)) ? sanitizeInlineHtml(String(item).trim()) : processInlineMarkup(String(item), bib, style)}</li>`)
        .join("\n");
      return `<div class="${className}"><h3>${escapeHtml(heading)}</h3><ul>${items}</ul></div>`;
    }
    if (!value) return "";
    return `<div class="${className}"><h3>${escapeHtml(heading)}</h3>${renderContent(value, bib, style)}</div>`;
  };

  const extraHtml = [
    extraBlock("jintia-practice__worked-example", "Ejemplo trabajado", node.workedExample),
    extraBlock("jintia-practice__prompt", "Ahora inténtalo tú", node.prompt),
    extraBlock("jintia-practice__steps", "Pasos", node.steps, true),
    extraBlock("jintia-practice__hints", "Pistas", node.hints, true),
    extraBlock("jintia-practice__success-criteria", "Criterios de éxito", node.successCriteria, true),
    extraBlock("jintia-practice__self-check", "Comprueba tu respuesta", node.selfCheck),
    extraBlock("jintia-practice__feedback", "Retroalimentación", node.feedback),
    extraBlock("jintia-practice__remediation", "¿No coincidió?", node.remediation),
    extraBlock("jintia-practice__transfer", "Transferencia", node.transfer),
  ].filter(Boolean).join("\n  ");

  return `
<section class="jintia-block jintia-practice"
       data-pagination="${escapeHtml(pagination)}"${idAttr}>
  <span class="jintia-block__label" aria-hidden="true">${escapeHtml(label)}</span>
  ${titleHtml}
  ${timeHtml}
  <div class="jintia-block__content">
${renderContent(node.content, bib, style)}
  </div>
  ${extraHtml}
</section>`;
}

function renderWarning(node, bib, style)        { return renderBlock(node, "jintia-warning",        "Advertencia",  bib, style); }
function renderCriticalError(node, bib, style)  { return renderBlock(node, "jintia-critical-error", "Error crítico", bib, style); }
function renderScenario(node, bib, style)       { return renderBlock(node, "jintia-scenario",       "Escenario",    bib, style); }

function renderMarginNote(node, bib, style) {
  const idAttr = node.id ? ` id="${escapeHtml(node.id)}"` : "";
  return `
<aside class="jintia-margin-note"${idAttr} role="note">
  ${renderContent(node.content, bib, style)}
</aside>`;
}

/** Figura: HTML nativo con counter CSS para numeración automática. */
function renderFigure(node) {
  const pagination = node.pagination || "atomic";
  const idAttr     = node.id ? ` id="${escapeHtml(node.id)}"` : "";
  const widthAttr  = node.width ? ` style="max-width:${escapeHtml(node.width)}"` : "";
  return `
<figure class="jintia-figure" data-pagination="${escapeHtml(pagination)}"${idAttr}>
  <img src="${escapeHtml(node.src || "")}" alt="${escapeHtml(node.alt || "")}" loading="lazy"${widthAttr} />
  <figcaption class="jintia-caption">${escapeHtml(node.caption || "")}</figcaption>
</figure>`;
}

/** htmlFigure: alias para el pipeline visual. */
function htmlFigure(spec, outputPath) {
  return renderFigure({ src: outputPath, alt: spec.alt || "", caption: spec.caption || "", width: spec.width || "100%" });
}

/** Tabla estructurada desde guide.json. */
function renderTable(node) {
  const pagination = node.pagination || "splittable";
  const idAttr     = node.id ? ` id="${escapeHtml(node.id)}"` : "";
  const headers    = node.headers || [];
  const rows       = node.rows    || [];
  const theadHtml  = headers.length
    ? `<thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>`
    : "";
  const tbodyHtml  = rows.length
    ? `<tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("\n")}</tbody>`
    : "";
  return `
<div class="jintia-table" data-pagination="${escapeHtml(pagination)}"${idAttr}>
  <table>
    ${node.caption ? `<caption>${escapeHtml(node.caption)}</caption>` : ""}
    ${theadHtml}
    ${tbodyHtml}
  </table>
</div>`;
}

/** Assessment: lista numerada de preguntas/actividades, más criterios/producto/checklist estructurados. */
function renderAssessment(node, bib, style) {
  const pagination = node.pagination || "atomic";
  const idAttr     = node.id ? ` id="${escapeHtml(node.id)}"` : "";
  const codeHtml   = node.code ? `<span class="jintia-assessment__code">${escapeHtml(node.code)}</span>` : "";
  const titleHtml  = node.title
    ? `<h2 class="jintia-block__title">${codeHtml}${escapeHtml(node.title)}</h2>`
    : codeHtml
      ? `<h2 class="jintia-block__title">${codeHtml}</h2>`
      : "";
  const items      = Array.isArray(node.items) ? node.items : [];
  const itemsHtml  = items.length
    ? `<ol class="jintia-assessment__list">${items.map(item => `<li class="jintia-assessment__item">${renderContent(item, bib, style)}</li>`).join("\n")}</ol>`
    : renderContent(node.content, bib, style);

  const instructionsHtml = node.instructions
    ? `<div class="jintia-assessment__instructions">${renderContent(node.instructions, bib, style)}</div>`
    : "";

  const productHtml = node.product
    ? `<div class="jintia-assessment__product"><h3>Producto esperado</h3>${renderContent(node.product, bib, style)}</div>`
    : "";

  const criteria    = Array.isArray(node.criteria) ? node.criteria : [];
  const hasRubric   = criteria.some(c => typeof c.weight === "number");
  const criteriaHtml = criteria.length
    ? `<div class="jintia-assessment__criteria"><h3>${hasRubric ? "Rúbrica" : "Criterios"}</h3><ul>${criteria.map(c => {
        const weight = typeof c.weight === "number" ? ` (${escapeHtml(String(c.weight))}%)` : "";
        return `<li>${escapeHtml(c.description || "")}${weight}</li>`;
      }).join("")}</ul></div>`
    : "";

  const pointsHtml = typeof node.points === "number"
    ? `<p class="jintia-assessment__points">Puntaje: ${escapeHtml(String(node.points))}</p>`
    : "";

  const checkpointBadge = Array.isArray(node.targetIds) && node.targetIds.length > 1
    ? `<span class="jintia-assessment__checkpoint-badge">Checkpoint</span>`
    : "";

  const timeHtml = typeof node.estimatedMinutes === "number"
    ? `<p class="jintia-block__estimated-minutes">Tiempo estimado: ${escapeHtml(String(node.estimatedMinutes))} min</p>`
    : "";

  const checklist    = Array.isArray(node.submissionChecklist) ? node.submissionChecklist : [];
  const checklistHtml = checklist.length
    ? `<div class="jintia-assessment__checklist"><h3>Checklist de entrega</h3><ul>${checklist.map(c => `<li>${processInlineMarkup(String(c), bib, style)}</li>`).join("")}</ul></div>`
    : "";

  return `
<section class="jintia-block jintia-assessment" data-pagination="${escapeHtml(pagination)}"${idAttr}>
  <span class="jintia-block__label" aria-hidden="true">Actividad evaluativa</span>
  ${checkpointBadge}
  ${titleHtml}
  ${timeHtml}
  <div class="jintia-block__content">
    ${itemsHtml}
  </div>
  ${instructionsHtml}
  ${productHtml}
  ${criteriaHtml}
  ${pointsHtml}
  ${checklistHtml}
</section>`;
}

/**
 * Bibliografía: genera la lista de referencias usando bibliography-manager.
 * Solo incluye las claves citadas en nodos citation de la guía.
 */
function renderBibliography(node, bib, usedKeys = [], style = "apa") {
  const idAttr = node.id ? ` id="${escapeHtml(node.id)}"` : "";
  let entries;
  if (bib) {
    const keys = usedKeys.length > 0 ? [...new Set(usedKeys)] : null;
    entries    = bibMgr.renderBibliographyEntries(keys, bib, style);
  } else {
    entries = Array.isArray(node.entries) ? node.entries : [];
  }
  const listHtml = entries.length
    ? `<ul class="jintia-bibliography__list" role="list">\n        ${entries.map(e => `<li class="jintia-bibliography__item">${e}</li>`).join("\n        ")}\n      </ul>`
    : `<p class="jintia-muted">No se encontraron entradas bibliográficas.</p>`;
  return `
<section class="jintia-bibliography" data-pagination="splittable"${idAttr}>
  <h2>Referencias</h2>
  ${listHtml}
</section>`;
}

/**
 * Cita inline como nodo de sección (para citas al final de un bloque).
 * Para citas dentro de texto usar la sintaxis {{cite:clave}} en el content.
 */
function renderCitation(node, bib, style = "apa") {
  const keys = Array.isArray(node.keys) ? node.keys : [];
  if (bib && keys.length > 0) {
    return bibMgr.renderCitation(keys, node.mode || "parenthetical", bib, style);
  }
  const keyStr = keys.join(", ");
  return `<cite class="jintia-citation" data-keys="${escapeHtml(keyStr)}">[${escapeHtml(keyStr)}]</cite>`;
}

// ─── Dispatcher de nodos ─────────────────────────────────────────────────────

const RENDERERS = {
  orientation:      renderOrientation,
  theory:           renderTheory,
  concept:          renderConcept,
  practice:         renderPractice,
  warning:          renderWarning,
  "critical-error": renderCriticalError,
  scenario:         renderScenario,
  "margin-note":    renderMarginNote,
  figure:           renderFigure,
  table:            renderTable,
  assessment:       renderAssessment,
  bibliography:     renderBibliography,
  citation:         renderCitation,
};

/**
 * Carga el logotipo oficial de Jintia (SVG vectorial) para incrustarlo en la
 * hoja de colofón. Se hace inline (no como <img src>) para no depender de
 * ninguna copia de assets ni de resolución de rutas relativas en el HTML de
 * salida. Se retiran los atributos width/height del archivo fuente para que
 * el tamaño lo controle exclusivamente el CSS del tema (mantiene viewBox).
 */
let _brandLogoSvg = null;
function brandLogoSvg() {
  if (_brandLogoSvg === null) {
    try {
      _brandLogoSvg = fs
        .readFileSync(BRAND_LOGO_PATH, "utf8")
        .replace(/\s(width|height)="[^"]*"/g, "");
    } catch {
      _brandLogoSvg = "";
    }
  }
  return _brandLogoSvg;
}

/**
 * Colofón: última hoja de toda guía generada por Jintia, con el logotipo
 * oficial y una nota breve de procedencia. No forma parte del contenido
 * pedagógico (no se cuenta como sección en guide.json); se añade siempre
 * al final del documento, sea cual sea el tema activo.
 */
function renderColophon(metadata) {
  const logo        = brandLogoSvg();
  const generatedOn = new Date().toISOString().slice(0, 10);
  const identity    = [metadata.course, metadata.code].filter(Boolean).join(" · ");
  return `
<footer class="jintia-colophon" data-pagination="page-contained" role="contentinfo">
  ${logo ? `<div class="jintia-colophon__mark">${logo}</div>` : ""}
  <p class="jintia-colophon__note">Guías de clase claras y bien diseñadas, semana a semana.</p>
  ${identity ? `<p class="jintia-colophon__identity">${escapeHtml(identity)}</p>` : ""}
  <p class="jintia-colophon__date">${escapeHtml(generatedOn)}</p>
</footer>`;
}

function renderSection(node, bib = null, usedKeys = [], style = "apa") {
  const renderer = RENDERERS[node.type];
  if (!renderer) {
    console.warn(`[guide-renderer] Tipo de nodo desconocido: "${node.type}" — se omite.`);
    return `<!-- nodo desconocido: ${escapeHtml(node.type)} -->`;
  }
  if (node.type === "bibliography") return renderer(node, bib, usedKeys, style);
  if (node.type === "figure" || node.type === "table") return renderer(node);
  return renderer(node, bib, style);
}

// ─── HTML completo del documento ─────────────────────────────────────────────

function buildHtml(guide, cssHref, bib) {
  const { metadata, sections } = guide;
  const lang  = metadata.lang          || "es";
  const title = metadata.topic         || "Guía Semanal";
  const style = metadata.citationStyle || "apa";

  const coverHtml    = renderCover(metadata);
  const colophonHtml = renderColophon(metadata);

  // Pre-recolectar claves citadas recursivamente (nodos citation, content inline y assessment.items)
  const usedKeys = bib ? collectCitationKeys(guide) : [];

  const sectionsHtml = (sections || []).map(s => renderSection(s, bib, usedKeys, style)).join("\n\n");

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(metadata.outcome || title)}" />
  <meta name="author" content="${escapeHtml((metadata.authors || []).join(", "))}" />
  <link rel="stylesheet" href="${escapeHtml(cssHref)}" />
</head>
<body>

${coverHtml}

<main class="jintia-content" role="main">
${sectionsHtml}
</main>

${colophonHtml}

</body>
</html>`;
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Renderiza un guide.json a string HTML.
 *
 * Cuando se especifica `options.outputPath`, copia automáticamente el CSS del
 * tema (y de sus temas padre) a `.jintia-assets/themes/` junto al archivo de
 * salida, para que todos los `@import` resuelvan sin importar el servidor.
 *
 * @param {string} guidePath - Ruta absoluta o relativa al guide.json
 * @param {object} [options]
 * @param {string} [options.theme]        - ID del tema (ej. "jintia-clasico")
 * @param {string} [options.outputPath]   - Ruta del HTML de salida (activa copia de assets)
 * @param {string} [options.themeCssHref] - Anula el href CSS calculado automáticamente
 * @returns {string} HTML completo del documento
 */
function renderGuide(guidePath, options = {}) {
  const absolute = path.resolve(guidePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`guide.json no encontrado: ${absolute}`);
  }
  let guide;
  try {
    guide = JSON.parse(fs.readFileSync(absolute, "utf8"));
  } catch (err) {
    throw new Error(`Error al parsear guide.json: ${err.message}`);
  }
  if (!guide.metadata || !guide.sections) {
    throw new Error("guide.json inválido: faltan los campos 'metadata' y/o 'sections'.");
  }

  const themeId = options.theme || guide.metadata.theme || "jintia-clasico";

  let cssHref = options.themeCssHref;
  if (!cssHref) {
    cssHref = options.outputPath
      ? copyThemeAssets(themeId, options.outputPath)
      : `./themes/${themeId}/theme.css`;
  }

  let bib = null;
  const bibDecl = guide.metadata.bibliography;
  if (bibDecl) {
    const bibPath = path.resolve(path.dirname(absolute), bibDecl);
    bib = bibMgr.loadBibliography(bibPath);
  }

  return buildHtml(guide, cssHref, bib);
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args      = process.argv.slice(2);
  const specArg   = args.find((a, i) => args[i - 1] === "--spec") || args.find(a => !a.startsWith("--"));
  const outputArg = args.find((a, i) => args[i - 1] === "--output");
  const themeArg  = args.find((a, i) => args[i - 1] === "--theme");

  if (!specArg) {
    console.error("Uso: node scripts/guide-renderer.js guide.json [--theme jintia-clasico] [--output guide.html]");
    process.exit(2);
  }

  try {
    // Sin --output: generar guide.html al lado del guide.json
    const outputPath = outputArg
      ? path.resolve(outputArg)
      : /\.json$/i.test(specArg)
        ? path.resolve(specArg.replace(/\.json$/i, ".html"))
        : null;

    const html = renderGuide(specArg, { theme: themeArg, outputPath });

    if (outputPath) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, html, "utf8");
      console.log(`✓ HTML generado: ${outputPath}`);
    } else {
      process.stdout.write(html);
    }
  } catch (err) {
    console.error(`guide-renderer: ${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  renderGuide,
  renderSection,
  renderColophon,
  htmlFigure,
  escapeHtml,
  textToHtml,
  copyThemeAssets,
  resolveThemeDeps,
  processInlineMarkup,
};
