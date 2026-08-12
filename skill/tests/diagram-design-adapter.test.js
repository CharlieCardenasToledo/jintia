"use strict";

const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const test = require("node:test");
const { renderEditorialSvg, validateEditorialSpec } = require("../scripts/diagram-design-adapter");

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
  const svg = renderEditorialSvg(spec());
  assert.match(svg, /<path[^>]*d="M [^ ]+ [^ ]+ V [^ ]+"/);
  assert.ok(svg.indexOf("<path") < svg.indexOf("<g id=\"fig-editorial-node"));
  assert.match(svg, /<rect[^>]*fill="#ffffff"/);
});

test("editorial-svg aplica palette y tokens del tema Jintia", () => {
  const svg = renderEditorialSvg({ ...spec(), palette: { focal: "#123456" } });
  assert.match(svg, /#123456/);
  assert.doesNotMatch(svg, /fonts\.googleapis\.com/);
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
  const svg = renderEditorialSvg({ id: "fig-time", representation: "timeline", altText: "Cronología", model: { events: [{ date: "2020", label: "Inicio" }, { date: "2021", label: "Cambio" }] } });
  assert.match(svg, /fig-time/);
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
