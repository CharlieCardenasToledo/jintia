"use strict";

const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const test = require("node:test");
const { renderEditorialSvg, resolveEditorialTheme, validateEditorialSpec, layoutEditorialGraph, nodeRect, segmentIntersectsRect, anchorPoint, connectorSides, groupSlots, connectorAnchors, buildPrimaryRoute, buildDetourRoutes, chooseConnectorRoute, routeIsSafe, routeIntersectsForeignNode, routeKey, roundedOrthogonalPath, computeEdgeLabelPlacement, NODE_WIDTH, NODE_HEIGHT, VERTICAL_LAYER_STEP, HORIZONTAL_LAYER_STEP } = require("../scripts/diagram-design-adapter");

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
  assert.match(svg, /fill="#f3f7f5"/);
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
  const graph = { ...spec(), model: { nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }], edges: [{ from: "a", to: "b", label: "produce" }] } };
  const layout = layoutEditorialGraph(graph); const sourceSlots = groupSlots(layout.edges, edge => `${edge.from}-source`); const targetSlots = groupSlots(layout.edges, edge => `${edge.to}-target`); const anchors = connectorAnchors(layout, graph.model.edges[0], 0, sourceSlots, targetSlots);
  const points = chooseConnectorRoute(layout, graph.model.edges[0], anchors.source, anchors.target);
  const placement = computeEdgeLabelPlacement(points, layout);
  const segmentY = placement.segment.a.y; const segmentX = placement.segment.a.x;
  const gap = placement.orientation === "horizontal" ? (placement.side === "above" ? segmentY - placement.rect.bottom : placement.rect.top - segmentY) : (placement.side === "right" ? placement.rect.left - segmentX : segmentX - placement.rect.right);
  assert.equal(gap, 8); assert.ok(gap >= 6 && gap <= 10);
  assert.equal(segmentIntersectsRect(placement.segment.a, placement.segment.b, placement.rect), false);
  assert.ok(placement.rect.x >= 0 && placement.rect.y >= 0 && placement.rect.right <= layout.width && placement.rect.bottom <= layout.height);
  assert.match(renderEditorialSvg(graph), />produce<\/text>/);
  const horizontalPoints = [{ x: 40, y: 60 }, { x: 112, y: 60 }]; const horizontalPlacement = computeEdgeLabelPlacement(horizontalPoints, { width: 200, height: 120, positions: new Map(), nodes: [] });
  assert.equal(horizontalPlacement.gap, 8); assert.equal(segmentIntersectsRect(horizontalPlacement.segment.a, horizontalPlacement.segment.b, horizontalPlacement.rect), false); assert.ok(horizontalPlacement.rect.left >= Math.min(horizontalPlacement.segment.a.x, horizontalPlacement.segment.b.x)); assert.ok(horizontalPlacement.rect.right <= Math.max(horizontalPlacement.segment.a.x, horizontalPlacement.segment.b.x));
});

test("editorial-svg acepta etiqueta cuando el segmento tiene la longitud minima", () => {
  const placement = computeEdgeLabelPlacement([{ x: 40, y: 60 }, { x: 112, y: 60 }], { width: 200, height: 120, positions: new Map(), nodes: [] });
  assert.equal(placement.rect.left, 40); assert.equal(placement.rect.right, 112); assert.equal(placement.gap, 8);
  const vertical = computeEdgeLabelPlacement([{ x: 100, y: 40 }, { x: 100, y: 56 }], { width: 200, height: 120, positions: new Map(), nodes: [] });
  assert.equal(vertical.rect.top, 40); assert.equal(vertical.rect.bottom, 56);
});

test("editorial-svg cambia de lado cuando el label colisiona con un nodo", () => {
  const bounds = { width: 240, height: 140, positions: new Map([["n", { x: 76, y: 20 }]]), nodes: [{ id: "n" }] };
  const placement = computeEdgeLabelPlacement([{ x: 40, y: 60 }, { x: 112, y: 60 }], bounds);
  assert.equal(placement.side, "below"); assert.equal(placement.gap, 8); assert.equal(rectsIntersectForTest(placement.rect, nodeRect(bounds.positions.get("n"), 0)), false);
});

function rectsIntersectForTest(a, b) { return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }

