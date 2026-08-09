# Jintia Skill

Open instructional-design skill for producing complete, verifiable, and
compilable academic guides with Claude, ChatGPT, and Codex.

The installer application now lives in its own repository:
[`jintia-desktop`](https://github.com/CharlieCardenasToledo/jintia-desktop).
This repository contains only the skill, templates, runtime, tests, and release
artifacts.

## Capabilities

- instructional planning and evidence traceability;
- HTML themes (jintia-clasico, jintia-tecnico, jintia-cuaderno) with Vivliostyle PDF output;
- schema, HTML, and visual-quality validation;
- reproducible visual generation with fallbacks;
- optional NotebookLM integration;
- specialized agent contracts for research, review, and final production.

## Installation

### With npx (recommended)

Requires Node.js 18 or newer. From the project root where Jintia will be used,
run:

```bash
npx @charlie.act7/jintia install
```

The installer detects available harnesses, asks for the scope, and confirms
before writing. For non-interactive automation:

```bash
npx @charlie.act7/jintia install --providers=claude,codex --scope=project --yes
```

Run `npx @charlie.act7/jintia update` to refresh a managed installation, then
restart Claude Code or Codex so it discovers the skill.

Alternatively, download the desktop installer from
[Jintia Desktop releases](https://github.com/CharlieCardenasToledo/jintia-desktop/releases).

For manual installation, each
[skill release](https://github.com/CharlieCardenasToledo/jintia/releases)
publishes a Claude ZIP, a universal ChatGPT/Codex plugin ZIP, and a manifest
with versions and SHA-256 hashes. Extract the Claude ZIP to
`~/.claude/skills/jintia-skill`, keeping `SKILL.md` at its root, or import the
universal plugin through a compatible plugin manager.

## NotebookLM MCP

The integration uses a pinned version of
[`@charlie.act7/gemini-notebook-mcp`](https://www.npmjs.com/package/@charlie.act7/gemini-notebook-mcp),
also maintained by Charlie Cárdenas Toledo. Release 10.9.2 pins version 2.3.3
and requires Node.js 22.13 or newer.

## Development

```bash
npm ci
npm run docs:check
npm run skill:check
npm run release:check
npm run release:skill
npm run release:skill:check
```

Tags matching `v*` test the skill, build both ZIPs from canonical Git blobs,
and publish the manifest, checksums, and provenance attestations.

## Name origin

Jintia takes its name from **Jíntia**, recorded in Shuar Chicham with the
meaning “path.” **Aarma jintia** appears in Ecuador's National Intercultural
Bilingual Curriculum for the Shuar Nationality in reference to instructional
texts. Use of the name does not imply representation, approval, or institutional
affiliation with Shuar communities or organizations.

See [`docs/brand-guidelines.md`](docs/brand-guidelines.md) for full attribution
and sources.

## License

MIT © 2026 Charlie Cárdenas Toledo. Third-party templates and resources retain
their own licenses; see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
