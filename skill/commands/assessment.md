# `/jintia assessment`

Diseña una evaluación, rúbrica, banco de preguntas o estudio de caso alineado
con un resultado del sílabo. Conserva código, ponderación y criterios
observables cuando existan en el curso.

## Estructura obligatoria del nodo `assessment`

Además de `format`/`items` (banco de preguntas libre), toda actividad
calificada o formal debe declarar en `guide.json`:

- `code`: código de la actividad según el sílabo (ej. `"PE-1.1"`);
- `targetIds`: qué targets de `metadata.targets` evalúa;
- `instructions`: instrucciones de la actividad para el estudiante;
- `product`: el producto observable esperado (obligatorio — `JIN-ASM-011`);
- `criteria`: lista de `{ description, weight }` (obligatoria — `JIN-ASM-010`);
- `points`: puntaje/ponderación según el sílabo, si es calificada;
- `submissionChecklist`: checklist de entrega para el estudiante.

Sin `product` ni `criteria`, `jintia validate` bloquea con `JIN-ASM-010`/
`JIN-ASM-011`. Un `targetIds` ausente o con un id que no existe en
`metadata.targets` bloquea con `JIN-ASM-012`. Si `code` coincide con una
actividad del sílabo (formato `- CÓDIGO — Nombre — N puntos` o `[CÓDIGO]
Nombre (N%)`, ver `references/esquema-silabo.md`), `points` debe coincidir
con el puntaje declarado allí — si difiere, bloquea con `JIN-ASM-013`; si la
suma de puntos con código conocido no coincide con la suma del sílabo,
advierte con `JIN-ASM-016`. Una actividad calificable o extensa
(`estimatedMinutes > 60`) sin `submissionChecklist` advierte con
`JIN-ASM-014`; una extensa con `criteria` sin ponderación por criterio
advierte con `JIN-ASM-015`. Ver `guide.schema.json` para la forma exacta y
`rules/catalog.json` para el catálogo completo de las reglas `JIN-ASM-*`.
