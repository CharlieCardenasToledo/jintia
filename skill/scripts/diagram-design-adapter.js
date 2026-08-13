"use strict";

const fs = require("fs");
const path = require("path");

const UPSTREAM_DIAGRAM_DESIGN_REVISION = "3c5c34ba3bf9dcf204b55c2dd613f8fa194cf584";
const EDITORIAL_REPRESENTATIONS = new Set(["flowchart", "concept-map", "technical-diagram", "argument-map", "curriculum-map", "timeline"]);
const THEMES_ROOT = path.resolve(__dirname, "..", "themes");
const TOKEN_NAMES = ["brand", "bg", "surface", "surface-raised", "text", "muted", "border", "font-body", "font-heading", "font-mono"];
const NODE_WIDTH = 160;
const NODE_HEIGHT = 64;
const LAYER_STEP = 200;

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

function normalizeDirection(value) {
  const direction = value || "TB";
  if (!["TB", "BT", "LR", "RL"].includes(direction)) throw new Error(`editorial-svg no admite direction=${direction}.`);
  return direction;
}
function connectorSides(direction) {
  return ({ TB: { source: "bottom", target: "top" }, BT: { source: "top", target: "bottom" }, LR: { source: "right", target: "left" }, RL: { source: "left", target: "right" } })[direction];
}
function anchorOffsets(count) { return Array.from({ length: count }, (_, i) => grid((i - (count - 1) / 2) * 16)); }
function anchorPoint(position, side, offset) {
  if (side === "bottom") return { x: grid(position.x + offset), y: grid(position.y + 32) };
  if (side === "top") return { x: grid(position.x + offset), y: grid(position.y - 32) };
  if (side === "right") return { x: grid(position.x + 80), y: grid(position.y + offset) };
  return { x: grid(position.x - 80), y: grid(position.y + offset) };
}
function nodeRect(position, padding = 8) { return { left: position.x - 80 - padding, right: position.x + 80 + padding, top: position.y - 32 - padding, bottom: position.y + 32 + padding }; }
function isOrthogonalSegment(a, b) { return a.x === b.x || a.y === b.y; }
function segmentIntersectsRect(a, b, rect) {
  if (!isOrthogonalSegment(a, b)) throw new Error("editorial-svg produjo un segmento no ortogonal.");
  if (a.x === b.x) return a.x >= rect.left && a.x <= rect.right && Math.max(Math.min(a.y, b.y), rect.top) <= Math.min(Math.max(a.y, b.y), rect.bottom);
  return a.y >= rect.top && a.y <= rect.bottom && Math.max(Math.min(a.x, b.x), rect.left) <= Math.min(Math.max(a.x, b.x), rect.right);
}
function routeIntersectsForeignNode(points, layout, edge) {
  return layout.nodes.some(node => node.id !== edge.from && node.id !== edge.to && points.slice(1).some((point, i) => segmentIntersectsRect(points[i], point, nodeRect(layout.positions.get(node.id)))));
}
function routeKey(points) { return points.map(point => `${point.x},${point.y}`).join("|"); }
function normalizeRoutePoints(points) {
  const result = [];
  for (const point of points) {
    const current = { x: grid(point.x), y: grid(point.y) };
    if (!result.length || current.x !== result[result.length - 1].x || current.y !== result[result.length - 1].y) result.push(current);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 1; i < result.length - 1; i += 1) if ((result[i - 1].x === result[i].x && result[i].x === result[i + 1].x) || (result[i - 1].y === result[i].y && result[i].y === result[i + 1].y)) { result.splice(i, 1); changed = true; break; }
  }
  return result;
}
function roundedOrthogonalPath(points, radius = 8) {
  const clean = normalizeRoutePoints(points);
  let d = `M ${clean[0].x} ${clean[0].y}`;
  for (let i = 1; i < clean.length; i += 1) {
    const previous = clean[i - 1]; const current = clean[i]; const next = clean[i + 1];
    if (!next || previous.x === current.x && current.x === next.x || previous.y === current.y && current.y === next.y) { d += ` L ${current.x} ${current.y}`; continue; }
    const incomingLength = Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y);
    const outgoingLength = Math.abs(next.x - current.x) + Math.abs(next.y - current.y);
    const r = Math.floor(Math.min(radius, incomingLength / 2, outgoingLength / 2) / 4) * 4;
    if (!r) { d += ` L ${current.x} ${current.y}`; continue; }
    const before = { x: current.x + Math.sign(previous.x - current.x) * r, y: current.y + Math.sign(previous.y - current.y) * r };
    const after = { x: current.x + Math.sign(next.x - current.x) * r, y: current.y + Math.sign(next.y - current.y) * r };
    d += ` L ${before.x} ${before.y} Q ${current.x} ${current.y} ${after.x} ${after.y}`;
  }
  return d;
}
function groupSlots(edges, key) {
  const groups = new Map();
  edges.forEach((edge, index) => { const value = key(edge); if (!groups.has(value)) groups.set(value, []); groups.get(value).push({ edge, index }); });
  const slots = new Map();
  for (const members of groups.values()) anchorOffsets(members.length).forEach((offset, i) => slots.set(members[i].index, offset));
  return slots;
}

