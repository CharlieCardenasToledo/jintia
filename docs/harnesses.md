# Detección de entornos de agentes

Jintia detecta harnesses por sus carpetas de configuración, no por el modelo
que ejecutan. La detección distingue alcance de proyecto y global, skills
existentes y soporte de hooks.

```bash
npx @charlie.act7/jintia detect . --json
npx @charlie.act7/jintia detect . --providers=claude,codex,cursor --json
```

La selección prioriza proveedores explícitos, luego carpetas del proyecto,
después carpetas globales y finalmente Claude Code y Codex como valores por
defecto. La detección es de solo lectura; instalar una skill o un hook requiere
una acción explícita.

## Estados y ciclo de vida

```bash
npx @charlie.act7/jintia harness status --project ./curso --providers=claude,codex,cursor --json
npx @charlie.act7/jintia harness install --project ./curso --scope=project --providers=claude,codex,cursor --yes
npx @charlie.act7/jintia harness update --project ./curso --scope=global --providers=claude,codex --yes
npx @charlie.act7/jintia harness repair --project ./curso --scope=project --providers=cursor --yes
npx @charlie.act7/jintia harness uninstall --project ./curso --scope=project --providers=cursor --yes
```

Los estados son `not-detected`, `detected`, `installed`, `outdated`,
`incomplete` y `repair-needed`. Las instalaciones gestionadas conservan
`.jintia-install.json` y `VERSION`; una ruta existente sin esa marca nunca se
sobrescribe. Las mutaciones requieren `--yes` y aceptan varios proveedores.

## Diferencias por proveedor

`harness install` copia el mismo paquete de la skill (`SKILL.md`, `commands/`,
`references/`, `scripts/`, `templates/`, `rules/`, `schemas/`) a cualquier
proveedor porque esa parte es agnóstica al agente. Dos piezas sí requieren
adaptación por proveedor, verificada contra la documentación oficial de cada
uno:

**Subagentes.** Claude Code lee los contratos de `agents/*.md` como
referencia de delegación dentro de la propia skill. Codex CLI define
subagentes como archivos TOML independientes en `.codex/agents/` (proyecto) o
`~/.codex/agents/` (global), con los campos `name`, `description` y
`developer_instructions` — no dentro del paquete de la skill
([developers.openai.com/codex/subagents](https://developers.openai.com/codex/subagents)).
`harness install --providers=codex` genera automáticamente esos `.toml` a
partir de `agents/*.md` (título → `name`, sección "Misión" → `description`,
archivo completo → `developer_instructions`) y los coloca en la ubicación que
Codex espera. `harness uninstall --providers=codex` los retira.

**MCP de NotebookLM.** Claude Code y Claude Desktop usan `.mcp.json` /
`claude_desktop_config.json` con una clave `mcpServers` en JSON. Codex CLI
registra servidores MCP en `~/.codex/config.toml` (TOML), no en JSON. Jintia
no escribe ese archivo global automáticamente porque es personal del usuario;
agrégalo a mano una vez:

```toml
[mcp_servers.notebooklm]
command = "npx"
args = ["-y", "@charlie.act7/gemini-notebook-mcp@<mcp.version>"]
```

Sustituye `<mcp.version>` por el valor exacto de `mcp.version` en
[`release/release-config.json`](../release/release-config.json) — esa es la
única fuente de verdad; no fijar aquí un número de versión que pueda
desincronizarse en el próximo release.

`openai-plugin/.mcp.json` es un archivo distinto: alimenta el plugin/conector
de la app de ChatGPT (`~/.codex/plugins/jintia/.mcp.json` +
`marketplace.json`), no la configuración personal de Codex CLI.
