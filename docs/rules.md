# Reglas deterministas

El catálogo está en `skill/rules/catalog.json`. Cada regla tiene un ID estable,
categoría, severidad y descripción. El ejecutor es
`skill/scripts/rules-runner.js`.

Categorías actuales:

- `syllabus`: contrato y campos mínimos del sílabo;
- `alignment`: conexión entre resultado y evidencia semanal, y matriz de alineación por target (`JIN-ALN-01x`, opt-in vía `metadata.targets`);
- `bibliography`: claves citadas, `reference.bib` y `citationStyle` (APA obligatorio; `JIN-BIB-*`);
- `evidence`: procedencia NotebookLM / local / conocimiento del modelo (`JIN-EVD-*`, ver `SKILL.md` §2, y validación de `evidence.json` opcional);
- `workload`: carga instruccional real (`estimatedMinutes`) vs. `metadata.hours` (`JIN-WRK-*`);
- `self-instruction`: contrato de autoinstruccionalidad de cada `practice` (modelo, criterios, autocorrección, remediación, recuperación, transferencia — `JIN-SELF-*`);
- `assessment`: criterios, producto observable y alineación de cada `assessment` (`JIN-ASM-01x`);
- `accessibility`: caption y texto alternativo;
- `structure`, `pedagogy`, `pagination`: estructura y secuencia de `guide.json` (`JIN-CNT-*`).

Las familias `JIN-ALN-01x`, `JIN-WRK-*`, `JIN-SELF-*` y `JIN-ASM-01x` solo se
activan cuando `guide.json` declara `metadata.targets` (o, para `JIN-WRK-*`,
cuando al menos un nodo declara `estimatedMinutes`): son un contrato opcional
que una guía adopta progresivamente, no una exigencia retroactiva sobre
guías que aún no lo usan. Ver `skill/tests/fixtures/golden-flawed-guide.json`
para un ejemplo de guía que pasa validación estructural pero falla estas
reglas.

En **modo publish** (`jintia compile --publish` o `jintia validate`/`jintia
report` con `{ mode: "publish" }` / `--final`) ese carácter opcional se
endurece: `metadata.targets` y `metadata.hours` pasan a ser obligatorios
(`JIN-SCH-002`/`003`), y `evidence.json` es obligatorio si hay targets
declarados (`JIN-EVD-020`). Fuera de publish (draft, `jintia validate` por
defecto) nada de esto bloquea guías que aún no adoptaron el contrato.

Uso:

```bash
npx @charlie.act7/jintia audit README.md
npx @charlie.act7/jintia audit guia.tex --json
npx @charlie.act7/jintia audit guia.tex --strict
```

`--strict` convierte también las advertencias en fallo de proceso. Las reglas
no sustituyen la revisión pedagógica del agente; aportan una base reproducible.
