"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { selectEngine, candidatesFor, analyzeModel } = require("../scripts/visual-selector");
const { validateSpec, latexBlock, prepareHtmlCapture } = require("../scripts/visual-renderer");
const { detectCapabilities } = require("../scripts/visual-capabilities");
const { inspectFile } = require("../scripts/visual-inspector");
const { hashes } = require("../scripts/visual-regression");
const {
  graphviz, mermaid, d2, vegaLite, forestPlot, geoMap, wavedrom, rdkit,
  matplotlib, geopandas, tikz, canGenerateFromModel,
  plantuml, circuitikz, chemfig, forest, sankeyHtml, freeBodyDiagram
} = require("../scripts/visual-source-generator");
const { expandProgressive } = require("../scripts/visual-progressive");
const { encodePng, decodePng, comparePng } = require("../scripts/png-compare");
const { contrastRatio, inspectSvg, inspectHtml } = require("../scripts/visual-quality");

test("elige Vega-Lite para datos cuantitativos", () => {
  assert.equal(selectEngine({ representation: "chart" }), "vega-lite");
});

test("elige Graphviz para redes y editorial-svg para flujos simples", () => {
  assert.equal(selectEngine({ representation: "network" }), "graphviz");
  assert.equal(selectEngine({ representation: "flowchart", complexity: "low" }), "editorial-svg");
  assert.equal(selectEngine({ discipline: "health", representation: "flowchart" }), "editorial-svg");
  assert.equal(selectEngine({ discipline: "technology", representation: "technical-diagram" }), "editorial-svg");
  assert.equal(selectEngine({ representation: "concept-map", model: { nodes: [{ id: "a", label: "A" }], edges: [] } }), "editorial-svg");
  assert.equal(selectEngine({ representation: "argument-map", model: { nodes: [{ id: "a", label: "A" }], edges: [] } }), "editorial-svg");
  assert.equal(selectEngine({ representation: "curriculum-map", model: { nodes: [{ id: "a", label: "A" }], edges: [] } }), "editorial-svg");
});

test("elige Graphviz para causalidad y conserva solo fallbacks ejecutables", () => {
  assert.equal(selectEngine({ representation: "causal-diagram" }), "graphviz");
  assert.deepEqual(candidatesFor({ representation: "causal-diagram" }), ["graphviz", "mermaid", "tikz"]);
});

test("la notación formal no se degrada a un motor distinto", () => {
  assert.deepEqual(candidatesFor({
    representation: "causal-diagram",
    formalNotationRequired: true,
    engine: "graphviz"
  }), ["graphviz"]);
});

test("respeta notación disciplinar formal", () => {
  assert.equal(selectEngine({
    representation: "disciplinary-notation",
    discipline: "chemistry",
    formalNotationRequired: true
  }), "chemfig");
  assert.equal(selectEngine({ representation: "technical-diagram", discipline: "technology", formalNotationRequired: true }), "plantuml");
  assert.equal(selectEngine({ representation: "electrical-circuit", discipline: "electronics", formalNotationRequired: true }), "circuitikz");
  assert.equal(selectEngine({ representation: "signal-diagram", discipline: "electronics" }), "wavedrom");
  assert.equal(selectEngine({ representation: "uml", formalNotationRequired: true }), "plantuml");
  assert.equal(selectEngine({ representation: "c4", formalNotationRequired: true }), "plantuml");
  assert.equal(selectEngine({ representation: "chart" }), "vega-lite");
});

test("expone fallbacks en orden", () => {
  assert.deepEqual(candidatesFor({ representation: "chart" }), ["vega-lite", "matplotlib", "tikz"]);
  assert.deepEqual(candidatesFor({ engine: "d2" }), ["d2", "graphviz", "tikz"]);
});

test("el registro de capacidades conserva todos los motores declarados", () => {
  const capabilities = detectCapabilities();
  assert.equal(capabilities.version, 1);
  assert.ok(capabilities.tools.graphviz.supports.includes("graphviz"));
  assert.ok(capabilities.tools.chrome.supports.includes("html"));
  assert.equal(capabilities.tools.chrome.version, null);
  assert.equal(typeof capabilities.tools.latex.available, "boolean");
});

