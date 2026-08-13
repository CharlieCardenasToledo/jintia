"use strict";

const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const test = require("node:test");
const { renderEditorialSvg, resolveEditorialTheme, validateEditorialSpec, layoutEditorialGraph, nodeRect, segmentIntersectsRect } = require("../scripts/diagram-design-adapter");

function spec() {
  return { id: "fig-editorial", representation: "flowchart", altText: "Proceso editorial", model: {
    direction: "TB", nodes: [{ id: "a", label: "Inicio", kind: "focal" }, { id: "b", label: "Resultado" }], edges: [{ from: "a", to: "b", label: "produce" }]
  }};
}

test("editorial-svg genera SVG accesible autosuficiente y determinista", () => {
  const first = renderEditorialSvg(spec());
  assert.equal(first, renderEditorialSvg(spec()));
  assert.match(first, /<svg[^>]*role="img"[^>]*aria-labelledby/);
  assert.match(first, /<title/);
  assert.match(first, /<desc[^>]*>[^<]+<\/desc>/);
  assert.doesNotMatch(first, /<script|<foreignObject|https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
  assert.match(first, /fig-editorial-title|fig-editorial-desc|fig-editorial-arrow/);
});

test("editorial-svg usa rejilla de cuatro pixeles y conectores ortogonales", () => {
  const svg = renderEditorialSvg({ ...spec(), model: { nodes: ["A", "B", "C", "D", "E"].map((id, i) => ({ id: id.toLowerCase(), label: id, kind: i === 0 ? "focal" : undefined })), edges: [{ from: "a", to: "b" }, { from: "a", to: "c" }, { from: "a", to: "d" }, { from: "b", to: "e" }, { from: "c", to: "e" }, { from: "d", to: "e" }] } });
  assert.match(svg, /<path[^>]*d="M [^ ]+ [^ ]+ (?:L|Q|V)/);
  assert.ok(svg.indexOf("<path") < svg.indexOf("<g id=\"fig-editorial-node"));
  const paths = [...svg.matchAll(/<path id="fig-editorial-edge-\d+" d="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(new Set(paths.map(value => value.match(/M ([^ ]+) ([^ ]+)/).slice(1).join(","))).size > 1);
  assert.match(svg, / Q /);
  assert.match(svg, /fill="#f8fafc"/);
});

test("editorial-svg aplica palette y tokens del tema Jintia", () => {
  const classic = resolveEditorialTheme({ template: "jintia-clasico", spec: spec() });
  const technical = resolveEditorialTheme({ template: "jintia-tecnico", spec: spec() });
  assert.equal(classic.focal, "#0f766e");
  assert.equal(technical.focal, "#1d4ed8");
  assert.equal(technical.text, classic.text);
  assert.match(technical.font, /IBM Plex Sans/);
  const svg = renderEditorialSvg({ ...spec(), palette: { focal: "#123456" } }, { template: "jintia-tecnico" });
  assert.match(svg, /#123456/);
  assert.match(svg, /#f0f4ff/);
  assert.doesNotMatch(svg, /fonts\.googleapis\.com/);
});

test("editorial-svg restringe temas a skill/themes", () => {
  for (const template of ["../../etc", "../", "https://example.com/theme.css", "file:///tmp/theme.css"]) assert.throws(() => resolveEditorialTheme({ template, spec: spec() }));
});

test("editorial-svg separa etiquetas de sus conectores", () => {
  const svg = renderEditorialSvg({ ...spec(), model: { nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }], edges: [{ from: "a", to: "b", label: "produce" }] } });
  const mask = svg.match(/<rect x="([^"]+)" y="([^"]+)" width="72" height="16"/);
  const text = svg.match(/<text x="([^"]+)" y="([^"]+)"[^>]*>produce/);
  assert.ok(mask && text);
  assert.ok(Number(mask[2]) + 16 <= 120 - 6 || Number(mask[2]) >= 120 + 6);
});

test("editorial-svg respeta direcciones TB BT LR RL", () => {
  for (const [direction, relation] of [["TB", (a, b) => b.y > a.y], ["BT", (a, b) => b.y < a.y], ["LR", (a, b) => b.x > a.x], ["RL", (a, b) => b.x < a.x]]) {
    const graph = { ...spec(), model: { direction, nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }], edges: [{ from: "a", to: "b" }] } };
    const layout = layoutEditorialGraph(graph); assert.ok(relation(layout.positions.get("a"), layout.positions.get("b")), direction);
    assert.match(renderEditorialSvg(graph), new RegExp(`fig-editorial-edge-0`));
  }
});

test("editorial-svg falla cuando no existe canal ortogonal seguro", () => {
  assert.throws(() => renderEditorialSvg({ ...spec(), model: { direction: "DIAGONAL", nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }], edges: [{ from: "a", to: "b" }] } }), /direction/);
});

