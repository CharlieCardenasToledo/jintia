# Reglas deterministas

El catálogo está en `skill/rules/catalog.json`. Cada regla tiene un ID estable,
categoría, severidad y descripción. El ejecutor es
`skill/scripts/rules-runner.js`.

Categorías actuales:

- `syllabus`: contrato y campos mínimos del sílabo;
- `alignment`: conexión entre resultado y evidencia semanal;
- `bibliography`: claves citadas, `reference.bib` y `citationStyle` (APA obligatorio; `JIN-BIB-*`);
- `evidence`: procedencia NotebookLM / local / conocimiento del modelo (`JIN-EVD-*`, ver `SKILL.md` §2);
- `accessibility`: caption y texto alternativo;
- `structure`, `pedagogy`, `pagination`: estructura y secuencia de `guide.json` (`JIN-CNT-*`).

Uso:

```bash
npx @charlie.act7/jintia audit README.md
npx @charlie.act7/jintia audit guia.tex --json
npx @charlie.act7/jintia audit guia.tex --strict
```

`--strict` convierte también las advertencias en fallo de proceso. Las reglas
no sustituyen la revisión pedagógica del agente; aportan una base reproducible.