test("editorial-svg respeta direcciones TB BT LR RL", () => {
  for (const [direction, relation, sourceSide, targetSide] of [["TB", (a, b) => b.y > a.y, "bottom", "top"], ["BT", (a, b) => b.y < a.y, "top", "bottom"], ["LR", (a, b) => b.x > a.x, "right", "left"], ["RL", (a, b) => b.x < a.x, "left", "right"]]) {
    const graph = { ...spec(), model: { direction, nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }], edges: [{ from: "a", to: "b" }] } };
    const layout = layoutEditorialGraph(graph); const sourceSlots = groupSlots(layout.edges, edge => `${edge.from}-source`); const targetSlots = groupSlots(layout.edges, edge => `${edge.to}-target`); const anchors = connectorAnchors(layout, graph.model.edges[0], 0, sourceSlots, targetSlots); const route = chooseConnectorRoute(layout, graph.model.edges[0], anchors.source, anchors.target);
    assert.ok(relation(layout.positions.get("a"), layout.positions.get("b")), direction); assert.equal(anchors.sides.source, sourceSide); assert.equal(anchors.sides.target, targetSide); assert.deepEqual(route[0], anchors.source); assert.deepEqual(route.at(-1), anchors.target);
    assert.match(renderEditorialSvg(graph), new RegExp(`fig-editorial-edge-0`));
  }
});

test("editorial-svg rechaza direcciones desconocidas", () => {
  assert.throws(() => renderEditorialSvg({ ...spec(), model: { direction: "DIAGONAL", nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }], edges: [{ from: "a", to: "b" }] } }), /direction=DIAGONAL/);
});

test("editorial-svg evita atravesar nodos no relacionados", () => {
  const graph = { ...spec(), model: { nodes: [{ id: "a", label: "A" }, { id: "x", label: "X" }, { id: "b", label: "B" }], edges: [{ from: "a", to: "b" }] } };
  const layout = layoutEditorialGraph(graph); const edge = graph.model.edges[0]; const sides = connectorSides(layout.direction); layout.height = 480; layout.positions.set("a", { x: 120, y: 80 }); layout.positions.set("x", { x: 120, y: 240 }); layout.positions.set("b", { x: 120, y: 400 });
  const source = anchorPoint(layout.positions.get("a"), sides.source, 0); const target = anchorPoint(layout.positions.get("b"), sides.target, 0);
  const primary = buildPrimaryRoute(layout, source, target); assert.equal(routeIntersectsForeignNode(primary, layout, edge), true);
  const chosen = chooseConnectorRoute(layout, edge, source, target); assert.equal(routeIntersectsForeignNode(chosen, layout, edge), false); assert.notEqual(routeKey(primary), routeKey(chosen));
  assert.match(renderEditorialSvg(graph), /fig-editorial-edge-0/);
});

test("editorial-svg respeta anchors múltiples y el eje de detours", () => {
  const graph = { ...spec(), model: { nodes: ["A", "B", "C", "D", "E"].map(id => ({ id: id.toLowerCase(), label: id })), edges: [{ from: "a", to: "b" }, { from: "a", to: "c" }, { from: "a", to: "d" }, { from: "b", to: "e" }, { from: "c", to: "e" }, { from: "d", to: "e" }] } };
  const layout = layoutEditorialGraph(graph); const sides = connectorSides("TB");
  const sourceOffsets = graph.model.edges.slice(0, 3).map((edge, i) => anchorPoint(layout.positions.get(edge.from), sides.source, [-16, 0, 16][i]));
  assert.equal(new Set(sourceOffsets.map(point => `${point.x},${point.y}`)).size, 3);
  assert.ok(Math.min(...sourceOffsets.slice(1).map((p, i) => Math.abs(p.x - sourceOffsets[i].x))) >= 12);
  const vertical = buildDetourRoutes(layout, sourceOffsets[0], anchorPoint(layout.positions.get("b"), sides.target, 0))[0];
  assert.ok(vertical.some((point, i) => i && point.x !== vertical[i - 1].x));
  const horizontalGraph = { ...graph, model: { ...graph.model, direction: "LR", nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }] , edges: [{ from: "a", to: "b" }] } };
  const horizontalLayout = layoutEditorialGraph(horizontalGraph); const hs = connectorSides("LR"); const hr = buildDetourRoutes(horizontalLayout, anchorPoint(horizontalLayout.positions.get("a"), hs.source, 0), anchorPoint(horizontalLayout.positions.get("b"), hs.target, 0))[0];
  assert.ok(hr.some((point, i) => i && point.y !== hr[i - 1].y));
});

