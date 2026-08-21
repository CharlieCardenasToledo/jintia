import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { lstat, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import yazl from "yazl";

const root = resolve(import.meta.dirname, "..");
const skillRoot = join(root, "skill");
const pluginRoot = join(root, "openai-plugin");
const fixedMtime = new Date("1980-01-01T00:00:00.000Z");
const skillDirectories = ["references", "scripts", "runtime", "themes", "config", "agents", "commands", "bin", "rules", "schemas", "assets"];
const skillFiles = ["SKILL.md", "requirements.txt", "package.json"];
const privateConfigNames = new Set(["config/institution.json", "config/notebooks.json"]);

const json = async path => JSON.parse(await readFile(path, "utf8"));
const posix = value => value.split(sep).join("/");
const gitBlob = repoPath => execFileSync("git", ["show", `HEAD:${repoPath}`], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
const archivedFile = (source, archive) => ({ source, repoPath: posix(relative(root, source)), archive });

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`No se permiten enlaces simbólicos en releases: ${path}`);
    if (entry.isDirectory()) files.push(...await filesBelow(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

async function skillEntries(prefix) {
  const entries = [];
  for (const name of skillFiles) entries.push(archivedFile(join(skillRoot, name), `${prefix}/${name}`));
  entries.push(archivedFile(join(root, "LICENSE"), `${prefix}/LICENSE`));
  for (const directory of skillDirectories) {
    for (const source of await filesBelow(join(skillRoot, directory))) {
      const local = posix(relative(skillRoot, source));
      if (!privateConfigNames.has(local)) entries.push(archivedFile(source, `${prefix}/${local}`));
    }
  }
  return entries.sort((left, right) => left.archive.localeCompare(right.archive));
}

async function writeZip(destination, entries, extra = []) {
  const zip = new yazl.ZipFile();
  for (const entry of [...entries, ...extra].sort((left, right) => left.archive.localeCompare(right.archive))) {
    const bytes = entry.bytes ?? (entry.repoPath ? gitBlob(entry.repoPath) : await readFile(entry.source));
    const executable = bytes.subarray(0, 2).toString() === "#!";
    zip.addBuffer(bytes, entry.archive, { mtime: fixedMtime, mode: executable ? 0o100755 : 0o100644 });
  }
  zip.end();
  await pipeline(zip.outputStream, createWriteStream(destination));
}

async function digest(path) {
  const bytes = await readFile(path);
  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: (await stat(path)).size
  };
}

const skillPackage = await json(join(skillRoot, "package.json"));
const claudePlugin = await json(join(skillRoot, ".claude-plugin", "plugin.json"));
const openaiPlugin = await json(join(pluginRoot, ".codex-plugin", "plugin.json"));
const releaseConfig = await json(join(root, "release", "release-config.json"));
const version = skillPackage.version;

const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: root, encoding: "utf8" }).trim();
if (dirty && process.env.JINTIA_ALLOW_DIRTY_RELEASE !== "1") {
  throw new Error("El árbol Git contiene cambios sin confirmar. Confírmalos antes de producir artefactos publicables.");
}

for (const [label, actual] of [["Claude", claudePlugin.version], ["OpenAI", openaiPlugin.version]]) {
  if (actual !== version) throw new Error(`${label} declara ${actual}; se esperaba ${version}.`);
}

const configuredMcp = await json(join(pluginRoot, ".mcp.json"));
const expectedMcp = `${releaseConfig.mcp.package}@${releaseConfig.mcp.version}`;
if (configuredMcp.notebooklm?.args?.at(-1) !== expectedMcp) {
  throw new Error(`openai-plugin/.mcp.json no fija ${expectedMcp}.`);
}

const output = join(root, "dist", "release", `v${version}`);
await mkdir(output, { recursive: true });
const skillName = `jintia-skill-${version}.zip`;
const pluginName = `jintia-openai-plugin-${version}.zip`;
const skillPath = join(output, skillName);
const pluginPath = join(output, pluginName);
const versionEntry = prefix => ({ archive: `${prefix}/VERSION`, bytes: Buffer.from(`${version}\n`) });

await writeZip(skillPath, await skillEntries("jintia-skill"), [versionEntry("jintia-skill")]);
const pluginEntries = [
  archivedFile(join(pluginRoot, ".codex-plugin", "plugin.json"), "jintia/.codex-plugin/plugin.json"),
  archivedFile(join(pluginRoot, ".mcp.json"), "jintia/.mcp.json"),
  archivedFile(join(pluginRoot, "README.md"), "jintia/README.md"),
  ...await skillEntries("jintia/skills/jintia-skill")
];
await writeZip(pluginPath, pluginEntries, [versionEntry("jintia/skills/jintia-skill")]);

const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const manifest = {
  schemaVersion: 1,
  skillVersion: version,
  minimumDesktopVersion: releaseConfig.minimumDesktopVersion,
  source: { repository: releaseConfig.repository, commit },
  compatibility: ["claude", "codex", "chatgpt"],
  mcp: releaseConfig.mcp,
  artifacts: {
    skill: { file: skillName, ...await digest(skillPath), installRoot: "jintia-skill" },
    openaiPlugin: { file: pluginName, ...await digest(pluginPath), installRoot: "jintia" }
  }
};
const manifestPath = join(output, "jintia-release-manifest.json");
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
const sums = Object.values(manifest.artifacts).map(artifact => `${artifact.sha256}  ${artifact.file}`).join("\n");
await writeFile(join(output, "SHA256SUMS"), `${sums}\n`);
console.log(`Release reproducible preparada en ${relative(root, output)} (${basename(skillPath)}, ${basename(pluginPath)}).`);
