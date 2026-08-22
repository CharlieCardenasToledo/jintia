# Reglas deterministas

El catálogo está en `skill/rules/catalog.json`. Cada regla tiene un ID estable,
categoría, severidad y descripción. El ejecutor es
`skill/scripts/rules-runner.js`.

Categorías actuales:

- `syllabus`: contrato y campos mínimos del sílabo (`JIN-SYL-*`);
- `plan`: contrato pedagógico del plan previo a la redacción — targets, matriz de alineación, presupuesto de horas, contrato de evaluación (`JIN-PLN-001..004`, obligatorio salvo que el plan declare `legacy: true`);
- `alignment`: conexión entre resultado y evidencia semanal, y matriz de alineación por target (`JIN-ALN-01x`, opt-in vía `metadata.targets`);
- `bibliography`: claves citadas, `reference.bib` y `citationStyle` (APA obligatorio; `JIN-BIB-*`);
- `evidence`: procedencia NotebookLM / local / conocimiento del modelo (`JIN-EVD-*`, ver `docs/notebooklm.md` y `skill/references/bibliografia.md`). Incluye la validación de `evidence.json` contra su esquema (`JIN-EVD-021`), duplicados (`JIN-EVD-025`), el grafo target → claim → evidencia en publish (`JIN-EVD-026`/`027`) y la trazabilidad de los 3 intentos de NotebookLM (`JIN-EVD-028`);
- `workload`: carga instruccional real (`estimatedMinutes`) vs. `metadata.hours` (`JIN-WRK-*`);
- `self-instruction`: contrato de autoinstruccionalidad de cada `practice` y de `orientation` (modelo, criterios, autocorrección, remediación, recuperación, transferencia — `JIN-SELF-*`, incluidas `JIN-SELF-010..015` en publish: `orientation.purpose/materials/successCriteria/estimatedMinutes` y `practice guided.prompt/steps`);
- `assessment`: criterios, producto observable y alineación de cada `assessment` (`JIN-ASM-01x`);
- `accessibility`: caption y texto alternativo;
- `structure`, `pedagogy`, `pagination`: estructura y secuencia de `guide.json` (`JIN-CNT-*`).

Esta página describe **familias**, no cada regla individual — el catálogo
completo (id, categoría, severidad, descripción) vive en
[`skill/rules/catalog.json`](../skill/rules/catalog.json); es la única
fuente de verdad y se consulta en tiempo de ejecución vía
`skill/runtime/core/rule-catalog.js`. No la copies aquí: si un id o
severidad difiere entre esta página y el catálogo, el catálogo gana.

Las familias `JIN-ALN-01x`, `JIN-WRK-*`, `JIN-SELF-*` y `JIN-ASM-01x` solo se
activan cuando `guide.json` declara `metadata.targets` (o, para `JIN-WRK-*`,
cuando al menos un nodo declara `estimatedMinutes`): son un contrato opcional
que una guía adopta progresivamente, no una exigencia retroactiva sobre
guías que aún no lo usan. Ver `skill/tests/fixtures/golden-flawed-guide.json`
para un ejemplo de guía que pasa validación estructural pero falla estas
reglas.

En **modo publish** (`jintia compile --publish` o `jintia validate`/`jintia
report` con `{ mode: "publish" }` / `--final`, o el orquestador `jintia
ready`) ese carácter opcional se endurece: `metadata.targets` y
`metadata.hours` pasan a ser obligatorios (`JIN-SCH-002`/`003`),
`evidence.json` es obligatorio si hay targets declarados (`JIN-EVD-020`), y
se activan además `JIN-SELF-010..015` y `JIN-EVD-026/027`. Fuera de publish
(draft, `jintia validate` por defecto) nada de esto bloquea guías que aún no
adoptaron el contrato. El contrato del **plan** (`JIN-PLN-*`) es distinto:
se exige siempre en `jintia plan approve`, no solo en publish, salvo
`legacy: true`.

Uso:

```bash
npx @charlie.act7/jintia audit README.md
npx @charlie.act7/jintia audit README.md --json --strict
```

`audit` valida el **sílabo** (`README.md`) contra `JIN-SYL-*`. Para validar
una guía semanal (`guide.json`) usa `jintia validate` (ver
[`docs/cli.md`](cli.md)); Jintia ya no produce ni consume archivos `.tex`.

`--strict` convierte también las advertencias en fallo de proceso. Las reglas
no sustituyen la revisión pedagógica del agente; aportan una base reproducible.