test("editorial-svg mantiene separacion minima entre capas", () => {
  for (const direction of ["TB", "BT", "LR", "RL"]) {
    const graph = { ...spec(), model: { direction, nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }], edges: [{ from: "a", to: "b" }] } };
    const layout = layoutEditorialGraph(graph); const a = nodeRect(layout.positions.get("a"), 0); const b = nodeRect(layout.positions.get("b"), 0);
    const horizontal = direction === "LR" || direction === "RL"; const centerDistance = horizontal ? Math.abs(layout.positions.get("b").x - layout.positions.get("a").x) : Math.abs(layout.positions.get("b").y - layout.positions.get("a").y); const gap = horizontal ? Math.max(a.left - b.right, b.left - a.right) : Math.max(a.top - b.bottom, b.top - a.bottom);
    assert.equal(centerDistance, horizontal ? HORIZONTAL_LAYER_STEP : VERTICAL_LAYER_STEP); assert.equal(gap, horizontal ? 40 : 56); assert.equal(NODE_WIDTH, 160); assert.equal(NODE_HEIGHT, 64);
  }
});

test("editorial-svg separa anchors source y target con slots reales", () => {
  const graph = { ...spec(), model: { nodes: ["A", "B", "C", "D", "E"].map(id => ({ id: id.toLowerCase(), label: id })), edges: [{ from: "a", to: "b" }, { from: "a", to: "c" }, { from: "a", to: "d" }, { from: "b", to: "e" }, { from: "c", to: "e" }, { from: "d", to: "e" }] } };
  const layout = layoutEditorialGraph(graph); const sourceSlots = groupSlots(layout.edges, edge => `${edge.from}-source`); const targetSlots = groupSlots(layout.edges, edge => `${edge.to}-target`); const anchors = layout.edges.map((edge, index) => connectorAnchors(layout, edge, index, sourceSlots, targetSlots));
  const sources = anchors.slice(0, 3).map(anchor => `${anchor.source.x},${anchor.source.y}`); const targets = anchors.slice(3).map(anchor => `${anchor.target.x},${anchor.target.y}`);
  assert.equal(new Set(sources).size, 3); assert.equal(new Set(targets).size, 3); assert.deepEqual(sources.map(value => Number(value.split(",")[0])), [104, 120, 136]); assert.deepEqual(targets.map(value => Number(value.split(",")[0])), [104, 120, 136]);
});

test("editorial-svg usa midpoint correcto en rutas primarias verticales y horizontales", () => {
  for (const direction of ["TB", "BT", "LR", "RL"]) {
    const graph = { ...spec(), model: { direction, nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }], edges: [{ from: "a", to: "b" }] } }; const layout = layoutEditorialGraph(graph); const sides = connectorSides(direction);
    const route = buildPrimaryRoute(layout, anchorPoint(layout.positions.get("a"), sides.source, 0), anchorPoint(layout.positions.get("b"), sides.target, 0));
    assert.ok(route.every((point, i) => i === 0 || point.x === route[i - 1].x || point.y === route[i - 1].y));
    if (direction === "TB" || direction === "BT") assert.ok(route.every(point => point.x === route[0].x));
    else assert.ok(route.every(point => point.y === route[0].y));
  }
});

test("editorial-svg usa midpoint exacto con source y target no alineados", () => {
  assert.deepEqual(buildPrimaryRoute({ direction: "TB" }, { x: 100, y: 100 }, { x: 220, y: 300 }), [{ x: 100, y: 100 }, { x: 100, y: 200 }, { x: 220, y: 200 }, { x: 220, y: 300 }]);
  assert.deepEqual(buildPrimaryRoute({ direction: "LR" }, { x: 100, y: 100 }, { x: 300, y: 220 }), [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 220 }, { x: 300, y: 220 }]);
  assert.deepEqual(buildPrimaryRoute({ direction: "BT" }, { x: 100, y: 300 }, { x: 220, y: 100 }), [{ x: 100, y: 300 }, { x: 100, y: 200 }, { x: 220, y: 200 }, { x: 220, y: 100 }]);
  assert.deepEqual(buildPrimaryRoute({ direction: "RL" }, { x: 300, y: 100 }, { x: 100, y: 220 }), [{ x: 300, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 220 }, { x: 100, y: 220 }]);
});

