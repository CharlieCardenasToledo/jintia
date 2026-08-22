#!/usr/bin/env node
"use strict";

/**
 * quality-report.js — JINTIA QUALITY REPORT
 *
 * Agrega, sobre un único guide.json, las dimensiones que definen si una guía
 * está "Jintia Ready" (ver SKILL.md): alineación por target, contrato de
 * autoinstruccionalidad, carga académica, procedencia de evidencia
 * (evidence.json, si existe) y estado de la bibliografía. No repite la
 * lógica de content-linter.js: consume su reporte (issues + provenanceSummary)
 * como fuente única de verdad y solo reformula esa información en un
 * resumen legible con una decisión final.
 *
 * No sustituye jintia validate (estructura/esquema) ni jintia compile
 * --publish (degradación bibliográfica en el HTML renderizado): es un
 * resumen de lectura rápida sobre lo que ya valida el linter.
 *
 * Uso:
 *   node scripts/quality-report.js guide.json [--json]
 */

const fs   = require("node:fs");
const path = require("node:path");
const { lintGuide } = require("./content-linter");

function hasRule(issues, rule) {
  return issues.some(i => i.rule === rule);
}

function computeAlignment(guide, issues) {
  const targets = Array.isArray(guide.metadata?.targets) ? guide.metadata.targets : [];
  if (targets.length === 0) return null;

  const sections = guide.sections || [];
  let taught = 0, practiced = 0, assessed = 0, feedbackOk = 0;
  for (const t of targets) {
    const nodesForTarget = sections.filter(s => Array.isArray(s.targetIds) && s.targetIds.includes(t.id));
    const teaching   = nodesForTarget.filter(s => s.type === "theory" || s.type === "concept");
    const practice   = nodesForTarget.filter(s => s.type === "practice" || s.type === "scenario");
    const assessment = nodesForTarget.filter(s => s.type === "assessment");
    if (teaching.length > 0) taught++;
    if (practice.length > 0) practiced++;
    if (assessment.length > 0) assessed++;
    if (practice.some(s => s.feedback || s.selfCheck)) feedbackOk++;
  }

  const hasBlockingGap = ["JIN-ALN-010", "JIN-ALN-011", "JIN-ALN-012", "JIN-ALN-013", "JIN-ALN-014"]
    .some(rule => hasRule(issues, rule));

  return {
    total: targets.length, taught, practiced, assessed, feedbackOk,
    status: hasBlockingGap ? "BLOCKED" : "PASS",
  };
}

function computeSelfInstruction(guide, issues) {
  const targets = Array.isArray(guide.metadata?.targets) ? guide.metadata.targets : [];
  if (targets.length === 0) return null;

  const checks = {
    route:              !hasRule(issues, "JIN-SELF-001"),
    workedExamples:     !hasRule(issues, "JIN-SELF-002"),
    successCriteria:    !hasRule(issues, "JIN-SELF-003"),
    selfCorrection:     !hasRule(issues, "JIN-SELF-004"),
    remediation:        !hasRule(issues, "JIN-SELF-005"),
    retrieval:          !hasRule(issues, "JIN-SELF-006"),
    finalCheck:         !hasRule(issues, "JIN-SELF-007"),
    progressMonitoring: !hasRule(issues, "JIN-SELF-008"),
    transfer:           !hasRule(issues, "JIN-SELF-009"),
  };
  const blockingFail = !checks.route || !checks.workedExamples || !checks.successCriteria ||
    !checks.selfCorrection || !checks.remediation || !checks.finalCheck;

  return { ...checks, status: blockingFail ? "BLOCKED" : "PASS" };
}

function computeWorkload(guide) {
  const metadata = guide.metadata || {};
  const sections = guide.sections || [];
  if (typeof metadata.hours !== "number") return null;
  const declaredMinutes = metadata.hours * 60;
  const plannedMinutes  = sections.reduce((sum, s) => sum + (typeof s.estimatedMinutes === "number" ? s.estimatedMinutes : 0), 0);
  if (plannedMinutes === 0) return null;
  const coverage = (plannedMinutes / declaredMinutes) * 100;
  let status = "PASS";
  if (coverage < 70 || coverage > 130) status = "ERROR";
  else if (coverage < 90 || coverage > 110) status = "WARNING";
  return { declaredMinutes, plannedMinutes, coverage, status };
}

function computeBibliography(guide, issues) {
  const style = guide.metadata?.citationStyle || "apa";
  const hasBibIssue = issues.some(i => i.rule.startsWith("JIN-BIB-"));
  return { style, status: hasBibIssue ? "FAIL" : "PASS" };
}

/**
 * @param {string} guidePath
 * @returns {object} Reporte estructurado (ver printReport para el formato de texto).
 */
