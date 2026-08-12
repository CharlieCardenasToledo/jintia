"use strict";

const { renderEditorialSvg, supportsEditorialSpec } = require("./diagram-design-adapter");

function quoted(value) {
  return JSON.stringify(String(value));
}

function validateGraph(model) {
  const ids = new Set((model.nodes || []).map(node => node.id));
  if (ids.size !== (model.nodes || []).length) throw new Error("El modelo contiene ids de nodo duplicados.");
  for (const edge of model.edges || []) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) throw new Error(`Arista con nodo inexistente: ${edge.from} -> ${edge.to}`);
  }
}

function graphviz(model) {
  validateGraph(model);
  const direction = model.direction || "TB";
  const lines = ["digraph jintia {", `  rankdir=${direction};`, "  node [shape=box, style=\"rounded,filled\", fillcolor=\"#eef6f5\", color=\"#00796b\"];"];
  for (const node of model.nodes || []) lines.push(`  ${node.id} [label=${quoted(node.label)}];`);
  for (const edge of model.edges || []) lines.push(`  ${edge.from} -> ${edge.to}${edge.label ? ` [label=${quoted(edge.label)}]` : ""};`);
  return `${lines.join("\n")}\n}\n`;
}

function mermaid(model) {
  validateGraph(model);
  const lines = [`flowchart ${model.direction || "TB"}`];
  for (const node of model.nodes || []) lines.push(`  ${node.id}[${quoted(node.label)}]`);
  for (const edge of model.edges || []) lines.push(`  ${edge.from} -->${edge.label ? `|${edge.label}|` : ""} ${edge.to}`);
  return `${lines.join("\n")}\n`;
}

function d2(model) {
  if (Array.isArray(model.events)) {
    const lines = ["direction: right"];
    model.events.forEach((event, index) => {
      const id = `event_${index + 1}`;
      lines.push(`${id}: ${quoted(`${event.date}\\n${event.label}`)}`);
      if (index > 0) lines.push(`event_${index} -> ${id}`);
    });
    return `${lines.join("\n")}\n`;
  }
  validateGraph(model);
  const lines = [`direction: ${(model.direction || "TB").toLowerCase()}`];
  for (const node of model.nodes || []) lines.push(`${node.id}: ${quoted(node.label)}`);
  for (const edge of model.edges || []) lines.push(`${edge.from} -> ${edge.to}${edge.label ? `: ${quoted(edge.label)}` : ""}`);
  return `${lines.join("\n")}\n`;
}

function forestPlot(model, description) {
  if (!Array.isArray(model.estimates) || model.estimates.length === 0) {
    throw new Error("Forest plot requiere model.estimates.");
  }
  for (const item of model.estimates) {
    if (item.lower > item.estimate || item.estimate > item.upper) {
      throw new Error(`Intervalo inválido para ${item.label}.`);
    }
  }
  return `${JSON.stringify({
    "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
    description,
    data: { values: model.estimates },
    layer: [
      {
        mark: { type: "rule", strokeWidth: 2 },
        encoding: {
          y: { field: "label", type: "nominal", sort: null, title: null },
          x: { field: "lower", type: "quantitative", title: model.xTitle || "Estimación e intervalo" },
          x2: { field: "upper" }
        }
      },
      {
        mark: { type: "point", filled: true, size: 90 },
        encoding: {
          y: { field: "label", type: "nominal", sort: null },
          x: { field: "estimate", type: "quantitative" },
          tooltip: [
            { field: "label" },
            { field: "estimate", type: "quantitative" },
            { field: "lower", type: "quantitative" },
            { field: "upper", type: "quantitative" }
          ]
        }
      }
    ]
  }, null, 2)}\n`;
}

function geoMap(model, description) {
  if (model.geojson?.type !== "FeatureCollection" || !Array.isArray(model.geojson.features)) {
    throw new Error("Mapa requiere model.geojson como FeatureCollection.");
  }
  const field = model.valueField || "value";
  return `${JSON.stringify({
    "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
    description,
    data: { values: model.geojson.features },
    mark: { type: "geoshape", stroke: "#ffffff", strokeWidth: 0.5 },
    projection: { type: "mercator" },
    encoding: {
      color: {
        field: `properties.${field}`,
        type: "quantitative",
        title: field,
        scale: { scheme: "tealblues" }
      },
      tooltip: [
        { field: "properties.name", type: "nominal", title: "Región" },
        { field: `properties.${field}`, type: "quantitative", title: field }
      ]
    }
  }, null, 2)}\n`;
}