test("el detector no ejecuta un probe de versión que abra Chrome", () => {
  const registry = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, "..", "config", "visual-tools.json"),
    "utf8"
  ));
  assert.equal(registry.tools.chrome.versionProbe, false);
});

test("la especificación exige accesibilidad y tabla para gráficos", () => {
  const errors = validateSpec({
    id: "fig-resultados",
    pedagogicalIntent: "quantify",
    representation: "chart",
    altText: "Barras por categoría",
    source: { content: "{}" }
  });
  assert.ok(errors.some(error => error.includes("dataTable")));
  assert.deepEqual(validateSpec({
    id: "fig-resultados",
    pedagogicalIntent: "quantify",
    representation: "chart",
    altText: "Las barras muestran un aumento sostenido por categoría.",
    provenance: "original",
    dataTable: "data/resultados.csv",
    source: { content: "{}" }
  }), []);
  assert.deepEqual(validateSpec({
    id: "fig-modelo",
    pedagogicalIntent: "quantify",
    representation: "chart",
    altText: "Las barras comparan dos categorías con valores diferentes.",
    provenance: "original",
    model: { categories: ["A", "B"], values: [2, 5] }
  }), []);
});

test("el renderer genera una tabla CSV accesible desde el modelo", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-chart-"));
  const specs = path.join(root, "figure", "specs");
  fs.mkdirSync(specs, { recursive: true });
  const specPath = path.join(specs, "fig-casos.json");
  fs.writeFileSync(specPath, JSON.stringify({
    id: "fig-casos",
    pedagogicalIntent: "quantify",
    representation: "chart",
    altText: "Las barras comparan cinco y siete casos entre dos regiones.",
    provenance: "original",
    model: { categories: ["Norte", "Sur"], values: [5, 7] }
  }));
  const renderer = path.resolve(__dirname, "..", "scripts", "visual-renderer.js");
  const result = spawnSync(process.execPath, [renderer, "--spec", specPath, "--dry-run"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "figure", "manifest.json"), "utf8"));
  assert.equal(manifest.figures[0].dataTable, "data/fig-casos.csv");
  assert.match(fs.readFileSync(path.join(root, "figure", "data", "fig-casos.csv"), "utf8"), /Norte,5/);
});

test("el esquema rechaza propiedades desconocidas y motores inválidos", () => {
  const errors = validateSpec({
    id: "fig-red",
    pedagogicalIntent: "relate",
    representation: "network",
    engine: "herramienta-inventada",
    altText: "La red conecta tres entidades mediante relaciones dirigidas.",
    source: { content: "digraph { a -> b }" },
    desconocido: true
  });
  assert.ok(errors.some(error => error.includes("valor no permitido")));
  assert.ok(errors.some(error => error.includes("propiedad no permitida")));
});

test("genera fuentes de grafo desde un modelo neutral", () => {
  const model = {
    direction: "LR",
    nodes: [{ id: "resultado", label: "Resultado" }, { id: "evidencia", label: "Evidencia" }],
    edges: [{ from: "resultado", to: "evidencia", label: "se demuestra" }]
  };
  assert.match(graphviz(model), /rankdir=LR/);
  assert.match(graphviz(model), /resultado -> evidencia/);
  assert.match(mermaid(model), /flowchart LR/);
  assert.match(mermaid(model), /resultado -->\|se demuestra\| evidencia/);
});

test("genera Vega-Lite con eje cero y datos embebidos", () => {
  const spec = JSON.parse(vegaLite({
    categories: ["A", "B"],
    values: [2, 5],
    yTitle: "Casos"
  }, "Comparación de casos."));
  assert.deepEqual(spec.data.values, [{ category: "A", value: 2 }, { category: "B", value: 5 }]);
  assert.equal(spec.encoding.y.scale.zero, true);
});

