# Operación `audit`

| Entorno | Invocación |
|---|---|
| Claude Code | `/jintia-skill` |
| Codex / OpenAI | `$jintia-skill` |
| CLI directa | `jintia audit` |

Realiza una revisión global sin modificar archivos mediante reglas deterministas.

```bash
node "<skill-root>/bin/jintia.js" audit curso/README.md
node "<skill-root>/bin/jintia.js" audit curso/README.md --json
node "<skill-root>/bin/jintia.js" audit curso/README.md --strict
```

`audit` valida el **sílabo** (`README.md`), no `guide.json`. Para validar una
guía semanal usa `jintia validate` (ver `commands/validate.md`).

Cada incidencia conserva código, categoría, severidad, archivo, línea y
recomendación implícita en el catálogo `rules/catalog.json`.