test("editorial-svg usa X para detours verticales y Y para detours horizontales", () => {
  assert.deepEqual(buildDetourRoutes({ direction: "TB", width: 400, height: 400 }, { x: 120, y: 100 }, { x: 220, y: 300 })[0], [{ x: 120, y: 100 }, { x: 120, y: 116 }, { x: 16, y: 116 }, { x: 16, y: 284 }, { x: 220, y: 284 }, { x: 220, y: 300 }]);
  assert.deepEqual(buildDetourRoutes({ direction: "LR", width: 400, height: 400 }, { x: 100, y: 120 }, { x: 300, y: 220 })[0], [{ x: 100, y: 120 }, { x: 116, y: 120 }, { x: 116, y: 16 }, { x: 284, y: 16 }, { x: 284, y: 220 }, { x: 300, y: 220 }]);
});

test("editorial-svg redondea esquinas HV y VH", () => {
  assert.match(roundedOrthogonalPath([{ x: 0, y: 0 }, { x: 32, y: 0 }, { x: 32, y: 32 }]), /Q 32 0 32 8/);
  assert.match(roundedOrthogonalPath([{ x: 0, y: 0 }, { x: 0, y: 32 }, { x: 32, y: 32 }]), /Q 0 32 8 32/);
});

test("editorial-svg falla cuando no existe canal ortogonal seguro", () => {
  const edge = { from: "a", to: "b" }; const source = { x: 120, y: 100 }; const target = { x: 220, y: 300 }; const blockers = [{ id: "primary", x: 120, y: 200 }, { id: "detour-left", x: 80, y: 116 }, { id: "detour-right", x: 300, y: 116 }];
  const layout = { direction: "TB", width: 400, height: 400, nodes: [{ id: "a" }, { id: "b" }, ...blockers], positions: new Map([["a", { x: 120, y: 68 }], ["b", { x: 220, y: 332 }], ...blockers.map(node => [node.id, { x: node.x, y: node.y }])]) };
  const primary = buildPrimaryRoute(layout, source, target); const detours = buildDetourRoutes(layout, source, target);
  assert.equal(routeIsSafe(primary, layout, edge), false); assert.equal(detours.length, 4); detours.forEach(candidate => assert.equal(routeIsSafe(candidate, layout, edge), false));
  assert.throws(() => chooseConnectorRoute(layout, edge, source, target), /no puede enrutar a -> b/);
});

test("editorial-svg nunca elimina etiqueta y contextualiza etiqueta imposible", () => {
  const graph = { ...spec(), model: { nodes: [{ id: "a", label: "A" }, { id: "x", label: "X" }, { id: "b", label: "B" }], edges: [{ from: "a", to: "x" }, { from: "x", to: "b" }, { from: "a", to: "b", label: "relacion" }] } };
  const before = structuredClone(graph); const svg = renderEditorialSvg(graph); assert.match(svg, />relacion<\/text>/); assert.deepEqual(graph, before);
  assert.throws(() => computeEdgeLabelPlacement([{ x: 0, y: 0 }, { x: 40, y: 0 }], { width: 200, height: 100, positions: new Map(), nodes: [] }, "a -> b"), /etiqueta de a -> b sin cubrir el conector/);
});

test("editorial-svg es determinista con detour y etiqueta sin mutar input", () => {
  const input = { ...spec(), model: { direction: "TB", nodes: [{ id: "a", label: "A" }, { id: "x", label: "X" }, { id: "b", label: "B" }], edges: [{ from: "a", to: "x" }, { from: "x", to: "b" }, { from: "a", to: "b", label: "relacion" }] } };
  const before = structuredClone(input); const first = renderEditorialSvg(input); const second = renderEditorialSvg(input); const layout = layoutEditorialGraph(input); const sourceSlots = groupSlots(layout.edges, edge => `${edge.from}-source`); const targetSlots = groupSlots(layout.edges, edge => `${edge.to}-target`); const edge = input.model.edges[2]; const anchors = connectorAnchors(layout, edge, 2, sourceSlots, targetSlots); const primary = buildPrimaryRoute(layout, anchors.source, anchors.target); const chosen = chooseConnectorRoute(layout, edge, anchors.source, anchors.target);
  assert.equal(first, second); assert.deepEqual(input, before); assert.match(first, />relacion<\/text>/); assert.equal(routeIntersectsForeignNode(primary, layout, edge), true); assert.equal(routeIntersectsForeignNode(chosen, layout, edge), false); assert.notEqual(routeKey(primary), routeKey(chosen));
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