test("genera líneas, histogramas y mapas de calor en Vega-Lite", () => {
  const line = JSON.parse(vegaLite({
    chartType: "line",
    data: [{ periodo: 1, valor: 4 }, { periodo: 2, valor: 7 }],
    xField: "periodo",
    yField: "valor"
  }, "Serie temporal."));
  assert.equal(line.mark.type, "line");
  assert.equal(line.encoding.x.field, "periodo");
  const histogram = JSON.parse(vegaLite({
    chartType: "histogram",
    data: [{ valor: 4 }, { valor: 7 }],
    xField: "valor"
  }, "Distribución."));
  assert.equal(histogram.encoding.x.bin, true);
  const heatmap = JSON.parse(vegaLite({
    chartType: "heatmap",
    data: [{ fila: "A", columna: "B", valor: 2 }],
    xField: "columna",
    yField: "fila",
    valueField: "valor"
  }, "Matriz."));
  assert.equal(heatmap.mark.type, "rect");
  assert.equal(heatmap.encoding.color.field, "valor");
});

test("mide complejidad estructural antes de seleccionar el motor", () => {
  const metrics = analyzeModel({
    model: {
      nodes: [{ id: "a", label: "Inicio principal" }, { id: "b", label: "Resultado final" }],
      edges: [{ from: "a", to: "b" }]
    }
  });
  assert.equal(metrics.nodeCount, 2);
  assert.equal(metrics.edgeCount, 1);
  assert.ok(metrics.averageLabelWords >= 2);
});

test("usa las métricas avanzadas para elegir motor", () => {
  assert.equal(selectEngine({ representation: "flowchart", model: { requiresExactCoordinates: true } }), "tikz");
  assert.equal(selectEngine({ representation: "flowchart", model: { hierarchyDepth: 6 } }), "graphviz");
  assert.equal(selectEngine({ representation: "flowchart", model: { nodes: Array.from({ length: 13 }, (_, i) => ({ id: `n${i}`, label: "Nodo" })), edges: [] } }), "graphviz");
  assert.equal(selectEngine({ representation: "flowchart", model: { nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }], edges: Array.from({ length: 17 }, () => ({ from: "a", to: "b" })) } }), "graphviz");
  assert.equal(selectEngine({ representation: "flowchart", model: { nodes: [{ id: "a", label: "uno dos tres cuatro cinco seis siete ocho nueve" }], edges: [] } }), "graphviz");
  assert.equal(selectEngine({ representation: "flowchart", model: { nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }], edges: Array.from({ length: 7 }, () => ({ from: "a", to: "b" })) } }), "graphviz");
  assert.equal(selectEngine({ representation: "argument-map", model: { nodes: [{ id: "a" }, { id: "b" }], edges: [{ from: "a", to: "b" }, { from: "a", to: "b" }, { from: "a", to: "b" }, { from: "a", to: "b" }, { from: "a", to: "b" }] } }), "graphviz");
  assert.equal(selectEngine({ representation: "timeline", model: { events: [{ date: "2024-01-01", label: "Inicio", value: 1 }] } }), "vega-lite");
});

test("genera fallbacks reales de Matplotlib, GeoPandas y TikZ", () => {
  const chart = { categories: ["A", "B"], values: [2, 5], chartType: "line" };
  assert.match(matplotlib(chart, { representation: "chart" }), /ax\.plot/);
  assert.match(tikz(chart, { representation: "chart" }), /\\begin\{axis\}/);
  assert.match(geopandas({
    valueField: "casos",
    geojson: { type: "FeatureCollection", features: [] }
  }), /GeoDataFrame\.from_features/);
  assert.equal(canGenerateFromModel("matplotlib", "chart"), true);
  assert.equal(canGenerateFromModel("matplotlib", "map"), false);
});

test("genera notaciones disciplinares desde modelos neutrales", () => {
  assert.match(plantuml({
    diagramType: "class",
    nodes: [{ id: "curso", label: "Curso" }, { id: "unidad", label: "Unidad" }],
    edges: [{ from: "curso", to: "unidad", label: "contiene" }]
  }), /@startuml[\s\S]*curso --> unidad/);
  assert.match(circuitikz({
    components: [{ id: "r1", type: "resistor", from: [0, 0], to: [2, 0], value: "10 kΩ" }]
  }), /to\[R,l=\{10 kΩ\}\]/);
  assert.match(chemfig({ formula: "H-O-H" }), /\\chemfig\{H-O-H\}/);
  assert.match(forest({
    nodes: [
      { id: "s", label: "S" },
      { id: "np", label: "NP", parent: "s" },
      { id: "vp", label: "VP", parent: "s" }
    ]
  }), /\[S \[NP \] \[VP \]\]/);
});

