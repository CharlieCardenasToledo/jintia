# Operación `doctor`

| Entorno | Invocación |
|---|---|
| Claude Code | `/jintia-skill` |
| Codex / OpenAI | `$jintia-skill` |
| CLI directa | `jintia doctor` |

Diagnostica dependencias y contratos locales:

```bash
node "<skill-root>/bin/jintia.js" doctor
node "<skill-root>/bin/jintia.js" doctor --json
```

El modo JSON permite que Jintia Desktop u otra integración presenten el mismo
diagnóstico sin duplicar comprobaciones.
