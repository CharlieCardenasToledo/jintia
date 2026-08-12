"use strict";

const ENGINE_FALLBACKS = {
  "editorial-svg": [],
  "vega-lite": ["matplotlib", "tikz"],
  geopandas: ["matplotlib"],
  rdkit: [],
  matplotlib: ["tikz"],
  wavedrom: ["tikz"],
  html: [],
  d2: ["graphviz", "tikz"],
  plantuml: ["mermaid"],
  graphviz: ["mermaid", "tikz"],
  mermaid: ["graphviz", "tikz"]
};

function analyzeModel(spec) {
  const model = spec.model || {};
  const labels = (model.nodes || []).map(node => node.label || "");
  const nodeCount = model.nodes?.length || 0;
  const edgeCount = model.edges?.length || 0;
  return {
    nodeCount,
    edgeCount,
    hierarchyDepth: model.hierarchyDepth || null,
    crossingRisk: nodeCount ? edgeCount / nodeCount : 0,
    averageLabelWords: labels.length
      ? labels.reduce((sum, label) => sum + label.trim().split(/\s+/).length, 0) / labels.length
      : 0,
    quantitativeVariables: [model.xField, model.yField, model.valueField].filter(Boolean).length,
    temporalVariables: model.events?.length ? 1 : 0,
    geographicGeometry: model.geojson?.features?.[0]?.geometry?.type || null,
    requiresExactCoordinates: Boolean(model.requiresExactCoordinates)
  };
}

function editorialEligible(spec, metrics) {
  const editorial = ["flowchart", "concept-map", "technical-diagram", "argument-map", "curriculum-map", "timeline"];
  return editorial.includes(spec.representation) && !spec.formalNotationRequired && !metrics.requiresExactCoordinates
    && metrics.nodeCount <= 12 && metrics.edgeCount <= 16 && metrics.averageLabelWords <= 8
    && (metrics.hierarchyDepth || 0) <= 4 && metrics.crossingRisk <= 2
    && !(spec.representation === "timeline" && (metrics.quantitativeVariables || spec.model?.events?.some(event => event.value !== undefined)));
}

function selectEngine(spec) {
  if (spec.engine && spec.engine !== "auto") return spec.engine;
  if (spec.formalNotationRequired) {
    if (spec.discipline === "chemistry") return "chemfig";
    if (spec.discipline === "electronics") return "circuitikz";
    if (spec.representation === "technical-diagram") return "plantuml";
  }
  if (spec.discipline === "chemistry" && spec.representation === "annotated-image") return "rdkit";
  const metrics = analyzeModel(spec);
  if (editorialEligible(spec, metrics)) return "editorial-svg";
  if (metrics.requiresExactCoordinates) return "tikz";
  if (metrics.temporalVariables && spec.model?.events?.some(event => event.value !== undefined)) {
    return "vega-lite";
  }
  if (metrics.hierarchyDepth > 4 && ["flowchart", "concept-map", "technical-diagram"].includes(spec.representation)) {
    return "graphviz";
  }
  if (metrics.crossingRisk > 2 && ["flowchart", "network", "concept-map", "argument-map"].includes(spec.representation)) {
    return "graphviz";
  }
  switch (spec.representation) {
    case "chart": return "vega-lite";
    case "forest-plot": return "vega-lite";
    case "map": return spec.model?.geojson ? "vega-lite" : "geopandas";
    case "network": return "graphviz";
    case "flowchart":
      return spec.complexity === "high"
        || metrics.nodeCount > 12
        || metrics.edgeCount > 16
        || metrics.averageLabelWords > 8
        ? "graphviz"
        : "mermaid";
    case "timeline": return spec.model?.events?.some(event => event.value !== undefined) ? "vega-lite" : "d2";
    case "signal-diagram": return "wavedrom";
    case "causal-diagram": return "graphviz";
    case "uml": return "plantuml";
    case "electrical-circuit": return "circuitikz";
    case "chemical-structure": return spec.model?.smiles ? "rdkit" : "chemfig";
    case "chemical-reaction": return "chemfig";
    case "syntax-tree":
    case "phylogenetic-tree":
    case "pedigree": return "forest";
    case "interface": return "html";
    case "equation": return "tikz";
    case "disciplinary-notation":
      return spec.discipline === "chemistry" ? "chemfig" : "tikz";
    case "concept-map":
    case "technical-diagram":
    case "bpmn":
    case "argument-map":
    case "curriculum-map":
      return "graphviz";
    case "c4": return "plantuml";
    case "sankey": return "html";
    case "free-body-diagram": return "tikz";
    default:
      return "tikz";
  }
}

function candidatesFor(spec) {
  const selected = selectEngine(spec);
  if (spec.formalNotationRequired) return [selected];
  const fallbacks = ENGINE_FALLBACKS[selected] || [];
  return [selected, ...fallbacks];
}

module.exports = { selectEngine, candidatesFor, analyzeModel, editorialEligible, ENGINE_FALLBACKS };
