# Jintia Skill

Open instructional-design skill for producing complete, verifiable, and
compilable academic guides with Claude, ChatGPT, and Codex.

The installer application now lives in its own repository:
[`jintia-desktop`](https://github.com/CharlieCardenasToledo/jintia-desktop).
This repository contains only the skill, templates, runtime, tests, and release
artifacts.

## Capabilities

- instructional planning (`jintia plan`) with a pedagogical contract enforced before drafting: outcomes decomposed into `targets`, an alignment matrix (teaching, practice, feedback, assessment, evidence), workload budget, and assessment contract;
- evidence traceability with declared provenance per claim: NotebookLM (primary, 3 attempts) → local fallback → model knowledge (`ai-fallback`, last resort, never fabricates bibliography) — see `evidence.json`;
- HTML themes (jintia-clasico, jintia-tecnico, jintia-cuaderno) with Vivliostyle PDF output;
- schema, HTML, and visual-quality validation, plus a single deterministic closing command (`jintia ready`) that chains validation, evidence provenance, bibliography, rendering, linting, preflight, and PDF compilation;
- reproducible visual generation with fallbacks;
- specialized agent contracts for research, self-study review, and final production.

## Invocation surfaces

| Surface | Invocation |
|---|---|
| Claude Code | `/jintia-skill` (not `/jintia`) |
| Codex / ChatGPT | `$jintia-skill` |
| Direct CLI | `jintia <command>` |

## Installation

### With npx (recommended)

Requires Node.js `>=22.13.0` (see `engines` in `package.json`). From the
project root where Jintia will be used, run:

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
also maintained by Charlie Cárdenas Toledo, per
[`release/release-config.json`](release/release-config.json) — never `@latest`.
See [`docs/notebooklm.md`](docs/notebooklm.md) for the full evidence-provenance
policy (NotebookLM-first, local fallback, `ai-fallback` as last resort).

## Development

```bash
npm ci
npm --prefix skill ci
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