test("genera las representaciones avanzadas declaradas desde modelos neutrales", () => {
  assert.equal(selectEngine({ representation: "bpmn" }), "graphviz");
  assert.equal(selectEngine({ representation: "c4" }), "plantuml");
  assert.equal(selectEngine({ representation: "sankey" }), "html");
  assert.equal(selectEngine({ representation: "argument-map" }), "editorial-svg");
  assert.equal(selectEngine({ representation: "curriculum-map" }), "editorial-svg");
  assert.equal(selectEngine({ representation: "free-body-diagram" }), "tikz");
  assert.equal(canGenerateFromModel("graphviz", "bpmn"), true);
  assert.equal(canGenerateFromModel("plantuml", "c4"), true);
  assert.equal(canGenerateFromModel("html", "sankey"), true);
  assert.equal(canGenerateFromModel("tikz", "free-body-diagram"), true);
  assert.match(plantuml({ diagramType: "c4", nodes: [{ id: "web", label: "Web", kind: "container" }], edges: [] }), /Container\(web/);
  assert.match(sankeyHtml({ links: [{ source: "a", target: "b", value: 4 }] }), /<svg/);
  assert.match(freeBodyDiagram({ forces: [{ angle: 90, magnitude: 2, label: "Peso" }] }), /Peso/);
  const timeline = JSON.parse(vegaLite({ events: [{ date: "2024-01-01", label: "Inicio", value: 2 }] }, "Cronología."));
  assert.equal(timeline.data.values[0].value, 2);
  assert.equal(timeline.encoding.x.type, "temporal");
});

test("la plantilla rechaza placements que no soporta", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-template-"));
  const specs = path.join(root, "figure", "specs");
  fs.mkdirSync(specs, { recursive: true });
  const specPath = path.join(specs, "fig-margen.json");
  fs.writeFileSync(specPath, JSON.stringify({
    id: "fig-margen",
    pedagogicalIntent: "relate",
    representation: "network",
    placement: "margin",
    altText: "La red muestra relaciones principales entre tres conceptos.",
    model: {
      nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
      edges: [{ from: "a", to: "b" }]
    }
  }));
  const renderer = path.resolve(__dirname, "..", "scripts", "visual-renderer.js");
  const result = spawnSync(process.execPath, [
    renderer, "--spec", specPath, "--template", "jintia-clasico", "--dry-run"
  ], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /no admite figuras marginales/);
});

test("genera un adaptador RDKit reproducible desde SMILES", () => {
  const source = rdkit({ smiles: "CCO" });
  assert.match(source, /MolFromSmiles/);
  assert.match(source, /JINTIA_VISUAL_OUTPUT/);
  assert.match(source, /"CCO"/);
});

test("genera cronologías y señales desde modelos neutrales", () => {
  assert.match(d2({
    events: [
      { date: "1990", label: "Inicio" },
      { date: "2000", label: "Reforma" }
    ]
  }), /event_1 -> event_2/);
  const signal = JSON.parse(wavedrom({
    signals: [{ name: "clk", wave: "p...." }, { name: "data", wave: "x.345", data: "A B C" }]
  }));
  assert.equal(signal.signal[1].data, "A B C");
});

test("genera forest plots con intervalos y rechaza intervalos imposibles", () => {
  const source = JSON.parse(forestPlot({
    estimates: [{ label: "Estudio A", estimate: 1.2, lower: 0.9, upper: 1.5 }]
  }, "Estimaciones."));
  assert.equal(source.layer[0].encoding.x2.field, "upper");
  assert.throws(() => forestPlot({
    estimates: [{ label: "Error", estimate: 2, lower: 3, upper: 4 }]
  }, "Error"), /Intervalo inválido/);
});

test("genera mapas Vega-Lite desde GeoJSON verificable", () => {
  const source = JSON.parse(geoMap({
    valueField: "casos",
    geojson: {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: { name: "Norte", casos: 5 },
        geometry: { type: "Polygon", coordinates: [] }
      }]
    }
  }, "Casos por región."));
  assert.equal(source.mark.type, "geoshape");
  assert.equal(source.encoding.color.field, "properties.casos");
});

