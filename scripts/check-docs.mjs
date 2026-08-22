import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const ignored = new Set([
  ".agents",
  ".git",
  ".rtfm",
  ".claude",
  ".playwright-mcp",
  "node_modules",
  "dist",
  "target",
  "tmp",
]);
const errors = [];
const requiredProjectFiles = [
  "AUTHORS.md",
  "CITATION.cff",
  "LICENSE",
  "PRIVACY.md",
  "THIRD_PARTY_NOTICES.md",
  "docs/brand-guidelines.md",
  "skill/SKILL.md",
  "skill/agents/openai.yaml",
];

for (const relative of requiredProjectFiles) {
  if (!existsSync(join(root, relative))) errors.push(`Falta el archivo obligatorio: ${relative}`);
}

function collect(directory, extension, files = []) {
  for (const name of readdirSync(directory)) {
    if (ignored.has(name)) continue;
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) collect(path, extension, files);
    else if (extname(name).toLowerCase() === extension) files.push(path);
  }
  return files;
}

const markdown = collect(root, ".md");
const obsolete = [
  ["instructional-designer-uide", "nombre anterior de la skill"],
  ["AcademiaOS", "marca anterior de la aplicación"],
  ["Instructional Designer Manager", "marca anterior de la aplicación"],
  ["compilacion-wsl.md", "referencia renombrada"],
  ["guia-semanaXX", "nombre semanal sin separador"],
  ["gemini-notebook-mcp@latest", "dependencia MCP sin versión verificada"],
  ["Node.js 18", "versión de Node obsoleta (actual: >=22.13.0, ver package.json)"],
  ["Node.js 22.12", "versión de Node obsoleta (actual: >=22.13.0, ver package.json)"],
  ["node.js 22.12", "versión de Node obsoleta (actual: >=22.13.0, ver package.json)"],
  ["pdflatex", "motor LaTeX eliminado del pipeline (motor actual: Vivliostyle)"],
  ["latex-linter", "linter LaTeX eliminado del pipeline"],
  ["Biber", "bibliografía LaTeX eliminada del pipeline (motor actual: Citation.js)"],
  ["guia.tex", "los archivos .tex ya no forman parte del pipeline"],
  ["MiKTeX", "distribución LaTeX eliminada del pipeline"],
  ["TeX Live", "distribución LaTeX eliminada del pipeline"],
  ["--engine pagedjs", "Paged.js no es un motor soportado (único motor: Vivliostyle)"],
];

// Todo código JIN-* mencionado en documentación debe existir en el catálogo
// canónico — evita que una página describa una regla que nunca existió o
// que ya se eliminó. Solo se exige esto para familias que el catálogo
// realmente rastrea (JIN-SCH-*, JIN-EVD-*, JIN-PLN-*, etc.): otras familias
// (JIN-HTM-*, JIN-PFG-*, JIN-TRN-*) viven a propósito en el RULES local de
// su propio script (html-linter.js, pdf-preflight.js, transcript-export.js)
// y no son responsabilidad de catalog.json.
const catalogRuleIds = JSON.parse(readFileSync(join(root, "skill/rules/catalog.json"), "utf8")).rules.map(r => r.id);
const catalogIds = new Set(catalogRuleIds);
const catalogPrefixes = new Set(catalogRuleIds.map(id => id.replace(/-\d+$/, "")));

// Ninguna documentación pública puede fijar mcp.version localmente: la única
// fuente de verdad es release/release-config.json.
const mcpHardcodePattern = /gemini-notebook-mcp@(?!latest\b|<)[^\s"'`)]+/g;

for (const file of markdown) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(/!?\[[^\]]*]\(([^)]+)\)/g)) {
    const raw = match[1].trim().replace(/^<|>$/g, "");
    if (/^(?:https?:|mailto:|#)/i.test(raw)) continue;
    const pathPart = decodeURIComponent(raw.split("#", 1)[0]);
    if (!pathPart) continue;
    const target = resolve(dirname(file), pathPart);
    if (!existsSync(target)) errors.push(`${file}: enlace local inexistente: ${raw}`);
  }
  if (file.endsWith("CHANGELOG.md")) continue;
  for (const [term, reason] of obsolete) {
    if (text.includes(term)) errors.push(`${file}: ${reason}: ${term}`);
  }
  for (const match of text.matchAll(mcpHardcodePattern)) {
    errors.push(`${file}: versión de MCP hardcodeada (${match[0]}); usa release/release-config.json como única fuente.`);
  }
  for (const match of text.matchAll(/\bJIN-[A-Z]+-\d{3}\b/g)) {
    const prefix = match[0].replace(/-\d+$/, "");
    if (catalogPrefixes.has(prefix) && !catalogIds.has(match[0])) {
      errors.push(`${file}: menciona ${match[0]}, que no existe en skill/rules/catalog.json`);
    }
  }
}

// Todo commands/*.md referenciado desde SKILL.md debe existir realmente.
const skillMd = readFileSync(join(root, "skill/SKILL.md"), "utf8");
for (const match of skillMd.matchAll(/commands\/[\w-]+\.md/g)) {
  if (!existsSync(join(root, "skill", match[0]))) {
    errors.push(`skill/SKILL.md referencia ${match[0]}, que no existe.`);
  }
}

const schema = JSON.parse(readFileSync(join(root, "skill/config/institution.schema.json"), "utf8"));
const example = JSON.parse(readFileSync(join(root, "skill/config/institution.example.json"), "utf8"));
for (const key of schema.required) {
  if (!(key in example)) errors.push(`institution.example.json: falta ${key}`);
}
for (const key of schema.properties.institution.required) {
  if (!(key in example.institution)) errors.push(`institution.example.json: falta institution.${key}`);
}
if (example.branding.logoPath && !existsSync(join(root, "skill", example.branding.logoPath))) {
  errors.push("institution.example.json: logoPath apunta a un archivo inexistente");
}

const plugin = JSON.parse(readFileSync(join(root, "skill/.claude-plugin/plugin.json"), "utf8"));
const skillPackage = JSON.parse(readFileSync(join(root, "skill/package.json"), "utf8"));
const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
if (plugin.version !== skillPackage.version) {
  errors.push(`Versiones distintas: plugin ${plugin.version}, skill ${skillPackage.version}`);
}
if (!changelog.includes(`jintia-skill\` ${plugin.version}`)) {
  errors.push(`CHANGELOG.md no contiene la versión ${plugin.version} del plugin`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Documentación válida: ${markdown.length} Markdown, enlaces locales y contratos canónicos.`);
