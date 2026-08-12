"use strict";

const UPSTREAM_DIAGRAM_DESIGN_REVISION = "3c5c34ba3bf9dcf204b55c2dd613f8fa194cf584";
const EDITORIAL_REPRESENTATIONS = new Set(["flowchart", "concept-map", "technical-diagram", "argument-map", "curriculum-map", "timeline"]);
const esc = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const grid = value => Math.round(value / 4) * 4;

function supportsEditorialSpec(spec) {
  return Boolean(spec && EDITORIAL_REPRESENTATIONS.has(spec.representation) && !spec.formalNotationRequired && !spec.model?.requiresExactCoordinates);
}

function metrics(spec) {
  const model = spec.model || {};
  const nodes = model.nodes || [];
  return {
    nodeCount: nodes.length,
    edgeCount: (model.edges || []).length,
    averageLabelWords: nodes.length ? nodes.reduce((n, x) => n + String(x.label || "").trim().split(/\s+/).length, 0) / nodes.length : 0,
    hierarchyDepth: Number(model.hierarchyDepth || 0),
    crossingRisk: Number(model.crossingRisk || 0)
  };
}

function validateEditorialSpec(spec) {
  if (!supportsEditorialSpec(spec)) throw new Error(`editorial-svg no admite representation=${spec?.representation || "desconocida"}.`);
  const model = spec.model || {};
  if (spec.representation === "timeline") {
    if (!Array.isArray(model.events) || !model.events.length) throw new Error("editorial-svg requiere eventos para timeline.");
    model.nodes = model.events.map((event, i) => ({ id: `event-${i + 1}`, label: `${event.date || ""} ${event.label || ""}`, kind: i === 0 ? "focal" : undefined }));
    model.edges = model.nodes.slice(1).map((node, i) => ({ from: model.nodes[i].id, to: node.id }));
  }
  const nodes = model.nodes || [];
  const edges = model.edges || [];
  if (nodes.length > 12) throw new Error(`editorial-svg excede el presupuesto: ${nodes.length} nodos; máximo 12.`);
  if (edges.length > 16) throw new Error(`editorial-svg excede el presupuesto: ${edges.length} edges; máximo 16.`);
  for (const node of nodes) {
    const words = String(node.label || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) throw new Error(`editorial-svg requiere una etiqueta no vacía para ${node.id}.`);
    if (words.length > 8) throw new Error(`editorial-svg no puede representar la etiqueta de ${node.id} sin truncarla.`);
  }
  const ids = new Set();
  for (const node of nodes) {
    if (!node.id || ids.has(node.id)) throw new Error("editorial-svg requiere IDs de nodo únicos.");
    ids.add(node.id);
    if (!String(node.label || "").trim()) throw new Error(`editorial-svg requiere etiqueta para ${node.id}.`);
    if (/<|>|javascript:|on\w+\s*=|<script/i.test(String(node.label))) throw new Error("editorial-svg rechaza contenido activo en etiquetas.");
    if (String(node.label).trim().split(/\s+/).length > 16) throw new Error(`editorial-svg no puede representar la etiqueta de ${node.id} sin truncarla.`);
  }
  if (nodes.filter(node => node.kind === "focal").length > 2) throw new Error("editorial-svg admite como máximo dos nodos focales.");
  for (const edge of edges) if (!ids.has(edge.from) || !ids.has(edge.to)) throw new Error(`Arista con nodo inexistente: ${edge.from} -> ${edge.to}`);
  const m = metrics({ ...spec, model });
  if (m.edgeCount > 16 || m.hierarchyDepth > 4 || m.crossingRisk > 2 || m.averageLabelWords > 8) throw new Error("editorial-svg excede la complejidad editorial; usa un motor especializado.");
  return spec;
}

function resolveEditorialTheme(options = {}) {
  const palette = options.spec?.palette || {};
  return { bg: palette.background || "#ffffff", surface: palette.surface || "#eef6f5", text: palette.text || "#173b3a", muted: palette.muted || "#55706f", border: palette.border || "#8cb8b5", focal: palette.focal || "#00796b", font: "Arial, sans-serif" };
}

