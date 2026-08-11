"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { detectInstallationStates, mutate, installPath, MANIFEST } = require("../../packages/core");
const { readCourse } = require("../../packages/core");

const root = path.resolve(__dirname, "..");
const cli = path.join(root, "bin", "jintia.js");
const fixtures = path.join(__dirname, "fixtures");
const skillVersion = require("../package.json").version;
const updateVersion = skillVersion.replace(/(\d+)$/, value => String(Number(value) + 1));
function copyFixture(name) {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), `jintia-${name}-`));
  fs.cpSync(path.join(fixtures, name), target, { recursive: true });
  return target;
}

test("fixture mínimo pasa syllabus validate y conserva estado desde la CLI", () => {
  const course = copyFixture("minimal-course");
  const validation = spawnSync(process.execPath, [cli, "syllabus", "validate", path.join(course, "README.md")], { encoding: "utf8" });
  assert.equal(validation.status, 0, validation.stderr);
  const update = spawnSync(process.execPath, [cli, "state", "update", course, "1", "validated", path.join(course, "README.md")], { encoding: "utf8" });
  assert.equal(update.status, 0, update.stderr);
  assert.equal(readCourse(course).state.weeks["01"].status, "validated");
});

test("fixture incompleto falla validación sin alterar el curso", () => {
  const course = copyFixture("malformed-syllabus");
  const result = spawnSync(process.execPath, [cli, "syllabus", "validate", path.join(course, "README.md")], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.deepEqual(readCourse(course).state.weeks, {});
});

test("fixture legado permanece aislado hasta ejecutar una migración explícita", () => {
  const course = copyFixture("legacy-project");
  const state = readCourse(course);
  assert.equal(state.syllabusExists, true);
  assert.deepEqual(state.state.weeks, {});
  assert.equal(fs.existsSync(path.join(course, ".jintia", "state.json")), false);
});

test("context init es idempotente y context validate exige las secciones duraderas", () => {
  const course = copyFixture("minimal-course");
  const init = spawnSync(process.execPath, [cli, "context", "init", course, "--json"], { encoding: "utf8" });
  assert.equal(init.status, 0, init.stderr);
  assert.equal(JSON.parse(init.stdout).data.created, true);
  const second = spawnSync(process.execPath, [cli, "context", "init", course, "--json"], { encoding: "utf8" });
  assert.equal(JSON.parse(second.stdout).data.created, false);
  const validation = spawnSync(process.execPath, [cli, "context", "validate", course, "--json"], { encoding: "utf8" });
  assert.equal(validation.status, 0, validation.stderr);
  assert.equal(JSON.parse(validation.stdout).data.valid, true);
});

test("agents plan devuelve contratos existentes y orden de delegación", () => {
  const result = spawnSync(process.execPath, [cli, "agents", "plan", "guide", "--json"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.command, "agents plan");
  assert.equal(report.data.operation, "guide");
  assert.ok(report.data.agents.length >= 3);
  assert.ok(report.data.agents.every(agent => agent.status === "pending"));
});

test("los paquetes internos exponen límites consumibles sin duplicar implementaciones", () => {
  const cliPackage = require("../../packages/cli");
  const rules = require("../../packages/rules");
  const templates = require("../../packages/templates");
  const skill = require("../../packages/skill");
  assert.match(cliPackage.bin, /skill[\\/]bin[\\/]jintia\.js$/);
  assert.ok(Array.isArray(rules.catalog.rules));
  assert.ok(templates.list().some(template => template.id === "jintia-clasico"));
  assert.match(skill.skillFile, /skill[\\/]SKILL\.md$/);
});

test("la instalación de hooks queda explícitamente separada del runner", () => {
  const installer = fs.readFileSync(path.join(root, "scripts", "hook-install.js"), "utf8");
  assert.match(installer, /core\.hooksPath/);
  assert.match(installer, /pre-commit/);
  assert.match(installer, /No se instaló el hook/);
});

test("detect identifica harnesses de proyecto, globales y alias explícitos", () => {
  const project = copyFixture("minimal-course");
  fs.mkdirSync(path.join(project, ".cursor", "skills", "jintia-skill"), { recursive: true });
  fs.writeFileSync(path.join(project, ".cursor", "skills", "jintia-skill", "SKILL.md"), "---\nname: jintia-skill\n---\n");
  const detected = spawnSync(process.execPath, [cli, "detect", project, "--json"], { encoding: "utf8" });
  assert.equal(detected.status, 0, detected.stderr);
  const report = JSON.parse(detected.stdout).data;
  assert.equal(report.providers.find(provider => provider.id === "cursor").status, "repair-needed");
  const explicit = spawnSync(process.execPath, [cli, "detect", project, "--providers=claude,codex", "--json"], { encoding: "utf8" });
  const explicitReport = JSON.parse(explicit.stdout).data;
  assert.deepEqual([...new Set(explicitReport.providers.map(provider => provider.id))], ["claude", "codex"]);
});

test("el gestor instala, actualiza, repara y desinstala sin sobrescribir rutas ajenas", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-harness-manager-"));
  const source = path.join(root, "source");
  const project = path.join(root, "project");
  fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(path.join(source, "SKILL.md"), "---\nname: jintia-skill\n---\n");
  fs.mkdirSync(path.join(project, ".gemini"), { recursive: true });
  assert.equal(detectInstallationStates({ projectRoot: project, providers: ["gemini"] })[0].state.status, "detected");
  const base = { projectRoot: project, sourcePath: source, providers: ["claude", "codex", "cursor"], scope: "project", version: skillVersion, confirm: true };
  const installed = mutate("install", base);
  assert.equal(installed.results.length, 3);
  assert.ok(installed.results.every(result => fs.existsSync(path.join(result.target, "VERSION"))));
  assert.ok(detectInstallationStates(base).filter(item => item.scope === "project").every(item => item.state.status === "installed"));
  assert.equal(mutate("update", { ...base, version: updateVersion }).results[0].status, "update");
  assert.equal(detectInstallationStates({ ...base, version: updateVersion }).find(item => item.id === "cursor" && item.scope === "project").state.status, "installed");
  fs.rmSync(path.join(project, ".cursor", "skills", "jintia-skill", "SKILL.md"));
  assert.equal(detectInstallationStates({ ...base, providers: ["cursor"] })[0].state.status, "repair-needed");
  mutate("repair", { ...base, providers: ["cursor"] });
  assert.equal(mutate("uninstall", { ...base, providers: ["cursor"] }).results[0].status, "not-detected");
  const foreign = installPath({ id: "gemini", projectDir: ".gemini", globalHints: [".gemini"], skillsDir: "skills" }, "project", project, "");
  fs.mkdirSync(foreign, { recursive: true });
  fs.writeFileSync(path.join(foreign, "SKILL.md"), "foreign");
  assert.throws(() => mutate("install", { ...base, providers: ["gemini"] }), /ruta ajena/);
});

test("una instalación Jintia canónica sin manifest exige adopción explícita", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-adopt-"));
  try {
    const source = path.join(root, "source");
    const project = path.join(root, "project");
    const target = path.join(project, ".claude", "skills", "jintia-skill");
    fs.mkdirSync(path.join(source, "bin"), { recursive: true });
    fs.writeFileSync(path.join(source, "SKILL.md"), "---\nname: jintia-skill\n---\n");
    fs.writeFileSync(path.join(source, "package.json"), JSON.stringify({ name: "jintia-skill", version: skillVersion }));
    fs.writeFileSync(path.join(source, "bin", "jintia.js"), "#!/usr/bin/env node\n");
    fs.cpSync(source, target, { recursive: true });
    assert.throws(() => mutate("install", { projectRoot: project, sourcePath: source, providers: ["claude"], scope: "project", version: skillVersion, confirm: true }), /ruta ajena/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("adopta una instalación Jintia válida y preserva configuración mutable", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-adopt-valid-"));
  try {
    const source = path.join(root, "source");
    const project = path.join(root, "project");
    const target = path.join(project, ".claude", "skills", "jintia-skill");
    fs.mkdirSync(path.join(source, "bin"), { recursive: true });
    fs.writeFileSync(path.join(source, "SKILL.md"), "---\nname: jintia-skill\n---\n");
    fs.writeFileSync(path.join(source, "package.json"), JSON.stringify({ name: "jintia-skill", version: skillVersion }));
    fs.writeFileSync(path.join(source, "bin", "jintia.js"), "#!/usr/bin/env node\n");
    fs.mkdirSync(path.join(target, "config"), { recursive: true });
    const institution = Buffer.from('{"institution":"fixture"}');
    const notebooks = Buffer.from('{"notebooks":["fixture"]}');
    fs.writeFileSync(path.join(target, "config", "institution.json"), institution);
    fs.writeFileSync(path.join(target, "config", "notebooks.json"), notebooks);
    fs.writeFileSync(path.join(target, "SKILL.md"), "---\nname: jintia-skill\n---\n");
    fs.writeFileSync(path.join(target, "package.json"), JSON.stringify({ name: "jintia-skill", version: skillVersion }));
    fs.mkdirSync(path.join(target, "bin"), { recursive: true });
    fs.writeFileSync(path.join(target, "bin", "jintia.js"), "#!/usr/bin/env node\n");
    const result = mutate("install", { projectRoot: project, sourcePath: source, providers: ["claude"], scope: "project", version: updateVersion, confirm: true, adoptExisting: true });
    assert.equal(result.results[0].status, "installed");
    assert.equal(JSON.parse(fs.readFileSync(path.join(target, MANIFEST), "utf8")).managedBy, "jintia");
    assert.deepEqual(fs.readFileSync(path.join(target, "config", "institution.json")), institution);
    assert.deepEqual(fs.readFileSync(path.join(target, "config", "notebooks.json")), notebooks);
    assert.equal(fs.readFileSync(path.join(target, "VERSION"), "utf8").trim(), updateVersion);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("una falsa Jintia continúa protegida incluso con adopción", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-adopt-foreign-"));
  try {
    const source = path.join(root, "source");
    const project = path.join(root, "project");
    const target = path.join(project, ".claude", "skills", "jintia-skill");
    fs.mkdirSync(path.join(target, "bin"), { recursive: true });
    fs.writeFileSync(path.join(target, "SKILL.md"), "---\nname: otra-skill\n---\n");
    fs.writeFileSync(path.join(target, "package.json"), JSON.stringify({ name: "otra-skill", version: "1.0.0" }));
    fs.writeFileSync(path.join(target, "bin", "jintia.js"), "foreign\n");
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(path.join(source, "SKILL.md"), "managed\n");
    assert.throws(() => mutate("install", { projectRoot: project, sourcePath: source, providers: ["claude"], scope: "project", version: skillVersion, confirm: true, adoptExisting: true }), /ruta ajena/);
    assert.equal(fs.readFileSync(path.join(target, "bin", "jintia.js"), "utf8"), "foreign\n");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("la CLI adopta una instalación global con --adopt-existing", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-adopt-cli-"));
  try {
    const target = path.join(home, ".claude", "skills", "jintia-skill");
    fs.mkdirSync(path.join(target, "bin"), { recursive: true });
    fs.writeFileSync(path.join(target, "SKILL.md"), "---\nname: jintia-skill\n---\n");
    fs.writeFileSync(path.join(target, "package.json"), JSON.stringify({ name: "jintia-skill", version: skillVersion }));
    fs.writeFileSync(path.join(target, "bin", "jintia.js"), "#!/usr/bin/env node\n");
    const env = { ...process.env, HOME: home, USERPROFILE: home };
    const rejected = spawnSync(process.execPath, [cli, "install", "--providers=claude", "--scope=global", "--yes", "--json"], { encoding: "utf8", env });
    assert.equal(rejected.status, 1, rejected.stderr);
    assert.equal(fs.existsSync(path.join(target, MANIFEST)), false);
    const result = spawnSync(process.execPath, [cli, "install", "--providers=claude", "--scope=global", "--yes", "--adopt-existing", "--json"], { encoding: "utf8", env });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(fs.readFileSync(path.join(target, MANIFEST), "utf8")).managedBy, "jintia");
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("Codex recibe subagentes reales en .codex/agents/, Claude conserva agents/*.md dentro de la skill", () => {
  const { codexAgentsDir } = require("../../packages/core");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-codex-agents-"));
  const source = path.join(root, "source");
  const project = path.join(root, "project");
  fs.mkdirSync(path.join(source, "agents"), { recursive: true });
  fs.writeFileSync(
    path.join(source, "SKILL.md"),
    "---\nname: jintia-skill\ndescription: prueba\nallowed-tools:\n  - Bash(node scripts/*)\n  - Bash(vivliostyle *)\n---\n\n# Cuerpo\n"
  );
  fs.writeFileSync(
    path.join(source, "agents", "jintia-researcher.md"),
    "# Jintia Researcher\n\n## Misión\n\nLocalizar evidencia verificable.\n\n## Límites\n\nNo inventar fuentes.\n"
  );
  const base = { projectRoot: project, sourcePath: source, providers: ["claude", "codex"], scope: "project", version: skillVersion, confirm: true };
  mutate("install", base);

  const claudeAgentsInSkill = path.join(project, ".claude", "skills", "jintia-skill", "agents", "jintia-researcher.md");
  assert.ok(fs.existsSync(claudeAgentsInSkill), "Claude conserva el contrato dentro del paquete de la skill");
  const claudeSkillMd = fs.readFileSync(path.join(project, ".claude", "skills", "jintia-skill", "SKILL.md"), "utf8");
  assert.match(claudeSkillMd, /allowed-tools:/, "Claude conserva allowed-tools en su frontmatter");

  const codexSkillMd = fs.readFileSync(path.join(project, ".agents", "skills", "jintia-skill", "SKILL.md"), "utf8");
  assert.doesNotMatch(codexSkillMd, /allowed-tools/, "Codex no recibe la sintaxis de permisos específica de Claude");
  assert.match(codexSkillMd, /^name: jintia-skill$/m);
  assert.match(codexSkillMd, /^description: prueba$/m);
  assert.match(codexSkillMd, /# Cuerpo/, "el cuerpo del SKILL.md se conserva íntegro");

  const codexAgentToml = path.join(codexAgentsDir("project", project), "jintia-researcher.toml");
  assert.ok(fs.existsSync(codexAgentToml), "Codex recibe el subagente como TOML en .codex/agents/");
  const toml = fs.readFileSync(codexAgentToml, "utf8");
  assert.match(toml, /^name = "jintia-researcher"$/m);
  assert.match(toml, /^description = "Localizar evidencia verificable\."$/m);
  assert.match(toml, /developer_instructions = """/);
  assert.match(toml, /No inventar fuentes\./);

  mutate("uninstall", { ...base, providers: ["codex"] });
  assert.equal(fs.existsSync(codexAgentToml), false, "desinstalar Codex retira el TOML del subagente");
  assert.ok(fs.existsSync(claudeAgentsInSkill), "desinstalar Codex no afecta la instalación de Claude");
});

test("la instalación global de Codex usa la ruta personal oficial .agents/skills", () => {
  const { providerById } = require("../../packages/core");
  const home = path.join(os.tmpdir(), "jintia-home");
  const target = installPath(
    providerById("codex"),
    "global",
    path.join(os.tmpdir(), "jintia-project"),
    home,
    { CODEX_HOME: path.join(home, "custom-codex-home") },
    "win32"
  );
  assert.equal(target, path.join(home, ".agents", "skills", "jintia-skill"));
});

test("la copia instalada en Codex conserva un runtime autocontenido y ejecutable", () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-codex-runtime-"));
  const course = copyFixture("minimal-course");
  const installed = mutate("install", {
    projectRoot: project,
    sourcePath: root,
    providers: ["codex"],
    scope: "project",
    version: skillVersion,
    confirm: true,
  }).results[0].target;

  assert.ok(fs.existsSync(path.join(installed, "runtime", "core", "index.js")));
  assert.ok(fs.existsSync(path.join(installed, "agents", "openai.yaml")));
  const result = spawnSync(
    process.execPath,
    [path.join(installed, "bin", "jintia.js"), "context", "init", course, "--json"],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).data.created, true);
});
