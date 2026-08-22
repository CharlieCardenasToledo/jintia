# `/jintia report`

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
```

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
