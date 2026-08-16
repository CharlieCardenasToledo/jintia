import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = relative => readFile(resolve(root, relative), "utf8");
const json = async relative => JSON.parse(await read(relative));
const failures = [];
const canonicalRepository = "CharlieCardenasToledo/jintia";

const [skillPackage, brand, claudePlugin, openAiPlugin, openAiMcp, releaseConfig, rootPackage, changelog, contractOutput] = await Promise.all([
  json("skill/package.json"),
  json("skill/config/brand.json"),
  json("skill/.claude-plugin/plugin.json"),
  json("openai-plugin/.codex-plugin/plugin.json"),
  json("openai-plugin/.mcp.json"),
  json("release/release-config.json"),
  json("package.json"),
  read("CHANGELOG.md"),
  new Promise(resolve => {
    import("node:child_process").then(({ execFile }) => {
      execFile(process.execPath, ["skill/bin/jintia.js", "contract", "--json"], { cwd: root }, (err, stdout) => {
        try { resolve(JSON.parse(stdout)); } catch { resolve(null); }
      });
    });
  }),
]);

const expected = skillPackage.version;
for (const [label, version] of [
  ["paquete raíz", rootPackage.version],
  ["plugin Claude", claudePlugin.version],
  ["plugin ChatGPT/Codex", openAiPlugin.version],
]) {
  if (version !== expected) failures.push(`${label}: ${version}; esperado ${expected}`);
}
if (rootPackage.name !== "@charlie.act7/jintia") failures.push(`paquete npm raíz inesperado: ${rootPackage.name}`);
if (releaseConfig.repository !== canonicalRepository) failures.push(`releaseConfig.repository debe ser ${canonicalRepository}`);
for (const [label, repository] of [
  ["paquete raíz", rootPackage.repository?.url],
  ["paquete Skill", skillPackage.repository?.url],
  ["plugin Claude", claudePlugin.repository],
  ["plugin ChatGPT/Codex", openAiPlugin.repository],
]) {
  if (!String(repository || "").includes(canonicalRepository)) failures.push(`${label}: repositorio no canónico`);
}
if (rootPackage.private) failures.push("el paquete npm raíz continúa marcado como privado");
if (rootPackage.bin?.jintia !== "skill/bin/jintia.js") failures.push("el paquete npm no expone el binario jintia");
if (rootPackage.publishConfig?.access !== "public") failures.push("el paquete npm no declara publicación pública");

if (brand.brandName !== "Jintia" || brand.linguisticForm !== "Jíntia" || brand.meaning !== "camino" || !brand.disclaimer) {
  failures.push("La identidad y atribución canónicas de Jintia están incompletas.");
}
if (!brand.sources?.some(source => /Aarma jintia/i.test(source.claim || "") && source.page === 106)) {
  failures.push("brand.json no contiene la fuente institucional de Aarma jintia con página 106.");
}

const expectedMcp = `${releaseConfig.mcp.package}@${releaseConfig.mcp.version}`;
if (openAiMcp.notebooklm?.args?.at(-1) !== expectedMcp) failures.push(`Plugin OpenAI: MCP distinto de ${expectedMcp}`);
if (releaseConfig.minimumDesktopVersion !== "1.1.0") failures.push("minimumDesktopVersion debe ser 1.1.0");
if (!changelog.includes(`jintia-skill\` ${expected}`)) failures.push(`CHANGELOG.md no declara jintia-skill ${expected}`);

// Consistencia del requisito Node entre todas las fuentes de verdad.
const nodeRequirements = {
  "package.json raíz (engines.node)": rootPackage.engines?.node,
  "skill/package.json (engines.node)": skillPackage.engines?.node,
  "release-config.json (runtime.node)": releaseConfig.runtime?.node,
  "jintia contract --json (runtime.node)": contractOutput?.runtime?.node,
};
const canonicalNode = releaseConfig.runtime?.node;
if (!canonicalNode) {
  failures.push("release-config.json no declara runtime.node");
} else {
  for (const [label, value] of Object.entries(nodeRequirements)) {
    if (value !== canonicalNode) {
      failures.push(`${label}: "${value ?? "(ausente)"}" — debe ser "${canonicalNode}"`);
    }
  }
}

const installProfiles = await json("skill/config/visual-install-profiles.json").catch(() => null);
if (installProfiles) {
  const declaredBinaries = new Set(Object.keys(releaseConfig.profileBinaries ?? {}));
  const allBinaryIds = new Set(
    (installProfiles.profiles ?? []).flatMap(p => (p.binaries ?? []).map(b => b.id))
  );
  for (const id of allBinaryIds) {
    if (!declaredBinaries.has(id)) {
      failures.push(`profileBinaries de release-config.json no declara '${id}' (requerido por visual-install-profiles.json)`);
    }
  }
}

for (const file of [
  "skill/config/visual-tools.json",
  "skill/config/visual-install-profiles.json",
  "skill/schemas/visual-spec.schema.json",
  "skill/schemas/visual-manifest.schema.json",
  "skill/themes/jintia-clasico/meta.json",
  "skill/themes/jintia-tecnico/meta.json",
  "skill/themes/jintia-cuaderno/meta.json",
]) {
  try { await json(file); } catch (error) { failures.push(`${file}: JSON inválido (${error.message})`); }
}

for (const script of [
  "skill/bin/jintia.js",
  "skill/scripts/schema-validator.js",
  "skill/scripts/visual-capabilities.js",
  "skill/scripts/visual-inspector.js",
  "skill/scripts/visual-linter.js",
  "skill/scripts/visual-matrix-check.js",
  "skill/scripts/visual-progressive.js",
  "skill/scripts/visual-pipeline.js",
  "skill/scripts/visual-regression.js",
  "skill/scripts/visual-renderer.js",
  "skill/scripts/visual-selector.js",
  "skill/scripts/visual-source-generator.js",
  "skill/scripts/test-runner.js",
  "skill/scripts/brand-validator.js",
]) {
  try { await read(script); } catch { failures.push(`Falta ${script}`); }
}

for (const file of ["README.md", "README.en.md", "docs/brand-guidelines.md", "skill/SKILL.md"]) {
  try {
    const content = await read(file);
    if (!content.includes("Jíntia") || !content.includes("Aarma jintia")) failures.push(`${file} no contiene la atribución canónica`);
  } catch { failures.push(`Falta ${file}`); }
}

try {
  const matrix = await read(".github/workflows/visual-engine-matrix.yml");
  for (const os of ["ubuntu-latest", "macos-latest", "windows-latest"]) {
    if (!matrix.includes(os)) failures.push(`La matriz visual no incluye ${os}`);
  }
  if (!matrix.includes('JINTIA_REAL_RENDER_TESTS: "1"')) failures.push("La matriz visual no activa renderizado real");
} catch { failures.push("Falta .github/workflows/visual-engine-matrix.yml"); }

if (failures.length) {
  failures.forEach(failure => console.error(`[ERROR] ${failure}`));
  process.exit(1);
}
console.log(`Release readiness OK para jintia-skill ${expected}.`);
