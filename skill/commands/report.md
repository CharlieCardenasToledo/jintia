# Operación `report`

| Entorno | Invocación |
|---|---|
| Claude Code | `/jintia-skill` |
| Codex / OpenAI | `$jintia-skill` |
| CLI directa | `jintia report --final` |

Genera el **JINTIA QUALITY REPORT**: un resumen de lectura rápida sobre si
una guía está lista para publicación, agregando lo que ya valida `jintia
validate` (alineación por target, contrato de autoinstruccionalidad, carga
académica, procedencia de evidencia y estado de la bibliografía) en una
sola decisión final.

No sustituye `jintia validate` (estructura/esquema) ni `jintia compile
--publish` (degradación bibliográfica en el HTML renderizado): reformula su
salida para lectura humana rápida, no reimplementa sus reglas.

```bash
node "<skill-root>/bin/jintia.js" report semanas/semana-03/guide.json
node "<skill-root>/bin/jintia.js" report semanas/semana-03/guide.json --json
node "<skill-root>/bin/jintia.js" report semanas/semana-03/guide.json --final
```

## Modo `--final`

Sin `--final`, `report` es una lectura rápida en modo draft: no exige
`metadata.targets`, `metadata.hours` ni `evidence.json`, y no corre el gate
bibliográfico de publicación. Es posible (y esperado) que `report` diga
`READY` y `jintia compile --publish` bloquee después — son preguntas
distintas.

Con `--final`, `report` corre el mismo gate que `jintia compile --publish`
sin necesidad de renderizar: exige `metadata.targets`/`metadata.hours`
(`JIN-SCH-002`/`003`), `evidence.json` cuando hay targets declarados
(`JIN-EVD-020`), y el gate bibliográfico completo (`assertPublishReady()`:
Citation.js, `.bib`, claves, estilo APA). `FINAL DECISION: READY` en modo
`--final` sí implica que `jintia compile --publish` no debería bloquear por
ninguna de esas causas.

`--final` **no** sustituye la revisión de `agents/jintia-selfstudy-reviewer.md`
ni `agents/jintia-finish-reviewer.md`: esos son contratos en lenguaje
natural para un agente, no scripts deterministas que este comando pueda
invocar. `READY` en `--final` es una condición necesaria, no suficiente,
para declarar la guía lista para publicación.

## Secciones del reporte

- **Alineación (targets)**: cuántos targets de `metadata.targets` están
  enseñados, practicados, evaluados y con feedback/autocorrección. Solo
  aparece si `metadata.targets` está declarado.
- **Autoinstruccionalidad**: PASS/FAIL por cada componente del contrato
  `JIN-SELF-*` (ruta, ejemplos trabajados, criterios de éxito,
  autocorrección, remediación, recuperación, comprobación final,
  monitorización, transferencia).
- **Carga académica**: horas declaradas vs. planificadas y cobertura,
  según `JIN-WRK-*`.
- **Procedencia de evidencia**: si existe `evidence.json`, el desglose por
  `sourceMode` y la clasificación `academicProvenance`
  (`STRONG`/`GOOD`/`DEGRADED`/`WEAK`/`BLOCKED`).
- **Bibliografía**: estilo declarado y si hay incidencias `JIN-BIB-*`.

## Decisión final

- `READY`: sin errores ni advertencias en `jintia validate`.
- `NEEDS_CHANGES`: sin errores, pero con advertencias pendientes.
- `BLOCKED`: al menos un error — la guía no debería publicarse.

`BLOCKED` produce código de salida 1, útil para CI o hooks.
