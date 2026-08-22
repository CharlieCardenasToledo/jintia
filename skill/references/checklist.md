# Checklist Final Obligatorio

Referencia de `jintia-skill`. Ejecutar esta verificación completa antes de entregar cualquier guía generada o editada.

**Flujo de arranque**
- [ ] El `README.md` del curso fue leído antes de comenzar la generación.
- [ ] La evidencia fue resuelta en el orden definido. NotebookLM se consultó cuando estaba disponible o se documentó la fuente local equivalente.
- [ ] Los datos de la semana (temas, RA, bibliografía, actividades) se extrajeron del README, no se solicitaron al usuario.

**`guide.json` — estructura**
- [ ] El archivo existe y es JSON sintácticamente válido.
- [ ] `metadata` contiene `course`, `week`, `topic` y `outcome` no vacíos.
- [ ] `metadata.theme` es uno de `jintia-clasico`, `jintia-tecnico` o `jintia-cuaderno`.
- [ ] `sections` tiene al menos un elemento.
- [ ] El primer nodo es de tipo `orientation`.
- [ ] Todos los `id` de nodo son únicos y siguen el patrón `[a-z0-9-]+`.
- [ ] No existen tipos de nodo fuera del esquema canónico.
- [ ] El nodo `bibliography` es el último de la secuencia (si hay citas).
- [ ] El nodo `assessment` está precedido por un nodo `practice` o `scenario`.
- [ ] No existen secciones de relleno creadas para completar una numeración fija.

**Secuencia y orden canónico**
- [ ] La secuencia sigue: `orientation` → teoría (`theory`, `concept`) → aplicación (`scenario`) → evaluación (`assessment`) → `bibliography`.
- [ ] El escenario aparece **después** de todas las secciones de teoría.
- [ ] La activación del problema técnico ocurre dentro de las secciones de teoría, no antes.

**Nodo `orientation`**
- [ ] Explica el propósito de la semana sin listar el RA textualmente.
- [ ] Cierra con el tiempo estimado de trabajo.
- [ ] No enumera los títulos de las secciones subsiguientes.

**Escritura y tono**
- [ ] No hay muletillas de IA ni metáforas no técnicas.
- [ ] Las transiciones entre secciones surgen de causalidad técnica.
- [ ] El documento es autoinstruccional: se entiende sin la presencia del docente.
- [ ] Las oraciones no superan ~20 palabras. Las que superan 35 palabras están partidas en dos proposiciones causales.
- [ ] El primer párrafo de cada sección (excepto la primera) conecta con la sección anterior — interleaving explícito.
- [ ] Cada término técnico central usa el mismo nombre canónico en toda la guía — sin sinónimos decorativos.
- [ ] El `field` `content` usa `<span class="jintia-keyterm">término</span>` únicamente en la primera aparición de cada término clave.

**Control de redundancia**
- [ ] Ningún concepto o distinción técnica se explica en más de una sección. Si aparece en dos, consolidar en la primera y referenciar desde la segunda.
- [ ] El primer párrafo de una sección de teoría conecta con la anterior pero **no repite** su contenido.
- [ ] Los ejemplos del escenario no repiten los mismos ejemplos usados en las secciones de teoría.
- [ ] Los criterios de clasificación aparecen en una sola sección; el escenario los aplica sin redefinirlos.

**Nodos de bloque especiales**
- [ ] Los nodos `warning` contienen únicamente advertencias con consecuencia operativa real.
- [ ] Los nodos `critical-error` incluyen: supuesto incorrecto, consecuencia, mecanismo causal y respuesta.
- [ ] Los nodos `margin-note` son complementarios; instrucciones, resultados y criterios esenciales están en el flujo principal.
- [ ] Cuando una sección introduce tres o más conceptos, se evaluó si un nodo `practice` de recuperación mejora el aprendizaje.

**Nodos `figure`**
- [ ] Todo nodo `figure` declara `alt` y `caption` no vacíos.
- [ ] El párrafo previo en `content` menciona la figura por su `id` (ej. `[fig-ejemplo]`).
- [ ] Cada sección usa como máximo una figura o una tabla, salvo justificación pedagógica explícita.
- [ ] Toda figura tiene especificación, fuente editable, salida renderizada y entrada en `figure/manifest.json`.
- [ ] La procedencia, licencia y cualquier fallback están registrados.
- [ ] SVG y HTML no contienen recursos remotos, animaciones, texto menor de 10 px ni elementos recortables por falta de `viewBox`.
- [ ] El contraste de texto declarado es al menos 4.5:1.
- [ ] Los gráficos cuantitativos incluyen tabla de datos accesible.

**Nodos `table`**
- [ ] Todo nodo `table` declara `caption` y `headers` no vacíos.
- [ ] Las tablas no superan el ancho imprimible A4 (evitar más de 6 columnas sin justificación).

**Nodos `citation` y `bibliography`**
- [ ] No se inventaron referencias. Toda fuente pasó por el workflow de la Política de Evidencia (`bibliografia.md`).
- [ ] El documento NO contiene etiquetas `[Pendiente de Verificación]`.
- [ ] Cada clave en nodos `citation` existe en `reference.bib`.
- [ ] `metadata.bibliography` apunta a `reference.bib` cuando existen nodos `citation`.
- [ ] `reference.bib` existe y tiene una entrada BibLaTeX por cada clave citada.
- [ ] Cuando la fuente original es un PDF local, existe un recorte trazable en `bibliografia/recortes_por_semana/semana-XX/`.