test("expande una figura progresiva acumulando nodos y relaciones", () => {
  const stages = expandProgressive({
    id: "fig-proceso",
    pedagogicalIntent: "sequence",
    representation: "flowchart",
    altText: "Secuencia acumulativa del proceso.",
    model: {
      nodes: [
        { id: "a", label: "Inicio" },
        { id: "b", label: "Análisis" },
        { id: "c", label: "Decisión" }
      ],
      edges: [{ from: "a", to: "b" }, { from: "b", to: "c" }],
      stages: [
        { id: "inicio", label: "Inicio", nodeIds: ["a"] },
        { id: "analisis", label: "Análisis", nodeIds: ["b"] },
        { id: "decision", label: "Decisión", nodeIds: ["c"] }
      ]
    }
  });
  assert.equal(stages.length, 3);
  assert.equal(stages[1].model.nodes.length, 2);
  assert.equal(stages[2].model.edges.length, 2);
  assert.equal(stages[2].id, "fig-proceso-03-decision");
});

test("rechaza dependencias remotas en figuras HTML", () => {
  const errors = validateSpec({
    id: "fig-ui",
    pedagogicalIntent: "simulate",
    representation: "interface",
    engine: "html",
    altText: "Formulario con una acción principal claramente identificada.",
    source: { content: "<script src=\"https://cdn.example/app.js\"></script>" }
  });
  assert.ok(errors.some(error => error.includes("autosuficiente")));
});

test("prepara la captura de un elemento HTML específico", () => {
  const html = prepareHtmlCapture(
    "<main><section id=\"objetivo\">Contenido</section><aside>Excluir</aside></main>",
    { selector: "#objetivo", width: 640, height: 360 }
  );
  assert.match(html, /querySelector\(c\.selector\)/);
  assert.match(html, /replaceChildren\(clone\)/);
  assert.match(html, /"width":640/);
});

test("genera el bloque LaTeX portable", () => {
  const block = latexBlock({
    rendered: "rendered/fig-red.pdf",
    templatePlacement: "wide",
    caption: "Relaciones principales.",
    altText: "Relaciones principales entre nodos.",
    id: "fig-red"
  });
  assert.match(block, /\\begin\{guidefigure\}\[placement=wide\]/);
  assert.match(block, /\\guidefigurecaption\{Relaciones principales\.\}\{fig:red\}/);
});

test("el modo dry-run crea fuente y manifiesto sin fingir renderizado", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-visual-"));
  const specs = path.join(root, "figure", "specs");
  fs.mkdirSync(specs, { recursive: true });
  const specPath = path.join(specs, "fig-red.json");
  fs.writeFileSync(specPath, JSON.stringify({
    id: "fig-red",
    pedagogicalIntent: "relate",
    representation: "network",
    altText: "La red relaciona resultados, práctica y evidencia observable.",
    source: { content: "digraph { resultado -> evidencia }" }
  }));
  const renderer = path.resolve(__dirname, "..", "scripts", "visual-renderer.js");
  const result = spawnSync(process.execPath, [renderer, "--spec", specPath, "--dry-run"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "figure", "manifest.json"), "utf8"));
  assert.equal(manifest.figures[0].status, "planned");
  assert.ok(fs.existsSync(path.join(root, "figure", manifest.figures[0].source)));
  assert.ok(!fs.existsSync(path.join(root, "figure", manifest.figures[0].rendered)));
});

test("el pipeline completo funciona con ambas plantillas", {
  skip: !detectCapabilities().tools.graphviz.available
}, () => {
  for (const template of ["jintia-clasico", "jintia-cuaderno"]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `jintia-pipeline-${template}-`));
    const specs = path.join(root, "figure", "specs");
    fs.mkdirSync(specs, { recursive: true });
    const specPath = path.join(specs, "fig-ruta.json");
    fs.writeFileSync(specPath, JSON.stringify({
      id: "fig-ruta",
      pedagogicalIntent: "relate",
      representation: "network",
      engine: "graphviz",
      altText: "La red conecta el objetivo formativo con su evidencia observable.",
      model: {
        nodes: [{ id: "objetivo", label: "Objetivo" }, { id: "evidencia", label: "Evidencia" }],
        edges: [{ from: "objetivo", to: "evidencia" }]
      }
    }));
    const pipeline = path.resolve(__dirname, "..", "scripts", "visual-pipeline.js");
    const result = spawnSync(process.execPath, [
      pipeline, "--spec", specPath, "--template", template
    ], { encoding: "utf8", timeout: 30000 });
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "figure", "manifest.json"), "utf8"));
    assert.equal(manifest.figures[0].template, template);
    assert.equal(manifest.figures[0].inspection.valid, true);
  }
});