function layoutEditorialGraph(spec) {
  validateEditorialSpec(spec);
  const model = spec.model || {};
  const nodes = model.nodes || [];
  const edges = model.edges || [];
  const incoming = new Map(nodes.map(node => [node.id, 0]));
  for (const edge of edges) incoming.set(edge.to, (incoming.get(edge.to) || 0) + 1);
  const layers = [];
  let remaining = nodes.map(node => node.id);
  const seen = new Set();
  while (remaining.length) {
    const layer = remaining.filter(id => !seen.has(id) && (incoming.get(id) || 0) === 0);
    const stable = layer.length ? layer : remaining.filter(id => !seen.has(id)).slice(0, 1);
    layers.push(stable);
    for (const id of stable) { seen.add(id); for (const edge of edges.filter(edge => edge.from === id)) incoming.set(edge.to, Math.max(0, incoming.get(edge.to) - 1)); }
    remaining = remaining.filter(id => !seen.has(id));
  }
  const map = new Map();
  const direction = model.direction || "TB";
  layers.forEach((layer, li) => layer.forEach((id, index) => {
    const cross = 120 + index * 224;
    const depth = 120 + li * 120;
    map.set(id, direction === "LR" ? { x: grid(depth), y: grid(cross) } : { x: grid(cross), y: grid(depth) });
  }));
  return { nodes, edges, positions: map, width: grid(Math.max(320, (Math.max(...layers.map(layer => layer.length), 1) * 224) + 160)), height: grid(Math.max(240, (layers.length * 120) + 160)) };
}

function renderEditorialSvg(spec, options = {}) {
  const layout = layoutEditorialGraph(spec);
  const theme = resolveEditorialTheme({ ...options, spec });
  const figure = esc(spec.id || "figure");
  const title = esc(spec.title || spec.altText || "Diagrama editorial");
  const desc = esc(spec.longDescription || spec.altText || "Diagrama editorial generado por Jintia.");
  const width = layout.width; const height = layout.height;
  const nodeById = new Map(layout.nodes.map(node => [node.id, node]));
  const edges = layout.edges.map((edge, i) => {
    const a = layout.positions.get(edge.from); const b = layout.positions.get(edge.to);
    const mid = grid((a.y + b.y) / 2); const label = edge.label ? `<rect x="${grid((a.x + b.x) / 2 - 36)}" y="${mid - 10}" width="72" height="20" rx="4" fill="${theme.bg}"/><text x="${grid((a.x + b.x) / 2)}" y="${mid + 4}" text-anchor="middle" font-size="12" fill="${theme.muted}">${esc(edge.label)}</text>` : "";
    const d = a.x === b.x ? `M ${a.x} ${a.y + 32} V ${b.y - 32}` : `M ${a.x + 80} ${a.y} H ${grid((a.x + b.x) / 2)} V ${b.y} H ${b.x - 80}`;
    return `<path id="${figure}-edge-${i}" d="${d}" fill="none" stroke="${theme.border}" stroke-width="2" marker-end="url(#${figure}-arrow)"/>${label}`;
  }).join("");
  const nodes = layout.nodes.map(node => { const p = layout.positions.get(node.id); const focal = node.kind === "focal"; const words = String(node.label).trim().split(/\s+/); const split = Math.ceil(words.length / 2); const lines = [words.slice(0, split).join(" "), words.slice(split).join(" ")].filter(Boolean); const label = lines.map((line, i) => `<tspan x="${p.x}" dy="${i ? 18 : 0}">${esc(line)}</tspan>`).join(""); return `<g id="${figure}-node-${esc(node.id)}"><rect x="${p.x - 80}" y="${p.y - 32}" width="160" height="64" rx="8" fill="${focal ? theme.focal : theme.surface}" stroke="${theme.border}"/><text x="${p.x}" y="${p.y - (lines.length > 1 ? 10 : -4)}" text-anchor="middle" font-family="${theme.font}" font-size="14" fill="${focal ? "#ffffff" : theme.text}">${label}</text></g>`; }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${figure}-title ${figure}-desc"><title id="${figure}-title">${title}</title><desc id="${figure}-desc">${desc}</desc><defs><marker id="${figure}-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="${theme.border}"/></marker></defs>${edges}${nodes}</svg>`;
}

module.exports = { UPSTREAM_DIAGRAM_DESIGN_REVISION, supportsEditorialSpec, resolveEditorialTheme, validateEditorialSpec, layoutEditorialGraph, renderEditorialSvg };