function buildReport(guidePath) {
  const absolute = path.resolve(guidePath);
  const lint      = lintGuide(absolute);
  const guide     = JSON.parse(fs.readFileSync(absolute, "utf8"));

  const alignment       = computeAlignment(guide, lint.issues);
  const selfInstruction = computeSelfInstruction(guide, lint.issues);
  const workload        = computeWorkload(guide);
  const bibliography    = computeBibliography(guide, lint.issues);
  const provenance      = lint.provenanceSummary;

  const decision = lint.summary.errors > 0 ? "BLOCKED"
    : lint.summary.warnings > 0 ? "NEEDS_CHANGES"
    : "READY";

  return {
    tool: "jintia quality-report",
    target: absolute,
    metadata: { course: guide.metadata?.course, week: guide.metadata?.week },
    alignment, selfInstruction, workload, provenance, bibliography,
    lintSummary: lint.summary,
    issues: lint.issues,
    decision,
  };
}

function pad(label, width = 22) {
  return `${label} ${".".repeat(Math.max(0, width - label.length))} `;
}

function printReport(report, asJson) {
  if (asJson) { console.log(JSON.stringify(report, null, 2)); return; }

  console.log("JINTIA QUALITY REPORT");
  console.log(`${pad("Curso")}${report.metadata.course || "(sin declarar)"}`);
  console.log(`${pad("Semana")}${report.metadata.week ?? "(sin declarar)"}`);
  console.log("");

  if (report.alignment) {
    const a = report.alignment;
    console.log("Alineación (targets)");
    console.log(`${pad("Targets enseñados")}${a.taught}/${a.total}`);
    console.log(`${pad("Targets practicados")}${a.practiced}/${a.total}`);
    console.log(`${pad("Targets evaluados")}${a.assessed}/${a.total}`);
    console.log(`${pad("Cobertura de feedback")}${a.feedbackOk}/${a.total}`);
    console.log(`${pad("Estado")}${a.status}`);
    console.log("");
  }

  if (report.selfInstruction) {
    const s = report.selfInstruction;
    console.log("Autoinstruccionalidad");
    console.log(`${pad("Ruta de aprendizaje")}${s.route ? "PASS" : "FAIL"}`);
    console.log(`${pad("Ejemplos trabajados")}${s.workedExamples ? "PASS" : "FAIL"}`);
    console.log(`${pad("Criterios de éxito")}${s.successCriteria ? "PASS" : "FAIL"}`);
    console.log(`${pad("Autocorrección")}${s.selfCorrection ? "PASS" : "FAIL"}`);
    console.log(`${pad("Remediación")}${s.remediation ? "PASS" : "FAIL"}`);
    console.log(`${pad("Recuperación")}${s.retrieval ? "PASS" : "WARN"}`);
    console.log(`${pad("Comprobación final")}${s.finalCheck ? "PASS" : "FAIL"}`);
    console.log(`${pad("Monitorización")}${s.progressMonitoring ? "PASS" : "WARN"}`);
    console.log(`${pad("Transferencia")}${s.transfer ? "PASS" : "WARN"}`);
    console.log(`${pad("Estado")}${s.status}`);
    console.log("");
  }

  if (report.workload) {
    const w = report.workload;
    console.log("Carga académica");
    console.log(`${pad("Declarada")}${(w.declaredMinutes / 60).toFixed(1)} h`);
    console.log(`${pad("Planificada")}${Math.floor(w.plannedMinutes / 60)} h ${w.plannedMinutes % 60} min`);
    console.log(`${pad("Cobertura")}${w.coverage.toFixed(1)}%`);
    console.log(`${pad("Estado")}${w.status}`);
    console.log("");
  }

  if (report.provenance) {
    const p = report.provenance;
    console.log("Procedencia de evidencia");
    console.log(`${pad("NotebookLM primary")}${p.notebookPrimary}%`);
    console.log(`${pad("Local fallback")}${p.localFallback}%`);
    console.log(`${pad("AI fallback")}${p.aiFallback}%`);
    console.log("");
    console.log(`Academic provenance: ${p.academicProvenance}`);
    console.log("");
  }

  console.log("Bibliografía");
  console.log(`${pad("Estilo")}${report.bibliography.style}`);
  console.log(`${pad("Estado")}${report.bibliography.status}`);
  console.log("");

  console.log(`DECISIÓN FINAL: ${report.decision}`);

  if (report.issues.length > 0) {
    console.log("");
    console.log("Incidencias (ver jintia validate para el detalle completo):");
    for (const issue of report.issues) {
      console.log(`  ${issue.severity === "error" ? "✗" : "⚠"} ${issue.rule} · ${issue.message}`);
    }
  }
}

if (require.main === module) {
  const args   = process.argv.slice(2);
  const target = args.find(a => !a.startsWith("--"));
  const asJson = args.includes("--json");

  if (!target) {
    console.error("Uso: node scripts/quality-report.js guide.json [--json]");
    process.exit(2);
  }

  try {
    const report = buildReport(target);
    printReport(report, asJson);
    if (report.decision === "BLOCKED") process.exitCode = 1;
  } catch (err) {
    console.error(`quality-report: ${err.message}`);
    process.exitCode = 1;
  }
}

module.exports = { buildReport, printReport };