function wavedrom(model) {
  if (!Array.isArray(model.signals) || model.signals.length === 0) {
    throw new Error("WaveDrom requiere model.signals.");
  }
  return `${JSON.stringify({
    signal: model.signals.map(signal => ({
      name: signal.name,
      wave: signal.wave,
      ...(signal.data ? { data: signal.data } : {})
    }))
  }, null, 2)}\n`;
}

function vegaLite(model, description) {
  const chartType = model.chartType || "bar";
  const data = Array.isArray(model.events)
    ? model.events.map(event => ({ date: event.date, label: event.label, value: event.value }))
    : Array.isArray(model.data)
    ? model.data
    : (model.categories || []).map((category, index) => ({ category, value: model.values?.[index] }));
  if (!data.length) throw new Error("Vega-Lite requiere model.data o categories/values.");
  const eventTimeline = Array.isArray(model.events);
  const xField = model.xField || (eventTimeline ? "date" : (["histogram", "boxplot"].includes(chartType) ? "value" : "category"));
  const yField = model.yField || (["histogram", "boxplot"].includes(chartType) ? null : "value");
  const mark = {
    scatter: "point",
    interval: "rule",
    heatmap: "rect"
  }[chartType] || chartType;
  const encoding = {
    x: {
      field: xField,
      type: eventTimeline ? "temporal" : (["bar", "point"].includes(chartType) && !model.xField ? "nominal" : "quantitative"),
      title: model.xTitle || model.units || "Categoría",
      ...(chartType === "histogram" ? { bin: true } : {}),
      ...(xField === "category" ? { sort: null } : {})
    }
  };
  if (yField) {
    encoding.y = {
      field: yField,
      type: "quantitative",
      title: model.yTitle || model.units || "Valor",
      scale: { zero: model.zeroBaseline !== false }
    };
  }
  if (model.groupField) encoding.color = { field: model.groupField, type: "nominal" };
  if (model.facetField) encoding.facet = { field: model.facetField, type: "nominal" };
  if (chartType === "heatmap") {
    encoding.color = { field: model.valueField || "value", type: "quantitative" };
  }
  if (chartType === "interval") {
    encoding.x2 = { field: model.upperField || "upper" };
  }
  return `${JSON.stringify({
    "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
    description,
    data: { values: data },
    mark: { type: mark },
    encoding: {
      ...encoding,
      tooltip: Object.keys(data[0]).map(field => ({ field }))
    }
  }, null, 2)}\n`;
}

function matplotlib(model, spec) {
  const chartType = model.chartType || "bar";
  const supported = new Set(["bar", "line", "point", "scatter", "area", "histogram", "boxplot"]);
  if (!supported.has(chartType)) throw new Error(`Matplotlib no admite chartType=${chartType}.`);
  const categories = model.categories || [];
  const values = model.values || [];
  if (!Array.isArray(values) || values.length === 0) throw new Error("Matplotlib requiere model.values.");
  if (categories.length && categories.length !== values.length) {
    throw new Error("Matplotlib requiere categories y values con la misma longitud.");
  }
  const plot = {
    bar: "ax.bar(categories, values)",
    line: "ax.plot(categories, values, marker='o')",
    point: "ax.scatter(categories, values)",
    scatter: "ax.scatter(categories, values)",
    area: "ax.fill_between(range(len(values)), values, alpha=0.45); ax.plot(range(len(values)), values); ax.set_xticks(range(len(categories)), categories)",
    histogram: "ax.hist(values, bins='auto')",
    boxplot: "ax.boxplot(values, vert=True)"
  }[chartType];
  return `import json
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

categories = json.loads(${JSON.stringify(JSON.stringify(categories))})
values = json.loads(${JSON.stringify(JSON.stringify(values))})
fig, ax = plt.subplots(figsize=(9, 5.5), constrained_layout=True)
${plot}
ax.set_xlabel(${JSON.stringify(model.xTitle || "")})
ax.set_ylabel(${JSON.stringify(model.yTitle || "")})
ax.grid(axis="y", alpha=0.25)
fig.savefig(os.environ["JINTIA_VISUAL_OUTPUT"], dpi=180, bbox_inches="tight")
`;
}

function geopandas(model) {
  if (model.geojson?.type !== "FeatureCollection") {
    throw new Error("GeoPandas requiere model.geojson como FeatureCollection.");
  }
  return `import json
import os
import geopandas as gpd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

geojson = json.loads(${JSON.stringify(JSON.stringify(model.geojson))})
frame = gpd.GeoDataFrame.from_features(geojson["features"])
fig, ax = plt.subplots(figsize=(9, 6), constrained_layout=True)
frame.plot(column=${JSON.stringify(model.valueField || "value")}, legend=True, ax=ax, edgecolor="white", linewidth=0.5)
ax.set_axis_off()
fig.savefig(os.environ["JINTIA_VISUAL_OUTPUT"], dpi=180, bbox_inches="tight")
`;
}

