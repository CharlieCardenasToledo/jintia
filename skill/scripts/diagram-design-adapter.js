"use strict";

const fs = require("fs");
const path = require("path");

const UPSTREAM_DIAGRAM_DESIGN_REVISION = "3c5c34ba3bf9dcf204b55c2dd613f8fa194cf584";
const EDITORIAL_REPRESENTATIONS = new Set(["flowchart", "concept-map", "technical-diagram", "argument-map", "curriculum-map", "timeline"]);
const THEMES_ROOT = path.resolve(__dirname, "..", "themes");
const TOKEN_NAMES = ["brand", "bg", "surface", "surface-raised", "text", "muted", "border", "font-body", "font-heading", "font-mono"];

const esc = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const grid = value => Math.round(value / 4) * 4;
const inside = candidate => {
  const resolved = path.resolve(candidate);
  const relative = path.relative(THEMES_ROOT, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("El tema editorial solicitado escapa de skill/themes.");
  return resolved;
};

function validThemeSlug(value) {
  if (!/^[a-z0-9-]+$/i.test(value || "")) throw new Error("El tema editorial debe ser un slug simple.");
  return value;
}

function extractRootTokens(css) {
  const tokens = {};
  let depth = 0;
  for (let i = 0; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") depth -= 1;
    if (depth === 0 && css.startsWith(":root", i)) {
      const open = css.indexOf("{", i);
      if (open < 0) break;
      let cursor = open + 1; let nested = 1;
      while (cursor < css.length && nested) { if (css[cursor] === "{") nested += 1; if (css[cursor] === "}") nested -= 1; cursor += 1; }
      for (const match of css.slice(open + 1, cursor - 1).matchAll(/(--jintia-[\w-]+)\s*:\s*([^;]+);/g)) tokens[match[1]] = match[2].trim();
      i = cursor - 1;
    }
  }
  return tokens;
}

function readTokenFile(file, visited = new Set(), depth = 0) {
  const resolved = inside(file);
  if (depth > 8 || visited.has(resolved)) return {};
  visited.add(resolved);
  const css = fs.readFileSync(resolved, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const tokens = {};
  for (const match of css.matchAll(/@import\s+["']([^"']+\.css)["']\s*;/g)) {
    if (/^(?:https?:|data:|file:|\/)/i.test(match[1])) throw new Error("Los temas editoriales solo admiten imports CSS locales.");
    tokens && Object.assign(tokens, readTokenFile(inside(path.resolve(path.dirname(resolved), match[1])), visited, depth + 1));
  }
  return Object.assign(tokens, extractRootTokens(css));
}

function resolveEditorialTheme(options = {}) {
  const template = validThemeSlug(options.template || "jintia-clasico");
  const tokens = readTokenFile(inside(path.join(THEMES_ROOT, template, "tokens.css")));
  const missing = TOKEN_NAMES.filter(name => !tokens[`--jintia-${name}`]);
  if (missing.length) throw new Error(`Faltan tokens editoriales obligatorios: ${missing.join(", ")}.`);
  const palette = options.spec?.palette || {};
  return {
    bg: palette.background || tokens["--jintia-bg"],
    surface: palette.surface || tokens["--jintia-surface"],
    raised: tokens["--jintia-surface-raised"],
    text: palette.text || tokens["--jintia-text"],
    muted: palette.muted || tokens["--jintia-muted"],
    border: palette.border || tokens["--jintia-border"],
    focal: palette.focal || tokens["--jintia-brand"],
    font: tokens["--jintia-font-body"],
    heading: tokens["--jintia-font-heading"],
    mono: tokens["--jintia-font-mono"]
  };
}

function supportsEditorialSpec(spec) { return Boolean(spec && EDITORIAL_REPRESENTATIONS.has(spec.representation) && !spec.formalNotationRequired && !spec.model?.requiresExactCoordinates); }
function derivedModel(spec) {
  const model = spec.model || {};
  if (spec.representation !== "timeline") return { ...model, nodes: [...(model.nodes || [])], edges: [...(model.edges || [])] };
  if (!Array.isArray(model.events) || !model.events.length) throw new Error("editorial-svg requiere eventos para timeline.");
  const nodes = model.events.map((event, i) => ({ id: `event-${i + 1}`, label: `${event.date || ""} ${event.label || ""}`.trim(), kind: i === 0 ? "focal" : undefined }));
  return { ...model, nodes, edges: nodes.slice(1).map((node, i) => ({ from: nodes[i].id, to: node.id })) };
}

function validateEditorialSpec(spec) {
  if (!supportsEditorialSpec(spec)) throw new Error(`editorial-svg no admite representation=${spec?.representation || "desconocida"}.`);
  const model = derivedModel(spec); const nodes = model.nodes || []; const edges = model.edges || [];
  if (nodes.length > 12) throw new Error(`editorial-svg excede el presupuesto: ${nodes.length} nodos; máximo 12.`);
  if (edges.length > 16) throw new Error(`editorial-svg excede el presupuesto: ${edges.length} edges; máximo 16.`);
  const ids = new Set();
  for (const node of nodes) {
    if (!node.id || ids.has(node.id)) throw new Error("editorial-svg requiere IDs de nodo únicos.");
    ids.add(node.id);
    const label = String(node.label || "").trim(); const words = label.split(/\s+/).filter(Boolean);
    if (!words.length) throw new Error(`editorial-svg requiere etiqueta para ${node.id}.`);
    if (words.length > 8) throw new Error(`editorial-svg no puede representar la etiqueta de ${node.id} sin truncarla.`);
    if (/<|>|javascript:|on\w+\s*=/i.test(label)) throw new Error("editorial-svg rechaza contenido activo en etiquetas.");
  }
  if (nodes.filter(node => node.kind === "focal").length > 2) throw new Error("editorial-svg admite como máximo dos nodos focales.");
  for (const edge of edges) if (!ids.has(edge.from) || !ids.has(edge.to)) throw new Error(`Arista con nodo inexistente: ${edge.from} -> ${edge.to}`);
  const average = nodes.length ? nodes.reduce((sum, node) => sum + String(node.label).trim().split(/\s+/).length, 0) / nodes.length : 0;
  if (Number(model.hierarchyDepth || 0) > 4 || Number(model.crossingRisk || 0) > 2 || average > 8) throw new Error("editorial-svg excede la complejidad editorial; usa un motor especializado.");
  return { ...model, nodes, edges };
}

function anchorOffsets(count) { return Array.from({ length: count }, (_, i) => grid((i - (count - 1) / 2) * 16)); }
function groupSlots(edges, key) {
  const groups = new Map();
  edges.forEach((edge, index) => { const value = key(edge); if (!groups.has(value)) groups.set(value, []); groups.get(value).push({ edge, index }); });
  const slots = new Map();
  for (const members of groups.values()) anchorOffsets(members.length).forEach((offset, i) => slots.set(members[i].index, offset));
  return slots;
}

function layoutEditorialGraph(spec) {
  const model = validateEditorialSpec(spec); const nodes = model.nodes; const edges = model.edges;
  const incoming = new Map(nodes.map(node => [node.id, 0]));
  edges.forEach(edge => incoming.set(edge.to, incoming.get(edge.to) + 1));
  const layers = []; let remaining = nodes.map(node => node.id); const seen = new Set();
  while (remaining.length) {
    const layer = remaining.filter(id => !seen.has(id) && incoming.get(id) === 0); const stable = layer.length ? layer : remaining.filter(id => !seen.has(id)).slice(0, 1);
    layers.push(stable); stable.forEach(id => { seen.add(id); edges.filter(edge => edge.from === id).forEach(edge => incoming.set(edge.to, Math.max(0, incoming.get(edge.to) - 1))); }); remaining = remaining.filter(id => !seen.has(id));
  }
  const positions = new Map(); const direction = model.direction || "TB";
  layers.forEach((layer, li) => layer.forEach((id, index) => { const cross = 120 + index * 224; const depth = 120 + li * 120; positions.set(id, direction === "LR" ? { x: grid(depth), y: grid(cross) } : { x: grid(cross), y: grid(depth) }); }));
  return { model, nodes, edges, positions, direction, width: grid(Math.max(320, Math.max(...layers.map(layer => layer.length), 1) * 224 + 160)), height: grid(Math.max(240, layers.length * 120 + 160)) };
}

function connector(layout, edge, index, sourceSlots, targetSlots, figure, theme) {
  const a = layout.positions.get(edge.from); const b = layout.positions.get(edge.to); const horizontal = layout.direction === "LR" || layout.direction === "RL";
  const sourceOffset = sourceSlots.get(index) || 0; const targetOffset = targetSlots.get(index) || 0;
  const sx = horizontal ? a.x + (layout.direction === "LR" ? 80 : -80) : a.x + sourceOffset;
  const sy = horizontal ? a.y + sourceOffset : a.y + 32;
  const tx = horizontal ? b.x + (layout.direction === "LR" ? -80 : 80) : b.x + targetOffset;
  const ty = horizontal ? b.y + targetOffset : b.y - 32;
  const channel = grid((horizontal ? (sy + ty) : (sx + tx)) / 2 + ((index % 2 ? 1 : -1) * (Math.abs(sourceOffset) + 16)));
  const d = horizontal
    ? `M ${sx} ${sy} H ${channel - 8} Q ${channel} ${sy} ${channel} ${sy + (ty > sy ? 8 : -8)} V ${ty + (ty > sy ? -8 : 8)} Q ${channel} ${ty} ${channel + 8} ${ty} H ${tx}`
    : `M ${sx} ${sy} V ${channel - (ty > sy ? 8 : -8)} Q ${sx} ${channel} ${sx + (tx > sx ? 8 : -8)} ${channel} H ${tx - (tx > sx ? 8 : -8)} Q ${tx} ${channel} ${tx} ${channel + (ty > sy ? 8 : -8)} V ${ty}`;
  const label = edge.label ? (horizontal ? `<rect x="${grid(channel - 36)}" y="${grid((sy + ty) / 2 - 20)}" width="72" height="16" rx="4" fill="${theme.bg}"/><text x="${channel}" y="${grid((sy + ty) / 2 - 8)}" text-anchor="middle" font-size="12" fill="${theme.muted}">${esc(edge.label)}</text>` : `<rect x="${grid((sx + tx) / 2 - 36)}" y="${channel - 20}" width="72" height="16" rx="4" fill="${theme.bg}"/><text x="${grid((sx + tx) / 2)}" y="${channel - 8}" text-anchor="middle" font-size="12" fill="${theme.muted}">${esc(edge.label)}</text>` ) : "";
  return `<path id="${figure}-edge-${index}" d="${d}" fill="none" stroke="${theme.border}" stroke-width="2" marker-end="url(#${figure}-arrow)"/>${label}`;
}

function renderEditorialSvg(spec, options = {}) {
  const layout = layoutEditorialGraph(spec); const theme = resolveEditorialTheme({ ...options, spec }); const figure = esc(spec.id || "figure");
  const title = esc(spec.title || spec.altText || "Diagrama editorial"); const desc = esc(spec.longDescription || spec.altText || "Diagrama editorial generado por Jintia.");
  const outgoing = groupSlots(layout.edges, edge => `${edge.from}-source`); const incoming = groupSlots(layout.edges, edge => `${edge.to}-target`);
  const edges = layout.edges.map((edge, index) => connector(layout, edge, index, outgoing, incoming, figure, theme)).join("");
  const nodes = layout.nodes.map(node => { const p = layout.positions.get(node.id); const focal = node.kind === "focal"; const words = String(node.label).trim().split(/\s+/); const split = Math.ceil(words.length / 2); const lines = [words.slice(0, split).join(" "), words.slice(split).join(" ")].filter(Boolean); const label = lines.map((line, i) => `<tspan x="${p.x}" dy="${i ? 18 : 0}">${esc(line)}</tspan>`).join(""); return `<g id="${figure}-node-${esc(node.id)}"><rect x="${p.x - 80}" y="${p.y - 32}" width="160" height="64" rx="8" fill="${focal ? theme.focal : theme.surface}" stroke="${theme.border}"/><text x="${p.x}" y="${p.y - (lines.length > 1 ? 10 : -4)}" text-anchor="middle" font-family="${esc(theme.font)}" font-size="14" fill="${focal ? theme.raised : theme.text}">${label}</text></g>`; }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-labelledby="${figure}-title ${figure}-desc"><title id="${figure}-title">${title}</title><desc id="${figure}-desc">${desc}</desc><defs><marker id="${figure}-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="${theme.border}"/></marker></defs>${edges}${nodes}</svg>`;
}

module.exports = { UPSTREAM_DIAGRAM_DESIGN_REVISION, supportsEditorialSpec, resolveEditorialTheme, validateEditorialSpec, layoutEditorialGraph, renderEditorialSvg, anchorOffsets };
