# Operación `state`

| Entorno | Invocación |
|---|---|
| Claude Code | `/jintia-skill` |
| Codex / OpenAI | `$jintia-skill` |
| CLI directa | `jintia state update` |

Registra el estado editorial de una semana sin sobrescribir el contenido del
curso:

```bash
node "<skill-root>/bin/jintia.js" state update ./curso 03 compiled ./curso/semanas/semana-03/README.md
```

La salida se guarda en `curso/.jintia/state.json` e incluye fecha y hash de la
fuente cuando se proporciona.