function buildPrimaryRoute(layout, source, target) {
  const horizontal = layout.direction === "LR" || layout.direction === "RL";
  const midpoint = grid(horizontal ? (source.x + target.x) / 2 : (source.y + target.y) / 2);
  return normalizeRoutePoints(horizontal
    ? [source, { x: midpoint, y: source.y }, { x: midpoint, y: target.y }, target]
    : [source, { x: source.x, y: midpoint }, { x: target.x, y: midpoint }, target]);
}

function buildDetourRoutes(layout, source, target) {
  const horizontal = layout.direction === "LR" || layout.direction === "RL";
  const flow = horizontal ? Math.sign(target.x - source.x) : Math.sign(target.y - source.y);
  const direction = flow || (horizontal ? (layout.direction === "LR" ? 1 : -1) : (layout.direction === "TB" ? 1 : -1));
  const sourceLead = horizontal ? source.x + direction * 16 : source.y + direction * 16;
  const targetLead = horizontal ? target.x - direction * 16 : target.y - direction * 16;
  const channels = horizontal
    ? [16, layout.height - 16, 32, layout.height - 32]
    : [16, layout.width - 16, 32, layout.width - 32];
  return channels.map(channel => normalizeRoutePoints(horizontal
    ? [source, { x: sourceLead, y: source.y }, { x: sourceLead, y: grid(channel) }, { x: targetLead, y: grid(channel) }, { x: targetLead, y: target.y }, target]
    : [source, { x: source.x, y: sourceLead }, { x: grid(channel), y: sourceLead }, { x: grid(channel), y: targetLead }, { x: target.x, y: targetLead }, target]));
}

