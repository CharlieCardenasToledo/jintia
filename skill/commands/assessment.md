# `/jintia assessment`

Diseña una evaluación, rúbrica, banco de preguntas o estudio de caso alineado
con un resultado del sílabo. Conserva código, ponderación y criterios
observables cuando existan en el curso.

## Estructura obligatoria del nodo `assessment`

Además de `format`/`items` (banco de preguntas libre), toda actividad
calificada o formal debe declarar en `guide.json`:

- `code`: código de la actividad según el sílabo (ej. `"PE-1.1"`);
- `targetIds`: qué targets de `metadata.targets` evalúa;
- `product`: el producto observable esperado (obligatorio — `JIN-ASM-011`);
- `criteria`: lista de `{ description, weight }` (obligatoria — `JIN-ASM-010`);
- `score`: ponderación según el sílabo, si es calificada;
- `checklist`: checklist de entrega para el estudiante.

Sin `product` ni `criteria`, `jintia validate` bloquea con `JIN-ASM-010`/
`JIN-ASM-011`. Un `targetIds` ausente o con un id que no existe en
`metadata.targets` bloquea con `JIN-ASM-012`. Si varias actividades declaran
`score`, la suma no debería superar 100 (`JIN-ASM-013`, advertencia). Ver
`guide.schema.json` para la forma exacta y `rules/catalog.json` para el
catálogo completo de las reglas `JIN-ASM-*`.