test("editorial-svg evita atravesar nodos no relacionados", () => {
  const svg = renderEditorialSvg({ ...spec(), model: { nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "x", label: "X" }], edges: [{ from: "a", to: "b" }] } });
  assert.match(svg, /fig-editorial-edge-0/);
  assert.doesNotMatch(svg, /M 120 152 V 120 H 120/);
});

test("editorial-svg rechaza sobrepresupuesto inyeccion y exceso de focos", () => {
  const many = Array.from({ length: 13 }, (_, i) => ({ id: `n${i}`, label: "Nodo" }));
  assert.throws(() => validateEditorialSpec({ ...spec(), model: { nodes: many, edges: [] } }), /máximo 12/);
  assert.throws(() => validateEditorialSpec({ ...spec(), model: { nodes: [{ id: "a", label: "<script>" }], edges: [] } }), /contenido activo/);
  assert.throws(() => validateEditorialSpec({ ...spec(), model: { nodes: [{ id: "a", label: "A", kind: "focal" }, { id: "b", label: "B", kind: "focal" }, { id: "c", label: "C", kind: "focal" }], edges: [] } }), /focal/);
  assert.throws(() => validateEditorialSpec({ ...spec(), model: { nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }], edges: Array.from({ length: 17 }, () => ({ from: "a", to: "b" })) } }), /máximo 16/);
  assert.throws(() => validateEditorialSpec({ ...spec(), model: { nodes: [{ id: "a", label: "A" }], edges: [{ from: "a", to: "missing" }] } }), /nodo inexistente/);
});

test("editorial-svg renderiza timeline conceptual sin herramienta externa", () => {
  const input = { id: "fig-time", representation: "timeline", altText: "Cronología", model: { events: [{ date: "2020", label: "Inicio" }, { date: "2021", label: "Cambio" }] } };
  const before = structuredClone(input);
  const svg = renderEditorialSvg(input);
  assert.match(svg, /fig-time/);
  assert.deepEqual(input, before);
});

test("visual-renderer ejecuta editorial-svg como motor interno", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-editorial-"));
  const specs = path.join(root, "specs");
  fs.mkdirSync(specs, { recursive: true });
  const fixture = {
    id: "fig-renderer",
    pedagogicalIntent: "relate",
    representation: "flowchart",
    outputFormat: "svg",
    altText: "Flujo editorial",
    model: { nodes: [{ id: "a", label: "Inicio" }, { id: "b", label: "Fin" }], edges: [{ from: "a", to: "b" }] }
  };
  const specPath = path.join(specs, "fig-renderer.json");
  fs.writeFileSync(specPath, JSON.stringify(fixture));
  const renderer = path.resolve(__dirname, "..", "scripts", "visual-renderer.js");
  const result = spawnSync(process.execPath, [renderer, "--spec", specPath, "--template", "jintia-clasico"], { encoding: "utf8" });
  try {
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
    assert.equal(manifest.figures[0].engine, "editorial-svg");
    assert.equal(manifest.figures[0].toolVersion, require("../package.json").version);
    assert.match(fs.readFileSync(path.join(root, "sources", "fig-renderer.svg"), "utf8"), /<svg/);
    assert.match(fs.readFileSync(path.join(root, "rendered", "fig-renderer.svg"), "utf8"), /role="img"/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