function routeIsSafe(points, layout, edge, reservedRoutes = new Set()) {
  if (points.length < 2 || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return false;
  if (points.some((point, i) => i > 0 && !isOrthogonalSegment(points[i - 1], point))) return false;
  if (points.some(point => point.x < 0 || point.x > layout.width || point.y < 0 || point.y > layout.height)) return false;
  if (routeIntersectsForeignNode(points, layout, edge)) return false;
  return !reservedRoutes.has(routeKey(points));
}

function chooseConnectorRoute(layout, edge, source, target, reservedRoutes = new Set()) {
  const candidates = [buildPrimaryRoute(layout, source, target), ...buildDetourRoutes(layout, source, target)];
  for (const candidate of candidates) if (routeIsSafe(candidate, layout, edge, reservedRoutes)) return candidate;
  throw new Error(`editorial-svg no puede enrutar ${edge.from} -> ${edge.to} sin atravesar otro nodo; usa Graphviz.`);
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
  const direction = normalizeDirection(model.direction); const positions = new Map();
  const horizontal = direction === "LR" || direction === "RL"; const maxLayer = Math.max(...layers.map(layer => layer.length), 1);
  const width = grid(horizontal ? layers.length * LAYER_STEP + 160 : maxLayer * 224 + 160); const height = grid(horizontal ? maxLayer * 224 + 160 : layers.length * LAYER_STEP + 160);
  layers.forEach((layer, li) => layer.forEach((id, index) => {
    const depth = 120 + li * LAYER_STEP; const cross = 120 + index * 224;
    positions.set(id, horizontal ? { x: grid(direction === "RL" ? width - depth : depth), y: grid(cross) } : { x: grid(cross), y: grid(direction === "BT" ? height - depth : depth) });
  }));
  return { model, nodes, edges, positions, direction, width, height };
}

function rectsIntersect(a, b) { return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }
function computeEdgeLabelPlacement(points, bounds, context = "") {
  const width = 72; const height = 16; const gap = 8;
  const segments = points.slice(1).map((point, i) => ({ a: points[i], b: point, length: Math.abs(point.x - points[i].x) + Math.abs(point.y - points[i].y), i })).filter(segment => segment.length >= (segment.a.y === segment.b.y ? width + gap * 2 : height + gap * 2)).sort((a, b) => b.length - a.length || a.i - b.i);
  for (const segment of segments) {
    const horizontal = segment.a.y === segment.b.y; const center = { x: grid((segment.a.x + segment.b.x) / 2), y: grid((segment.a.y + segment.b.y) / 2) };
    const choices = horizontal ? [{ side: "above", x: grid(center.x - width / 2), y: center.y - gap - height }, { side: "below", x: grid(center.x - width / 2), y: center.y + gap }] : [{ side: "right", x: center.x + gap, y: grid(center.y - height / 2) }, { side: "left", x: center.x - gap - width, y: grid(center.y - height / 2) }];
    for (const choice of choices) {
      const rect = { x: choice.x, y: choice.y, width, height, left: choice.x, right: choice.x + width, top: choice.y, bottom: choice.y + height };
      if (rect.x < 0 || rect.y < 0 || rect.right > bounds.width || rect.bottom > bounds.height) continue;
      if (segmentIntersectsRect(segment.a, segment.b, rect)) continue;
      if ((bounds.positions ? bounds.nodes : []).some(node => rectsIntersect(rect, { ...nodeRect(bounds.positions.get(node.id), 0), x: undefined, y: undefined }))) continue;
      return { segment, rect, orientation: horizontal ? "horizontal" : "vertical", side: choice.side, gap };
    }
  }
  throw new Error(`editorial-svg no puede colocar la etiqueta${context ? ` para ${context}` : ""} dentro del viewBox; usa Graphviz.`);
}
function renderEdgeLabel(placement, text, theme) {
  const { rect } = placement;
  return `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="4" fill="${theme.bg}"/><text x="${grid(rect.x + rect.width / 2)}" y="${grid(rect.y + 12)}" text-anchor="middle" font-size="12" fill="${theme.muted}">${esc(text)}</text>`;
}
function placeEdgeLabel(points, text, theme, bounds, context = "") {
  return renderEdgeLabel(computeEdgeLabelPlacement(points, bounds, context), text, theme);
}
function connector(layout, edge, index, sourceSlots, targetSlots, figure, theme, reservedRoutes) {
  const a = layout.positions.get(edge.from); const b = layout.positions.get(edge.to); const sides = connectorSides(layout.direction); const source = anchorPoint(a, sides.source, sourceSlots.get(index) || 0); const target = anchorPoint(b, sides.target, targetSlots.get(index) || 0); const points = chooseConnectorRoute(layout, edge, source, target, reservedRoutes); reservedRoutes.add(routeKey(points)); const d = roundedOrthogonalPath(points); const label = edge.label ? placeEdgeLabel(points, edge.label, theme, layout, `${edge.from} -> ${edge.to}`) : "";
  return `<path id="${figure}-edge-${index}" d="${d}" fill="none" stroke="${theme.border}" stroke-width="2" marker-end="url(#${figure}-arrow)"/>${label}`;
}

function renderEditorialSvg(spec, options = {}) {
  const layout = layoutEditorialGraph(spec); const theme = resolveEditorialTheme({ ...options, spec }); const figure = esc(spec.id || "figure");
  const title = esc(spec.title || spec.altText || "Diagrama editorial"); const desc = esc(spec.longDescription || spec.altText || "Diagrama editorial generado por Jintia.");
  const outgoing = groupSlots(layout.edges, edge => `${edge.from}-source`); const incoming = groupSlots(layout.edges, edge => `${edge.to}-target`);
  const reservedRoutes = new Set(); const edges = layout.edges.map((edge, index) => connector(layout, edge, index, outgoing, incoming, figure, theme, reservedRoutes)).join("");
  const nodes = layout.nodes.map(node => { const p = layout.positions.get(node.id); const focal = node.kind === "focal"; const words = String(node.label).trim().split(/\s+/); const split = Math.ceil(words.length / 2); const lines = [words.slice(0, split).join(" "), words.slice(split).join(" ")].filter(Boolean); const label = lines.map((line, i) => `<tspan x="${p.x}" dy="${i ? 18 : 0}">${esc(line)}</tspan>`).join(""); return `<g id="${figure}-node-${esc(node.id)}"><rect x="${p.x - 80}" y="${p.y - 32}" width="160" height="64" rx="8" fill="${focal ? theme.focal : theme.surface}" stroke="${theme.border}"/><text x="${p.x}" y="${p.y - (lines.length > 1 ? 10 : -4)}" text-anchor="middle" font-family="${esc(theme.font)}" font-size="14" fill="${focal ? theme.raised : theme.text}">${label}</text></g>`; }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-labelledby="${figure}-title ${figure}-desc"><title id="${figure}-title">${title}</title><desc id="${figure}-desc">${desc}</desc><defs><marker id="${figure}-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="${theme.border}"/></marker></defs>${edges}${nodes}</svg>`;
}

module.exports = { UPSTREAM_DIAGRAM_DESIGN_REVISION, supportsEditorialSpec, resolveEditorialTheme, validateEditorialSpec, layoutEditorialGraph, renderEditorialSvg, anchorOffsets, groupSlots, normalizeDirection, connectorSides, anchorPoint, nodeRect, segmentIntersectsRect, routeIntersectsForeignNode, normalizeRoutePoints, roundedOrthogonalPath, computeEdgeLabelPlacement, placeEdgeLabel, buildPrimaryRoute, buildDetourRoutes, routeIsSafe, chooseConnectorRoute, routeKey };