function tikz(model, spec) {
  const escape = value => String(value).replace(/[&%$#_{}]/g, match => `\\${match}`);
  let body;
  if (Array.isArray(model.nodes)) {
    validateGraph(model);
    const nodes = model.nodes.map((node, index) =>
      `\\node[draw,rounded corners,fill=teal!8] (${node.id}) at (${index * 3},0) {${escape(node.label)}};`
    );
    const edges = (model.edges || []).map(edge =>
      `\\draw[-{Latex}] (${edge.from}) -- node[above]{${escape(edge.label || "")}} (${edge.to});`
    );
    body = [...nodes, ...edges].join("\n");
  } else if (Array.isArray(model.categories) && Array.isArray(model.values)) {
    const coordinates = model.categories.map((category, index) =>
      `({${escape(category)}},${model.values[index]})`
    ).join(" ");
    body = `\\begin{axis}[ybar,xtick=data,symbolic x coords={${model.categories.map(escape).join(",")}},xlabel={${escape(model.xTitle || "")}},ylabel={${escape(model.yTitle || "")}}]
\\addplot coordinates {${coordinates}};
\\end{axis}`;
  } else if (Array.isArray(model.events)) {
    body = model.events.map((event, index) =>
      `\\node[draw,rounded corners] (e${index}) at (${index * 3},0) {${escape(event.date)}\\\\${escape(event.label)}};${index ? `\\draw[-{Latex}] (e${index - 1}) -- (e${index});` : ""}`
    ).join("\n");
  } else {
    throw new Error(`TikZ no admite el modelo de ${spec.representation}.`);
  }
  const libraries = spec.representation === "chart" ? "\\usepackage{pgfplots}\n\\pgfplotsset{compat=1.18}" : "\\usetikzlibrary{arrows.meta}";
  return `\\documentclass[tikz,border=4pt]{standalone}
\\usepackage{xcolor}
${libraries}
\\begin{document}
\\begin{tikzpicture}
${body}
\\end{tikzpicture}
\\end{document}
`;
}

function plantuml(model) {
  if (!Array.isArray(model.nodes) || model.nodes.length === 0) {
    throw new Error("PlantUML requiere model.nodes.");
  }
  const clean = value => String(value).replace(/["\r\n]/g, " ");
  if (model.diagramType === "c4") {
    const entities = (model.nodes || []).map(node => {
      const constructor = node.kind === "person" ? "Person" : node.kind === "external" ? "System_Ext" : node.kind === "container" ? "Container" : "System";
      return `${constructor}(${node.id}, "${clean(node.label)}", "${clean(node.technology || "")}")`;
    });
    const relations = (model.edges || []).map(edge => `Rel(${edge.from}, ${edge.to}, "${clean(edge.label || "uses")}")`);
    return `@startuml\n!pragma layout smetana\nskinparam backgroundColor transparent\n${[...entities, ...relations].join("\n")}\n@enduml\n`;
  }
  const kinds = {
    sequence: "participant",
    component: "component",
    "use-case": "usecase",
    state: "state",
    activity: "state",
    class: "class"
  };
  const declarations = model.nodes.map(node =>
    `${kinds[model.diagramType] || "class"} "${clean(node.label)}" as ${node.id}`
  );
  const relations = (model.edges || []).map(edge =>
    `${edge.from} --> ${edge.to}${edge.label ? ` : ${clean(edge.label)}` : ""}`
  );
  return `@startuml
skinparam backgroundColor transparent
skinparam shadowing false
${[...declarations, ...relations].join("\n")}
@enduml
`;
}

function sankeyHtml(model) {
  if (!Array.isArray(model.links) || model.links.length === 0) throw new Error("Sankey requiere model.links.");
  const nodes = model.nodes || [...new Set(model.links.flatMap(link => [link.source, link.target]))].map(id => ({ id, label: id }));
  const byId = new Map(nodes.map(node => [node.id, node]));
  for (const link of model.links) {
    if (!byId.has(link.source) || !byId.has(link.target) || !(Number(link.value) > 0)) throw new Error("Sankey requiere enlaces con source, target y value positivo.");
  }
  const columns = new Map();
  nodes.forEach(node => columns.set(node.id, node.column ?? 0));
  const positions = new Map();
  const maxColumn = Math.max(...nodes.map(node => columns.get(node.id)), 0);
  const grouped = [...Array(maxColumn + 1)].map(() => []);
  nodes.forEach(node => grouped[columns.get(node.id)].push(node));
  grouped.forEach((group, column) => group.forEach((node, index) => positions.set(node.id, {
    x: 80 + (column * 360 / Math.max(maxColumn, 1)),
    y: 90 + index * 80
  })));
  const width = model.width || 900;
  const height = model.height || Math.max(260, Math.max(...grouped.map(group => group.length), 1) * 80 + 120);
  const escape = value => String(value).replace(/[&<>"']/g, match => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[match]));
  const paths = model.links.map(link => {
    const source = positions.get(link.source);
    const target = positions.get(link.target);
    const middle = (source.x + target.x) / 2;
    const stroke = Math.max(2, Math.sqrt(Number(link.value)) * 4);
    return `<path d="M ${source.x + 28} ${source.y} C ${middle} ${source.y}, ${middle} ${target.y}, ${target.x - 28} ${target.y}" stroke="#00796b" stroke-width="${stroke}" opacity=".55" fill="none"/><title>${escape(link.source)} → ${escape(link.target)}: ${escape(link.value)}</title>`;
  }).join("");
  const shapes = nodes.map(node => {
    const point = positions.get(node.id);
    return `<g><rect x="${point.x - 28}" y="${point.y - 18}" width="56" height="36" rx="6" fill="#e0f2f1" stroke="#00796b"/><text x="${point.x}" y="${point.y + 5}" text-anchor="middle" font-size="13">${escape(node.label || node.id)}</text></g>`;
  }).join("");
  return `<!doctype html><meta charset="utf-8"><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(model.altText || "Diagrama Sankey")}"><rect width="100%" height="100%" fill="white"/>${paths}${shapes}</svg>`;
}

function freeBodyDiagram(model) {
  if (!Array.isArray(model.forces) || model.forces.length === 0) throw new Error("El cuerpo libre requiere model.forces.");
  const escape = value => String(value).replace(/[\\{}%&#_$]/g, "\\$&");
  const origin = model.origin || [0, 0];
  const arrows = model.forces.map(force => {
    const angle = Number(force.angle || 0) * Math.PI / 180;
    const length = Number(force.length || force.magnitude || 2);
    const x = origin[0] + Math.cos(angle) * length;
    const y = origin[1] + Math.sin(angle) * length;
    return `\\draw[-{Latex},very thick] (${origin[0]},${origin[1]}) -- (${x.toFixed(3)},${y.toFixed(3)}) node[above] {${escape(force.label || force.name || "F")}};`;
  }).join("\n");
  return `\\documentclass[tikz,border=4pt]{standalone}\n\\usepackage{tikz}\n\\usetikzlibrary{arrows.meta}\n\\begin{document}\n\\begin{tikzpicture}\n\\fill (${origin[0]},${origin[1]}) circle (3pt);\n${arrows}\n\\end{tikzpicture}\n\\end{document}\n`;
}

function circuitikz(model) {
  if (!Array.isArray(model.components) || model.components.length === 0) {
    throw new Error("Circuitikz requiere model.components.");
  }
  const types = {
    resistor: "R", capacitor: "C", inductor: "L", diode: "D",
    battery: "battery", "voltage-source": "V", "current-source": "I",
    switch: "nos", wire: "short"
  };
  const draws = model.components.map(component => {
    const [x1, y1] = component.from;
    const [x2, y2] = component.to;
    const label = component.label || component.value;
    return `\\draw (${x1},${y1}) to[${types[component.type]}${label ? `,l={${label}}` : ""}] (${x2},${y2});`;
  });
  return `\\documentclass[tikz,border=4pt]{standalone}
\\usepackage[american]{circuitikz}
\\begin{document}
\\begin{circuitikz}
${draws.join("\n")}
\\end{circuitikz}
\\end{document}
`;
}

function chemfig(model) {
  const expression = model.reaction || model.formula;
  if (!expression) throw new Error("Chemfig requiere model.formula o model.reaction.");
  const body = model.reaction ? `\\schemestart ${expression} \\schemestop` : `\\chemfig{${expression}}`;
  return `\\documentclass[border=4pt]{standalone}
\\usepackage{chemfig}
\\begin{document}
${body}
\\end{document}
`;
}

function forest(model) {
  if (!Array.isArray(model.nodes) || model.nodes.length === 0) throw new Error("Forest requiere model.nodes.");
  const escape = value => String(value).replace(/[\\{}%&#_$]/g, "\\$&");
  const byParent = new Map();
  for (const node of model.nodes) {
    const parent = node.parent || "";
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push(node);
  }
  const render = node => `[${escape(node.label)} ${(byParent.get(node.id) || []).map(render).join(" ")}]`;
  const roots = byParent.get("") || [];
  if (roots.length !== 1) throw new Error("Forest requiere exactamente un nodo raíz.");
  return `\\documentclass[border=4pt]{standalone}
\\usepackage{forest}
\\begin{document}
\\begin{forest}
for tree={draw,rounded corners,align=center}
${render(roots[0])}
\\end{forest}
\\end{document}
`;
}

function canGenerateFromModel(engine, representation) {
  const support = {
    graphviz: ["concept-map", "network", "flowchart", "causal-diagram", "technical-diagram", "bpmn", "argument-map", "curriculum-map"],
    mermaid: ["concept-map", "network", "flowchart", "causal-diagram", "technical-diagram"],
    d2: ["concept-map", "network", "flowchart", "timeline", "technical-diagram"],
    "vega-lite": ["chart", "forest-plot", "map", "timeline"],
    matplotlib: ["chart", "forest-plot"],
    geopandas: ["map"],
    tikz: ["chart", "concept-map", "network", "flowchart", "timeline", "causal-diagram", "technical-diagram", "equation", "free-body-diagram"],
    wavedrom: ["signal-diagram"],
    rdkit: ["annotated-image", "chemical-structure"]
    ,plantuml: ["uml", "technical-diagram", "bpmn", "c4"]
    ,circuitikz: ["electrical-circuit", "disciplinary-notation"]
    ,chemfig: ["chemical-structure", "chemical-reaction", "disciplinary-notation"]
    ,forest: ["syntax-tree", "phylogenetic-tree", "pedigree"]
    ,html: ["sankey"],
    "editorial-svg": ["flowchart", "concept-map", "technical-diagram", "argument-map", "curriculum-map", "timeline"]
  };
  return Boolean(support[engine]?.includes(representation));
}

function rdkit(model) {
  if (!model.smiles) throw new Error("RDKit requiere model.smiles.");
  return `import os
from rdkit import Chem
from rdkit.Chem.Draw import rdMolDraw2D

smiles = ${JSON.stringify(model.smiles)}
output = os.environ["JINTIA_VISUAL_OUTPUT"]
mol = Chem.MolFromSmiles(smiles)
if mol is None:
    raise ValueError("SMILES inválido")
drawer = rdMolDraw2D.MolDraw2DSVG(1000, 700)
drawer.DrawMolecule(mol)
drawer.FinishDrawing()
with open(output, "w", encoding="utf-8") as handle:
    handle.write(drawer.GetDrawingText())
`;
}

function generateSource(engine, spec) {
  if (!spec.model) return null;
  if (engine === "graphviz") return graphviz(spec.model);
  if (engine === "editorial-svg") return renderEditorialSvg(spec);
  if (engine === "mermaid") return mermaid(spec.model);
  if (engine === "d2") return d2(spec.model);
  if (engine === "vega-lite") {
    if (spec.representation === "forest-plot") return forestPlot(spec.model, spec.altText);
    if (spec.representation === "map") return geoMap(spec.model, spec.altText);
    return vegaLite(spec.model, spec.altText);
  }
  if (engine === "wavedrom") return wavedrom(spec.model);
  if (engine === "rdkit") return rdkit(spec.model);
  if (engine === "matplotlib") return matplotlib(spec.model, spec);
  if (engine === "geopandas") return geopandas(spec.model, spec);
  if (engine === "tikz") return tikz(spec.model, spec);
  if (engine === "plantuml") return plantuml(spec.model, spec);
  if (engine === "circuitikz") return circuitikz(spec.model, spec);
  if (engine === "chemfig") return chemfig(spec.model, spec);
  if (engine === "forest") return forest(spec.model, spec);
  if (engine === "html" && spec.representation === "sankey") return sankeyHtml(spec.model);
  if (engine === "tikz" && spec.representation === "free-body-diagram") return freeBodyDiagram(spec.model);
  throw new Error(`El motor ${engine} no admite generación desde model; proporciona source o sourceFile.`);
}

module.exports = {
  generateSource, canGenerateFromModel, graphviz, mermaid, d2, vegaLite,
  forestPlot, geoMap, wavedrom, rdkit, matplotlib, geopandas, tikz,
  plantuml, circuitikz, chemfig, forest
  ,sankeyHtml, freeBodyDiagram, supportsEditorialSpec
};
