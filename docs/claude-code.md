# Jintia en Claude Code

Esta página cubre únicamente instalar y usar la *skill* Jintia dentro de
**Claude Code**. Jintia Desktop (la aplicación gráfica de escritorio, con su
propio instalador y gestión de dependencias del sistema como Python o
Vivliostyle) vive en un repositorio independiente:
[`jintia-desktop`](https://github.com/CharlieCardenasToledo/jintia-desktop).
Este documento no cubre esa aplicación.

## Instalar

```bash
npx @charlie.act7/jintia install --providers=claude --yes
```

Copia la skill en `~/.claude/skills/jintia-skill` (o en el proyecto actual
con `--scope=project`). Reinicia Claude Code para que la descubra.

## Invocar

`/jintia` **no** es el comando registrado. El nombre del plugin es
`jintia-skill`:

```
/jintia-skill planifica la semana 1
/jintia-skill genera la guía de la semana 3
```

## Actualizar / desinstalar / diagnosticar

```bash
npx @charlie.act7/jintia update  --providers=claude --yes
npx @charlie.act7/jintia repair  --providers=claude --yes
npx @charlie.act7/jintia doctor
```

`doctor` verifica Node.js `>=22.13.0`, Vivliostyle CLI, Python y los temas
instalados — no gestiona la autenticación de NotebookLM, que ocurre a través
de las herramientas MCP del harness.

## Siguiente paso

Ver [`docs/getting-started.md`](getting-started.md) para las otras
superficies (Codex/ChatGPT, Cursor) y
[`docs/generate-weekly-guide.md`](generate-weekly-guide.md) para el flujo
completo de generación de una guía.
