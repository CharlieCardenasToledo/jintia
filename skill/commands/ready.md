# Operación `ready`

| Entorno | Invocación |
|---|---|
| Claude Code | `/jintia-skill` |
| Codex / OpenAI | `$jintia-skill` |
| CLI directa | `jintia ready` |

El orquestador completo de publicación. Corre, en orden, todo lo
**determinista** que separa "el AST parece publicable" de "el material
está listo para entregarse":

```text
validate --publish
  → evidence provenance
  → bibliografía (pre-render)
  → render
  → html-lint
  → bibliografía (post-render)
  → preflight
  → compile (PDF)
```

```bash
node "<skill-root>/bin/jintia.js" ready semanas/semana-03/guide.json
node "<skill-root>/bin/jintia.js" ready semanas/semana-03/guide.json --json
node "<skill-root>/bin/jintia.js" ready semanas/semana-03/guide.json --skip-pdf
```

Se detiene en el primer paso bloqueante en vez de seguir corriendo pasos
posteriores sobre una guía que ya se sabe inválida: si `validate --publish`,
la bibliografía pre-render, `html-lint`, la bibliografía post-render o
`preflight` fallan, no continúa a los pasos siguientes.

`--skip-pdf` omite el paso de `compile`; útil en entornos sin Vivliostyle
CLI instalado (`npm install --global @vivliostyle/cli`) — todos los demás
pasos deterministas igual se ejecutan, pero la decisión final queda como
`PRECHECK_READY` (no `READY`): omitir el PDF a propósito no es lo mismo que
cerrar la publicación por completo.

Sin `--skip-pdf`, si Vivliostyle CLI no está instalado, el paso `compile
(PDF)` se registra como error y la decisión final es `BLOCKED`: se pidió
explícitamente el cierre completo y no se pudo alcanzar. Usa `--skip-pdf`
si solo quieres un precheck sin PDF.

### Decisiones posibles

| Decisión | Significado |
|---|---|
| `READY` | Todos los pasos, incluido `compile (PDF)`, terminaron en `ok`. |
| `PRECHECK_READY` | Todo lo demás en `ok`; `compile (PDF)` quedó `skipped` por `--skip-pdf`. |
| `NEEDS_CHANGES` | Sin errores bloqueantes, pero hay advertencias pendientes. |
| `BLOCKED` | Algún paso terminó en `error` (incluye Vivliostyle ausente sin `--skip-pdf`). |

## Lo que NO hace

`jintia ready` **no invoca** a `agents/jintia-selfstudy-reviewer.md` ni a
`agents/jintia-finish-reviewer.md`: son contratos de agente en lenguaje
natural (juicio pedagógico y editorial), no scripts deterministas que un
comando de CLI pueda ejecutar por sí mismo.

`DETERMINISTIC DECISION: READY` es una condición **necesaria, no
suficiente**. El reporte siempre recuerda confirmar por separado, antes de
compartir el material:

1. `agents/jintia-selfstudy-reviewer.md` → decisión `PASS`.
2. `agents/jintia-finish-reviewer.md` → decisión `ready`.

Solo cuando las tres señales coinciden (`jintia ready` determinista +
selfstudy-reviewer + finish-reviewer) la guía está realmente lista para
publicarse.

## Relación con `jintia report --final` y `jintia compile --publish`

- `jintia report --final`: lectura rápida sin renderizar (no genera HTML/PDF).
- `jintia compile --publish`: genera el PDF y bloquea ante degradación bibliográfica, pero no corre `preflight` ni `html-lint` automáticamente.
- `jintia ready`: superconjunto de ambos — es el único comando que corre la cadena completa de un solo golpe.