test("Chrome renderiza una figura HTML real cuando está disponible", {
  skip: process.env.JINTIA_REAL_RENDER_TESTS !== "1" || !detectCapabilities().tools.chrome.available
}, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-html-"));
  const specs = path.join(root, "figure", "specs");
  fs.mkdirSync(specs, { recursive: true });
  const specPath = path.join(specs, "fig-interfaz.json");
  fs.writeFileSync(specPath, JSON.stringify({
    id: "fig-interfaz",
    pedagogicalIntent: "simulate",
    representation: "interface",
    engine: "html",
    outputFormat: "png",
    altText: "Formulario local con un campo y un botón de confirmación.",
    source: {
      content: "<!doctype html><meta charset=\"utf-8\"><style>*{animation:none!important}body{margin:0;background:white;font:24px Arial}main{width:500px;padding:40px}button{padding:16px;background:#00796b;color:white}</style><main><label>Nombre <input></label><button>Confirmar</button></main>"
    }
  }));
  const renderer = path.resolve(__dirname, "..", "scripts", "visual-renderer.js");
  const result = spawnSync(process.execPath, [renderer, "--spec", specPath], { encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "figure", "manifest.json"), "utf8"));
  const rendered = path.join(root, "figure", manifest.figures[0].rendered);
  assert.equal(inspectFile(rendered).valid, true);
  assert.equal(manifest.figures[0].status, "valid");
});

test("el inspector comprueba firma y dimensiones PNG", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-inspector-"));
  const png = path.join(root, "pixel.png");
  fs.writeFileSync(png, Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082",
    "hex"
  ));
  const result = inspectFile(png);
  assert.equal(result.valid, true);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.dimensions, { width: 1, height: 1, unit: "px" });
});

test("la regresión usa solo salidas inspeccionadas y válidas", () => {
  assert.deepEqual(hashes({
    figures: [
      { id: "fig-a", inspection: { valid: true, sha256: "abc" } },
      { id: "fig-b", inspection: { valid: false, sha256: "def" } },
      { id: "fig-c" }
    ]
  }), { "fig-a": "abc" });
});

test("compara PNG por contenido y genera una imagen diff", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-png-diff-"));
  const expected = path.join(root, "expected.png");
  const actual = path.join(root, "actual.png");
  const diff = path.join(root, "diff.png");
  const base = Buffer.alloc(4 * 4 * 4, 255);
  const changed = Buffer.from(base);
  changed[0] = 0;
  changed[1] = 0;
  changed[2] = 0;
  encodePng(expected, { width: 4, height: 4, data: base });
  encodePng(actual, { width: 4, height: 4, data: changed });
  const comparison = comparePng(actual, expected, diff);
  assert.equal(comparison.comparable, true);
  assert.equal(comparison.differenceRatio, 1 / 16);
  assert.equal(decodePng(diff).width, 4);
});

test("valida contraste WCAG y problemas semánticos de SVG", () => {
  assert.ok(contrastRatio("#000000", "#ffffff") > 20);
  assert.ok(contrastRatio("#777777", "#ffffff") < 4.5);
  const result = inspectSvg('<svg><text font-size="8">Texto</text></svg>');
  assert.ok(result.errors.some(error => error.includes("viewBox")));
  assert.ok(result.errors.some(error => error.includes("menor de 10")));
});

test("detecta recursos y animaciones no reproducibles en HTML", () => {
  const result = inspectHtml('<meta charset="utf-8"><style>@keyframes giro{}</style><script src="https://example.test/app.js"></script>');
  assert.ok(result.errors.some(error => error.includes("remoto")));
  assert.ok(result.errors.some(error => error.includes("animaciones")));
});