**Figuras de interfaz HTML (solo si la guía las incluye)**
- [ ] Cada vista de interfaz es un archivo HTML separado en `figure/`, con contenedor raíz `w-[390px]` y sin carcasa de teléfono.
- [ ] Los colores usan el branding institucional configurado o una paleta justificada.
- [ ] Los PNG fueron generados con `node screenshot.mjs` **antes** de compilar el HTML final.

**Targets, práctica y evaluación estructurada (si `metadata.targets` está declarado)**
- [ ] Cada target tiene al menos una sección de enseñanza, una práctica formativa y una evaluación (`JIN-ALN-010/011/013`).
- [ ] Ningún nodo `assessment` evalúa un target sin sección de enseñanza previa (`JIN-ALN-014`), **y el orden real respeta enseñanza/práctica antes de la evaluación** (`JIN-ALN-017`).
- [ ] El nodo `orientation` declara `route` (ruta de aprendizaje) no vacía (`JIN-SELF-001`).
- [ ] Toda práctica con `mode: "guided"` (o sin `mode`) declara `workedExample` (`JIN-SELF-002`).
- [ ] Toda práctica declara `successCriteria` y (`selfCheck` o `feedback`) (`JIN-SELF-003/004`).
- [ ] Toda práctica `guided`/`independent` declara `remediation` (`JIN-SELF-005`, por práctica, no basta con una sola en toda la guía).
- [ ] Existe al menos una práctica `retrieval` y una `transfer`, y al menos una declara `selfCheck` a nivel de guía (`JIN-SELF-006/008/009`, advertencia).
- [ ] El conjunto de nodos `assessment` cubre, entre todos, cada target declarado (`JIN-SELF-007`).
- [ ] Todo nodo `assessment` declara `product` y `criteria` con targetIds válidos (`JIN-ASM-010/011/012`).
- [ ] Si `code` coincide con una actividad del sílabo, `points` coincide con el puntaje declarado allí (`JIN-ASM-013`), y la suma de puntos con código conocido coincide con la suma del sílabo (`JIN-ASM-016`).
- [ ] Actividades calificables o extensas declaran `submissionChecklist`, y las extensas con criterios declaran ponderación por criterio (`JIN-ASM-014/015`).
- [ ] La carga horaria planificada (`estimatedMinutes`) cae entre 90-110% de `metadata.hours` (`JIN-WRK-001/002`); cada bloque relevante declara `estimatedMinutes` (`JIN-WRK-003`); la carga no está concentrada en enseñanza ni la evaluación desproporciona la práctica (`JIN-WRK-004/005`).
- [ ] Ninguna sección extensa de teoría/concepto queda sin `targetIds` (`JIN-ALN-016`).

**Modo publish (`jintia compile --publish` / `jintia report --final`)**
- [ ] `metadata.targets` y `metadata.hours` están declarados (`JIN-SCH-002/003`).
- [ ] `evidence.json` existe cuando hay targets declarados (`JIN-EVD-020`).

**`evidence.json` (si existe)**
- [ ] Todo `claimId` referenciado desde `guide.json` existe en `evidence.json` (`JIN-EVD-005`).
- [ ] Todo keyClaim declara `sourceMode` (`JIN-EVD-010`).
- [ ] Todo keyClaim `notebook-primary` declara `evidence.sourceId`/`sourceName`/`extractionStatus` reales (`JIN-EVD-017`); todo `local-fallback` identifica la fuente local (`JIN-EVD-018`).
- [ ] `evidence.json` declara el mismo `week` que `guide.json`, si lo declara (`JIN-EVD-019`).
- [ ] Toda `bibliographyKey` declarada existe en `reference.bib` (`JIN-EVD-012`).
- [ ] Ninguna afirmación con `sourceMode: "ai-fallback"` declara `bibliographyKey` (`JIN-EVD-014`).
- [ ] El `academicProvenance` calculado no es `BLOCKED` (`JIN-EVD-016`); si es `DEGRADED` (`JIN-EVD-015`), se revisó conscientemente.

**Validación automática**
- [ ] `jintia validate guide.json` terminó sin errores (JIN-SCH-*, JIN-CNT-*, JIN-BIB-*, y JIN-ALN-*/JIN-WRK-*/JIN-SELF-*/JIN-ASM-* cuando aplican).
- [ ] `node "<skill-root>/scripts/html-linter.js" guide.html` terminó sin errores cuando la guía contiene figuras.
- [ ] `jintia preflight guide.html` terminó sin errores críticos de paginación.
- [ ] `jintia report guide.json --final` termina en `READY` (equivalente a `compile --publish` sin renderizar).
- [ ] `jintia compile guide.json --publish` no reporta degradación bibliográfica (`JIN-BIB-001..007`) antes de compartir el PDF final.
- [ ] `jintia ready guide.json` termina en `DETERMINISTIC DECISION: READY` (cadena completa: validate --publish → evidencia → bibliografía pre/post-render → render → html-lint → preflight → compile).
- [ ] Se aplicó la prueba "estudiante sin profesor" (`agents/jintia-selfstudy-reviewer.md`) y su decisión es `PASS`.
- [ ] `agents/jintia-finish-reviewer.md` emitió `ready` incorporando el `PASS` anterior.
- [ ] Las reglas editoriales, pedagógicas y de evidencia no cubiertas por los scripts se revisaron manualmente.
