# Changelog — Jintia

Este archivo sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y versionado semántico.

## Sin publicar

## `jintia-skill` 12.4.2 — 2026-08-22

Release documental: cierra una cuarta revisión externa que encontró que el
código avanzó más rápido que la documentación pública — `docs/`, el README
y varias referencias técnicas seguían describiendo la arquitectura anterior
a 12.4 (Node 18/22.12, MCP hardcodeado, LaTeX/Biber/MiKTeX, `--engine
pagedjs`, `/jintia` como comando registrado, catálogo de reglas
desactualizado). No hay cambios de arquitectura pedagógica ni de runtime en
este release; solo un ajuste puntual de código descubierto en el proceso
(`usage()` de `bin/jintia.js` no listaba `guide create`/`guide finalize`).

### Corregido

- **README.md / README.en.md**: Node `>=22.13.0` (no 18/22.12), versión de MCP ya no hardcodeada (referencia a `release/release-config.json`), flujo principal reescrito para reflejar plan/targets/alignmentMatrix/evidence/ready.
- **`docs/cli.md`**: regenerado contra el CLI real — se elimina `--engine pagedjs` (motor inexistente; único motor: Vivliostyle), `preflight` corregido a `guide.html` (no `.pdf`), añadidos `plan`, `evidence`, `guide create/finalize`, `report --final`, `ready`.
- **`docs/getting-started.md`, `docs/create-first-course.md`, `docs/generate-weekly-guide.md`**: reescritos sobre el flujo real (`init` no crea `JINTIA.md`/`reference.bib`/`institution.json`; `doctor` no es un wizard de NotebookLM; NotebookLM es fuente primaria, no "opcional"). `generate-weekly-guide.md` pasa a ser el documento canónico del flujo semanal completo.
- **`docs/notebooklm.md`**: reescrito completo — política de 3 intentos, fallbacks, `notebookResolution`, `JIN-EVD-028`.
- **`docs/rules.md`**: añadidas las familias `JIN-PLN-*`, `JIN-EVD-025..028`, `JIN-SELF-010..015`; corregido el ejemplo `audit guia.tex` (audit valida `README.md`, no guías).
- **`docs/troubleshooting.md`**: reemplazado por completo — ya no menciona Biber/LaTeX/MiKTeX; cubre `JIN-PLN-*`, autenticación de NotebookLM, `JIN-EVD-028`, `academicProvenance`, `JIN-BIB-*`, Vivliostyle ausente, `PRECHECK_READY` vs `READY`, `preflight`, `guide finalize`, `NEEDS_CHANGES`.
- **`skill/references/sistema-html.md`**: reescrito como contrato técnico de 12.4 — el nodo `citation` se marca deprecado a favor de `{{cite:clave}}`, Citation.js deja de describirse como opcional/degradable (es dependencia normal y compuerta de publish).
- **`skill/references/figuras-tikz.md`**: la sección de exportación de figuras ya no enseña un flujo manual WSL + `pdflatex`/`pdftoppm` (con una referencia rota a `compilacion.md`, inexistente); ahora documenta el pipeline automatizado (`jintia visual render`).
- **`skill/references/bibliografia.md`**: título `NotebookLM MCP 2.0` → `NotebookLM MCP`; el "Flujo manual" ahora aclara que solo aplica sin herramientas MCP disponibles (no es un paso previo obligatorio al fallback); añadida la trazabilidad `notebookResolution`/`JIN-EVD-028`.
- **`skill/references/checklist.md`**: añadidas `JIN-EVD-025/026/027`, `JIN-PLN-*`, `JIN-SELF-010..015`; aclarado que `jintia ready` puede terminar en `PRECHECK_READY`, no solo `READY`; marcado el nodo `citation` como deprecado.
- **`skill/SKILL.md`**: ejemplo `plan save` corregido para incluir `--file plan.json`; añadidos `JIN-EVD-025..028` y `JIN-PLN-*` al resumen de reglas.
- **Terminología `/jintia-skill` en todo `skill/commands/*.md`**: los títulos y ejemplos ya no usan `/jintia <comando>` (no es el comando registrado en Claude Code); cada playbook ahora abre con una tabla Claude Code / Codex / CLI.
- **`skill/commands/audit.md`**: los ejemplos usaban `guia.tex`/rutas `latex/` — `audit` valida `README.md`, nunca guías ni `.tex`.
- **`skill/commands/hooks.md`**: los ejemplos pasaban `guia.tex` a los hooks; corregidos a `README.md` (los hooks corren `rules-runner.js`, no validan `guide.json`).
- **`skill/commands/compile.md`**: Node `>=22.13.0`; añadida distinción entre compilación aislada (`compile`) y cierre completo (`ready`).
- **`docs/templates.md`**: `jintia-cuaderno` es A5, no A4 como los otros dos temas.
- **`docs/harnesses.md`**: la versión de MCP en el ejemplo TOML ya no está hardcodeada.
- **`docs/testing.md` / `docs/releasing.md`**: añadido el paso `npm --prefix skill ci` (el bug de CI real corregido en 12.4.0/12.4.1: `skill/` no es workspace de npm).
- **`docs/architecture.md`**: ampliado con `plan-state.js`, `evidence-gate.js`, `rule-catalog.js` y `ready.js`; corregidas las opciones inexistentes (`--engine`) de `vivliostyle-adapter.js`.
- **`bin/jintia.js`**: `usage()` no listaba `guide create`/`guide finalize` (existen y funcionan desde 12.0, pero no aparecían en `jintia` sin argumentos).
- **`skill/themes/jintia-clasico/meta.json`**: `nodeVersion` desactualizado (`>=22.12.0` → `>=22.13.0`; campo no leído por ningún script, solo metadata).

### Añadido

- **`docs/README.md`**: índice de documentación con mapa de "por dónde empezar" y tabla de autoridad (qué archivo es la fuente canónica de cada aspecto).
- **`docs/claude-code.md`**: guía breve de instalación/uso en Claude Code, separada de la aplicación Desktop.
- **`scripts/check-docs.mjs` endurecido**: nuevos patrones obsoletos (Node 18/22.12, `pdflatex`, `latex-linter`, `Biber`, `guia.tex`, `MiKTeX`, `TeX Live`, `--engine pagedjs`); detección estructural de versión de MCP hardcodeada; validación de que todo `JIN-*` mencionado en documentación (para familias que rastrea el catálogo) exista en `rules/catalog.json`; validación de que todo `commands/*.md` referenciado desde `SKILL.md` exista.

### Eliminado

- **`DESIGN.md`**: describía la UI de la aplicación de escritorio (glassmorphic, blobs animados) — no corresponde a este repositorio (skill + motor editorial); Jintia Desktop vive en `jintia-desktop`.
- **`docs/guia-claude-desktop.md`**: describía instalación con LaTeX/TeX Live/Biber/WSL de la aplicación Desktop — reemplazado por `docs/claude-code.md`, centrado solo en la skill.

## `jintia-skill` 12.4.1 — 2026-08-22

Cierre de una tercera revisión externa sobre `master` en 12.4.0 (commit
`8856001`): cierra los últimos bypasses del contrato pedagógico del plan,
completa el grafo target → claim → evidencia, endurece un mínimo de
autoinstruccionalidad en publish, corrige la semántica y el early-stop de
`jintia ready`, y añade trazabilidad opcional de los 3 intentos de
NotebookLM. La revisión estimó el plan original en 94-96% implementado;
este release cierra los puntos concretos restantes.

### Corregido

- **`plan-state.js`: el contrato de targets deja de ser opt-in.** Antes, un plan sin `targets` podía aprobarse igual (el contrato de alineación solo se exigía si el propio plan declaraba `targets`); ahora `plan approve` bloquea salvo que el plan declare `legacy: true` explícitamente (`JIN-PLN-001` targets ausentes, `JIN-PLN-002` matriz incompleta, `JIN-PLN-003` `workloadBudget` ausente o fuera de 70-130%, `JIN-PLN-004` `assessmentContract` no coincide con el sílabo).
- **`jintia ready`: early-stop real.** Un error en `html-lint`, bibliografía post-render o `preflight` ya no dejaba de bloquear pero seguía ejecutando los pasos siguientes (contradecía la propia documentación, "se detiene en el primer paso bloqueante"); ahora retorna inmediatamente tras cada uno de esos tres pasos si hay bloqueo.
- **`jintia ready`: semántica de PDF corregida.** `--skip-pdf` ya no produce `READY` (ahora `PRECHECK_READY`: precondición cumplida, cierre no confirmado). Sin `--skip-pdf`, Vivliostyle CLI ausente ya no se registra como `skipped` sino como `error` → `BLOCKED`: se pidió el cierre completo y no se pudo alcanzar.
- `commands/guide.md`: el paso 6 del flujo de cierre decía `jintia plan approve`; ahora dice `jintia guide finalize` (ya existente en el CLI, llama a `markGenerated`).

### Añadido

- **`JIN-EVD-025/026/027`**: `evidence.json` con ids de claim duplicados (`025`); en publish, todo keyClaim usado debe declarar `targetId` válido (`026`) y todo target de `metadata.targets` debe tener al menos un keyClaim usado que lo sustente (`027`) — cierra el grafo target → claim → evidencia de forma verificable en el propio artefacto, no solo en la matriz del plan.
- **`JIN-SELF-010..015`** (publish): `orientation` debe declarar `purpose`, `materials`, `successCriteria` y `estimatedMinutes`; toda práctica `guided` debe declarar `prompt` y `steps` además de `workedExample`.
- **`evidence-gate.js`: trazabilidad opcional de los 3 intentos de NotebookLM.** `check()` acepta `notebookLM.attempts`/`fallbackReason` y adjunta `notebookResolution` al resultado; `local-fallback` con NotebookLM configurado pero sin los 3 intentos declarados emite `JIN-EVD-028` (advertencia). `plan-state.js` persiste `notebookResolution` si se declara.

### Documentación

- `commands/plan.md`: documenta el contrato obligatorio (`JIN-PLN-00x`), la excepción explícita `legacy: true` y la trazabilidad de intentos de NotebookLM.
- `commands/ready.md`: documenta el early-stop completo y la tabla de decisiones (`READY`/`PRECHECK_READY`/`NEEDS_CHANGES`/`BLOCKED`).
- `schemas/evidence.schema.json`: `targetId` documenta su obligatoriedad en publish; la descripción del artefacto deja de llamarlo "opcional" sin matiz.
- `rules/catalog.json` sube a `2.6.0`.

## `jintia-skill` 12.4.0 — 2026-08-22

Cierra los huecos de una segunda revisión externa sobre `master` en 12.3.0
(commit `08db37a`): integridad de `evidence.json`, contrato pedagógico del
plan previo a la redacción, drift entre playbooks y runtime, y el
orquestador de publicación completo. Consolida en un solo release lo que la
revisión proponía como tres pasos (12.3.1 integridad de evidencia, 12.3.2
plan/documentación, 12.4 `jintia ready`).

### Corregido

- **`evidence.json` ahora se valida contra su JSON Schema real**: `content-linter.js` declaraba `EVIDENCE_SCHEMA_PATH` pero nunca llamaba a `validateSchema()` sobre el documento — un `sourceMode` fuera del enum (`notebook-primary`/`local-fallback`/`ai-fallback`) podía escapar de todos los checks manuales. Nuevo `JIN-EVD-021`.
- **`academicProvenance` se calcula solo sobre keyClaims referenciados desde `guide.json`** (`claimIds`), no sobre todos los claims de `evidence.json`: antes se podía inflar `NotebookLM primary` agregando claims que la guía nunca usa. Los claims no referenciados se marcan huérfanos (`JIN-EVD-023`, warning) y no entran en el cálculo; si ningún claim declarado está referenciado, la procedencia no es calculable y bloquea (`JIN-EVD-024`).

### Añadido

- `evidence.json` en modo publish: `week` pasa a ser obligatorio y debe coincidir con `metadata.week` (`JIN-EVD-019`, extendida); `claims` no puede quedar vacío si la guía tiene contenido disciplinar — theory/concept (`JIN-EVD-022`).
- **Esquema del plan (`schemaVersion` 1.2)**: `plan-state.js` acepta y persiste `targets`, `alignmentMatrix`, `workloadBudget` y `assessmentContract`. Si el plan declara `targets`, `plan approve` bloquea con un mensaje explícito hasta que la matriz cubra las cinco dimensiones (enseñanza, práctica, feedback, evaluación, evidencia) para cada uno — el contrato pedagógico se demuestra antes de redactar, no después. Opt-in: planes sin `targets` no exigen la matriz.
- **Comando `jintia ready`** (`scripts/ready.js`, `commands/ready.md`): el orquestador completo — `validate --publish` → procedencia de evidencia → bibliografía (pre-render) → render → html-lint → bibliografía (post-render) → preflight → compile (PDF, `--skip-pdf` para omitirlo). Se detiene en el primer paso bloqueante en vez de seguir corriendo pasos sobre una guía que ya se sabe inválida. Documenta explícitamente que `DETERMINISTIC DECISION: READY` no sustituye la confirmación de `jintia-selfstudy-reviewer` (`PASS`) ni de `jintia-finish-reviewer` (`ready`) — ningún script puede invocar esos contratos de agente por sí mismo.

### Documentación

- `commands/assessment.md` sincronizado con el schema real (`score`/`checklist` → `points`/`submissionChecklist`, cotejo con el sílabo).
- `commands/guide.md` distingue el mínimo aceptado en draft del contrato recomendado/exigido en publish (targets, horas, práctica/evaluación estructurada, `evidence.json` entre los artefactos).
- `commands/plan.md` documenta el esquema 1.2 del plan y el bloqueo por matriz incompleta.
- `agents/jintia-finish-reviewer.md` deja de mencionar "linting LaTeX" (pipeline HTML/Vivliostyle vigente) e incorpora `report --final`/`ready` y la decisión de `jintia-selfstudy-reviewer` como entrada.
- `SKILL.md` deja de describir `metadata.targets` y `evidence.json` como "opcional" sin matiz: aclara que son opcionales solo en draft y obligatorios en publish.
- `rules/catalog.json` sube a `2.5.0`.

## `jintia-skill` 12.3.0 — 2026-08-22

Cierra los huecos identificados en una revisión externa del repositorio en
`master` tras 12.0-12.2: bypasses reales en `plan-state.js`, ambigüedad en
la política NotebookLM, contratos opt-in que dejaban `metadata.targets`/
`evidence.json` fuera del gate de publicación, y un bug de código real
(`JIN-WRK-003/004/005` nunca registradas en `RULES`, provocando una
excepción no capturada si llegaban a dispararse).

### Corregido

- **Bug real**: `JIN-WRK-003`/`004`/`005` se emitían desde `content-linter.js`
  sin existir en su diccionario `RULES` local — cualquier guía con targets
  declarados y un nodo sin `estimatedMinutes`, o con carga desbalanceada,
  lanzaba una excepción no capturada en vez de reportar la advertencia.
  Ningún test anterior ejercitaba esa ruta.
- `plan-state.js` (`savePlan()`) ya no pone el plan en `blocked` solo por
  falta de fuentes verificadas: `ai-fallback` es una vía válida garantizada
  por `evidence-gate.js`, así que el plan queda en `pending` (aprobable).
  `blocked` queda reservado para contrato curricular irresoluble (semana o
  RA inexistente en el sílabo, sílabo inconsistente), verificado en
  `approvePlan()`.
- Ambigüedad NotebookLM corregida en `SKILL.md`, `commands/plan.md` y
  `agents/jintia-researcher.md`: una respuesta de NotebookLM que no resuelve
  la afirmación (pero que sí funciona técnicamente) ya no se trata como
  "NotebookLM no disponible" — el investigador debe reformular, dividir la
  consulta o pedir contraste dentro del mismo notebook antes de considerar
  el fallback local.

### Añadido

- **`metadata.targets`, `metadata.hours` y `evidence.json` obligatorios en modo publish**: `jintia compile --publish` y `jintia validate`/`content-linter.lintGuide(path, { mode: "publish" })` ahora exigen ambos campos de metadata (`JIN-SCH-002`/`003`) y `evidence.json` cuando hay targets declarados (`JIN-EVD-020`). Siguen siendo opt-in en draft/validate normal — no se penalizan retroactivamente guías que no adoptaron el contrato.
- **Evidencia estructurada real**: un keyClaim `notebook-primary` sin `evidence.sourceId`/`sourceName`/`extractionStatus`, o un `local-fallback` sin identificar la fuente local, ya no puede fabricar un `academicProvenance: STRONG` — `JIN-EVD-017`/`018` fuerzan `BLOCKED`. `JIN-EVD-019` valida que `evidence.json.week` coincida con `metadata.week`.
- **`JIN-ALN-017`**: un `assessment` no puede evaluar un target antes de que termine su enseñanza o práctica inicial (orden real de `sections`, no solo presencia — `JIN-ALN-014` ya cubría esto último). La práctica `retrieval`/`transfer` queda excluida a propósito: es válido colocarla después de la evaluación.
- **`JIN-SELF-001`/`005` con semántica real**: `JIN-SELF-001` ahora exige `orientation.route` no vacío (antes era un proxy de `estimatedMinutes`, ya cubierto por `JIN-WRK-*`). `JIN-SELF-005` exige remediación por cada práctica `guided`/`independent`, no que exista en alguna práctica cualquiera de la guía.
- **Cotejo de `assessment` contra el sílabo**: `syllabus-manager.js` añade `parseGradedActivities()` (soporta el formato `- CÓDIGO — Nombre — N puntos` y el formato `[CÓDIGO] Nombre (N%)`). `JIN-ASM-013` pasa de "suma > 100" (warning) a "código/puntaje difiere del sílabo" (error); `JIN-ASM-016` (warning, nuevo) cubre la suma incoherente. Solo se activa cuando la estructura `courseRoot/semanas/semana-XX/guide.json` y el formato del sílabo son detectables — nunca fuerza falsos positivos.
- **`rules/catalog.json` como fuente única real**: nuevo `runtime/core/rule-catalog.js`; `content-linter.js` consulta severity/category desde ahí (con el `RULES` local solo como fallback defensivo). Nuevo test de regresión: todo código que emite `content-linter.js`/`evidence-gate.js` existe en `catalog.json` con la misma severidad. Sube a `2.4.0` (incluye `JIN-SCH-001`, que nunca se había registrado).
- **`jintia-selfstudy-reviewer` integrado al pipeline** (`agent-plan.js`): ahora participa en `guide` y `audit`, no solo existe como contrato suelto.
- **Contrato de `jintia-instructional-reviewer.md` reescrito**: salida `targetCoverage`/`assessmentAlignment`/`workload`/`selfInstruction`, alineada con lo que `content-linter.js`/`quality-report.js` ya calculan — el reviewer añade juicio pedagógico, no reimplementa las reglas.
- **`jintia report --final`**: modo estricto que corre `content-linter` en `mode: "publish"` más `bibliography-manager.assertPublishReady()` (el mismo gate que `compile --publish`, sin renderizar). Documenta explícitamente que no sustituye la revisión de agentes (`jintia-selfstudy-reviewer`, `jintia-finish-reviewer`).
- **Behaviors semánticos**: `BHV-SEM-001` reescrito (`stops-when-no-evidence` → `notebook-first-fallback`, ya no contradice la política de `ai-fallback`). Siete specs nuevos: `BHV-SEM-006` (tres intentos NotebookLM estructurados), `007` (no confundir insuficiente con no disponible), `008` (ai-fallback siempre declarado, nunca con bibliografía fabricada), `009` (orden enseñanza→práctica→evaluación), `010` (práctica guiada con andamiaje real), `011` (carga horaria plausible, no solo ajustada), `012` (APA íntegro antes de publicar).

### Documentación

- Corregidas menciones obsoletas de `score`/`checklist` en `SKILL.md` (ya renombrados a `points`/`submissionChecklist` desde 12.2.0).
- La versión del MCP de NotebookLM deja de repetirse hardcodeada en `references/bibliografia.md`, `references/configuracion.md`, `docs/guia-claude-desktop.md` y `docs/harnesses.md`: todas remiten a `release/release-config.json` como fuente canónica (y se actualizó el número mostrado de `2.3.3` a `2.3.10`, la versión realmente fijada).
- `checklist.md` y `docs/rules.md` documentan todas las reglas nuevas y el endurecimiento en modo publish.

## `jintia-skill` 12.2.0 — 2026-08-21

### Cambiado (reconciliación con la especificación canónica del plan)

- **`sourceMode` renombrado**: `notebooklm`/`local`/`ai-knowledge` → `notebook-primary`/`local-fallback`/`ai-fallback` en `evidence-gate.js`, `evidence.schema.json`, `content-linter.js` y toda la documentación. `evidence-gate.check()` ahora devuelve estos valores en `provenance`.
- **`assessment` renombrado**: `score` → `points`, `checklist` → `submissionChecklist`; nuevo campo `instructions`.
- **`JIN-BIB-*` renumerado** para que `001` sea siempre "Citation.js no disponible" (antes era `citationStyle`): `001` Citation.js, `002` `.bib` ausente, `003` clave inexistente, `004` BibTeX no parseable, `005` clave cruda en el HTML final (nuevo, post-render), `006` bibliografía degradada en el HTML final (nuevo, post-render), `007` `citationStyle` ≠ apa (antes `001`). `jintia compile --publish` ahora también escanea el HTML ya renderizado (`assertRenderedPublishReady()`) como defensa en profundidad, buscando el marcador `jintia-degraded` y `{{cite:` sin resolver.
- **Severidad bajada a warning** en `JIN-SELF-006` (sin práctica de recuperación), `JIN-SELF-008` (sin monitorización) y `JIN-SELF-009` (sin transferencia) — antes bloqueaban; las advertencias siguen visibles pero ya no impiden `jintia validate`.

### Añadido

- `evidence.json`: cálculo de `provenanceSummary` (porcentaje por `sourceMode`) y clasificación `academicProvenance` (`STRONG`/`GOOD`/`DEGRADED`/`WEAK`/`BLOCKED`) sobre los keyClaims declarados. Nuevas reglas `JIN-EVD-010` (keyClaim sin sourceMode), `011` (extracción parcial), `012` (bibliographyKey atribuida que no existe en reference.bib), `013` (uso de ai-fallback), `014` (ai-fallback con bibliografía fabricada, sustituye a la antigua `007`), `015` (provenance DEGRADED) y `016` (provenance BLOCKED).
- `JIN-ALN-016` (warning): contenido extenso de teoría/concepto sin `targetIds` declarado.
- `JIN-WRK-003` (warning): bloque académico relevante sin `estimatedMinutes`. `JIN-WRK-004`/`005` (warning): carga concentrada en enseñanza o tiempo evaluativo desproporcionado frente a la práctica formativa.
- `JIN-ASM-014`/`015` (warning): actividad calificable/extensa sin `submissionChecklist`, o extensa sin ponderación por criterio (rúbrica).
- Nodo `orientation` estructurado: `purpose`, `priorKnowledge`, `materials`, `route`, `successCriteria`, `estimatedMinutes`, renderizados como "Antes de empezar" y "Ruta de esta semana".
- Semántica HTML: `theory`, `concept` y `practice` pasan de `<aside role="note">` a `<section>` (el CSS y `html-linter.js` son puramente por clase, sin cambio visual). Nuevos indicadores "Tiempo estimado" y badge "Checkpoint" (assessment con más de un target); "Criterios" pasa a "Rúbrica" cuando declara ponderación por criterio.
- Nuevo comando `jintia report <guide.json>` (`scripts/quality-report.js`, `commands/report.md`): el "JINTIA QUALITY REPORT" que agrega alineación, autoinstruccionalidad, carga académica, procedencia de evidencia y bibliografía en una sola decisión `READY`/`NEEDS_CHANGES`/`BLOCKED`, reutilizando `content-linter.js` como única fuente de verdad.
- `rules/catalog.json` sube a `2.3.0`.

### Notas

Este release reconcilia nombres y numeración introducidos en 12.0.0/12.1.0
con la especificación "Plan final de mejora de Jintia" que el usuario marcó
como definitiva. No hay usuarios externos del esquema previo, por lo que el
renombrado se hizo directamente en vez de mantener alias de compatibilidad.

## `jintia-skill` 12.1.0 — 2026-08-21

### Añadido

- **Targets del RA y matriz de alineación**: `metadata.targets` descompone el resultado de aprendizaje en desempeños observables (`{ id, verb, description }`); cada nodo de `sections` declara qué targets enseña/practica/evalúa vía `targetIds`. Opt-in: al declararlo, `jintia validate` exige por target enseñanza, práctica con feedback/autocorrección y evaluación (`JIN-ALN-010`…`JIN-ALN-014`, error) y advierte si la enseñanza no cita ninguna fuente (`JIN-ALN-015`, warning). Guías sin `metadata.targets` no se ven afectadas.
- **Carga horaria real**: `estimatedMinutes` en cada nodo, comparado contra `metadata.hours` (`JIN-WRK-001` advertencia 70-89%/111-130%, `JIN-WRK-002` error fuera de ese rango).
- **Nodo `practice` estructurado**: `mode` (`guided`/`retrieval`/`independent`/`transfer`, con etiqueta editorial propia), `workedExample`, `prompt`, `steps`, `hints`, `successCriteria`, `selfCheck`, `feedback`, `remediation`, `transfer`. Contrato de autoinstruccionalidad `JIN-SELF-001`…`JIN-SELF-009`: exige, entre otras cosas, ejemplo trabajado en práctica guiada, criterios de éxito, autocorrección, remediación, una práctica de recuperación y una de transferencia, y una comprobación final que cubra todos los targets. `guide-renderer.js` renderiza estos campos como bloques semánticos (Ejemplo trabajado / Ahora inténtalo tú / Pasos / Pistas / Criterios de éxito / Comprueba tu respuesta / Retroalimentación / ¿No coincidió? / Transferencia) reutilizando las clases existentes, sin rediseño visual.
- **Nodo `assessment` estructurado**: `code`, `product`, `criteria` (`{ description, weight }`), `score`, `checklist`. `JIN-ASM-010`/`011`/`012` exigen criterios, producto observable y `targetIds` válidos; `JIN-ASM-013` advierte si la suma de `score` entre actividades supera 100.
- **`evidence.json`** (opcional, `schemas/evidence.schema.json`): registro de procedencia por afirmación (`sourceMode`: `notebooklm`/`local`/`ai-knowledge`, `bibliographyKey`, `evidence`, `status`). `guide.json` referencia cada afirmación vía `claimIds`. `jintia validate` comprueba que todo `claimId` referenciado exista en `evidence.json` (`JIN-EVD-005`) y — la implementación automática de "nunca fabricar bibliografía en modo ai-knowledge" — que ninguna afirmación `ai-knowledge` declare `bibliographyKey` (`JIN-EVD-007`); `notebooklm`/`local` sin `bibliographyKey` advierte (`JIN-EVD-006`).
- Nuevo agente `agents/jintia-selfstudy-reviewer.md`: ejecuta la prueba "estudiante sin profesor" (¿puede un estudiante sin docente alcanzar el RA, comprobarlo y recuperarse?) y emite `PASS`/`NEEDS_CHANGES`/`BLOCKED` por target.
- Golden test de regresión (`tests/golden.test.js` + `tests/fixtures/golden-flawed-guide.json`): fija en un test automático el caso que motivó este release — una guía visualmente completa (con horas y bibliografía declaradas) que sin embargo evalúa un target no enseñado, tiene una práctica sin modelo ni autocorrección y una carga horaria real muy por debajo de la declarada.
- `rules/catalog.json` sube a `2.2.0` con las familias `JIN-ALN-01x`, `JIN-WRK-*`, `JIN-SELF-*`, `JIN-ASM-01x` y `JIN-EVD-005`…`007`. Aclarada la nota de `JIN-ACC-002` (cubierta en la práctica por `JIN-CNT-002`, ya que `rules-runner.js` solo procesa `README.md`).
- `skill/package-lock.json` regenerado tras mover Citation.js a `dependencies` en 12.0.0.

## `jintia-skill` 12.0.0 — 2026-08-21

### Añadido

- **Política de fuentes unificada** (Release 12.0, primer hito del plan de mejora): una sola jerarquía documentada en `SKILL.md` §2 — NotebookLM (3 intentos estructurados: consulta normal → recrear sesión → `re_auth` solo ante fallo de login confirmado) → fuentes locales → conocimiento del modelo (`ai-knowledge`). Antes convivían tres órdenes contradictorios entre `SKILL.md`, `references/bibliografia.md` y `agents/jintia-researcher.md`; ahora `bibliografia.md` y el researcher remiten a `SKILL.md` como fuente única.
- `evidence-gate.js` ya no bloquea la generación por falta total de evidencia: cuando NotebookLM y las fuentes locales no resuelven una afirmación, continúa con procedencia `ai-knowledge` declarada explícitamente (advertencia `JIN-EVD-001`/`JIN-EVD-003`, en vez de bloqueo). Sigue bloqueando (`JIN-EVD-002`) cuando se presenta conocimiento genérico como evidencia verificada sin declarar esa procedencia. Nunca se fabrica bibliografía en modo `ai-knowledge`.
- Consulta a NotebookLM con `source_format: "json"` en vez de `"footnotes"`, aprovechando que el MCP ya devuelve `source_id`, tipo, ubicación, extracto y `extraction_status` de forma estructurada.
- **Bibliografía sin degradación**: Citation.js (`@citation-js/core`, `@citation-js/plugin-bibtex`, `@citation-js/plugin-csl`) pasa de `optionalDependencies` a `dependencies` en `skill/package.json`. Nuevo flag `jintia compile --publish`, que corre `bibliography-manager.assertPublishReady()` antes de generar el PDF y bloquea (`JIN-BIB-001`…`JIN-BIB-005`) ante `citationStyle` distinto de `"apa"`, Citation.js ausente, `.bib` faltante, `.bib` sin parsear o claves sin resolver. El modo draft (por defecto, sin `--publish`) sigue tolerando estas condiciones con marcadores explícitos.
- **APA obligatorio**: `metadata.citationStyle` debe ser `"apa"`; cualquier otro valor dispara `JIN-BIB-001` tanto en `jintia validate` (content-linter) como en `jintia compile --publish`.
- `rules/catalog.json` sube a `2.1.0`: se añaden `JIN-CNT-011`/`012`/`013` (ya implementadas en `content-linter.js` pero ausentes del catálogo — corrige el desfase entre catálogo y linter) y las familias `JIN-EVD-*` y `JIN-BIB-*`, antes inexistentes o solo documentadas en código.

## `jintia-skill` 11.8.0 — 2026-08-21

### Añadido

- Colofón final en toda guía generada (independiente del tema activo): logotipo oficial de Jintia incrustado como SVG inline, frase breve de identidad y curso/código/fecha de generación. Nuevo `skill/assets/brand/jintia-logo.svg` (empaquetado en el release y en el paquete npm).
- La portada (`renderCover`) ya no muestra "jintia" como texto: usa el logotipo vectorial real (isotipo + wordmark + eslogan) incrustado inline, con fallback a texto si el asset no está disponible.

## `jintia-skill` 11.7.1 — 2026-08-20

### Corregido

- `vivliostyle-adapter.js` (`buildPdf()`): si `spawnSync` mata el proceso de Vivliostyle por haber agotado el timeout, ahora se revisa si el PDF de salida ya había quedado escrito en disco antes de reportar fallo — igual que ya se hacía para un código de salida distinto de cero. Sin esto, el primer render tras una instalación en frío (runtimes recién descargados, antivirus escaneando binarios nuevos) podía superar el timeout de 60s y reportarse como fallo aunque el PDF se hubiera generado correctamente, bloqueando la prueba final del onboarding de Jintia Desktop.

## `jintia-skill` 11.7.0 — 2026-08-20

### Añadido

- Rediseño editorial del tema `jintia-clasico` ("más editorial, menos tarjeta"): portada con masthead, número de semana como elemento tipográfico, resultado de aprendizaje en dos columnas y footer docente/período/formato; bloques pedagógicos diferenciados por composición (regla, gutter, numeración) en vez de fondos de color por tipo; encabezado corrido de dos columnas y pie curso/código/página en `print.css`.
- `renderCover()` expone de forma retrocompatible los campos `unit`, `hours` y `code` de `guide.json` en la portada; ninguno es obligatorio.

### Corregido

- Corregida la regla de fragmentación `[data-pagination="splittable"]` en `print.css`, que la regla global `.jintia-block { break-inside: avoid }` neutralizaba antes de tiempo.
- `jintia-tecnico`: aislado `--jintia-paper` de `--jintia-surface-raised` para que el tinte azul de sus tarjetas no se filtre a portada y contenido.
- `jintia-cuaderno`: el encabezado corrido A5 propio ya no se duplica con las nuevas cajas de esquina de `jintia-clasico`.

## `jintia-skill` 11.6.19 — 2026-08-20

### Corregido

- `checkVivliostyleVersion()` (usado por `jintia doctor`) delega en el detector real de `scripts/vivliostyle-adapter.js` en vez de su propia copia rota: hacía `spawnSync("vivliostyle", ..., { shell: false })` por nombre, que en Windows nunca resuelve el wrapper `.cmd` de npm sin una búsqueda previa (`where.exe`). `doctor` reportaba Vivliostyle como "no encontrado" con el paquete instalado localmente.

## `jintia-skill` 11.6.18 — 2026-08-13

### Corregido

- `editorial-svg` separa nuevamente el spacing vertical del horizontal y deriva anchors, colisiones y nodos de una única geometría.
- Los contratos de routing prueban slots convergentes, detours exactos, ausencia total de canal, labels con longitud mínima real y determinismo byte a byte.

## `jintia-skill` 11.6.17 — 2026-08-13

### Corregido

- Cerrado el contrato geométrico de `editorial-svg`: las capas mantienen separación mínima, los anchors usan slots reales, los detours respetan su eje y las etiquetas rechazan segmentos insuficientes con contexto de arista.

## `jintia-skill` 11.6.16 — 2026-08-12

### Corregido

- Corregido el eje de los canales de desvío de `editorial-svg` para routing vertical y horizontal.
- El routing verifica geométricamente colisiones, anchors, elbows y separación de etiquetas antes de aceptar una ruta.

## `jintia-skill` 11.6.15 — 2026-08-12

### Corregido

- El motor `editorial-svg` completa el enrutado ortogonal para `TB`, `BT`, `LR` y `RL`, evita nodos no relacionados y usa canales alternativos deterministas.
- Las etiquetas de relaciones mantienen una separación geométrica verificable respecto de sus conectores.

## `jintia-skill` 11.6.14 — 2026-08-12

### Añadido

- Integrado `editorial-svg` como motor interno para diagramas conceptuales y editoriales genéricos, adaptando la gramática visual de Diagram Design.

### Corregido

- El motor editorial carga los tokens reales del tema Jintia activo con precedencia de `spec.palette`.
- Los conectores múltiples usan anclajes y rutas ortogonales diferenciados y mantienen separación entre etiquetas y líneas.

## `jintia-skill` 11.6.13 — 2026-08-11

### Corregido

- Corregido el layout canónico, la detección de instalaciones Jintia y el rollback atómico del plugin OpenAI.
- Ampliada la cobertura del contrato de instalación y marketplace.

## `jintia-skill` 11.6.12 — 2026-08-11

### Añadido

- Jintia gestiona de forma local e idempotente la instalación del plugin OpenAI con `jintia plugin status --json` y `jintia plugin install --yes --json`.

## `jintia-skill` 11.6.11 — 2026-08-11

### Añadido

- Jintia puede adoptar explícitamente instalaciones canónicas previas con `--adopt-existing`.
- La adopción conserva la configuración mutable del usuario.
- Las rutas no identificables como Jintia continúan protegidas.

## `jintia-skill` 11.6.10 — 2026-08-10

### Actualizado

- Jintia distribuye Gemini Notebook MCP 2.3.10 con un shrinkwrap de producción compatible con instalaciones administradas reproducibles en Windows, macOS y Linux.
- Se publica la integrity SHA-512 exacta del nuevo artefacto npm y se sincroniza el descriptor OpenAI MCP.

## `jintia-skill` 11.6.9 — 2026-08-10

### Actualizado

- Jintia actualiza su contrato técnico canónico de Gemini Notebook MCP de 2.3.5 a 2.3.9.
- Se publica la nueva integridad SHA-512 validada.
- El descriptor OpenAI MCP queda sincronizado con el mismo package spec.

## `jintia-skill` 11.6.8 — 2026-08-09

### Añadido

- El paquete npm publica `release/release-config.json` como contrato técnico canónico de la distribución de Jintia.

## `jintia-skill` 11.6.7 — 2026-08-09

### Actualizado

- La distribución de Jintia fija Gemini Notebook MCP 2.3.5 y su integrity SHA-512 del registry.

## `jintia-skill` 11.6.6 — 2026-08-09

### Actualizado

- El repositorio canónico de Jintia adopta el slug `jintia`; los manifests, metadatos de distribución y enlaces públicos usan ahora `CharlieCardenasToledo/jintia`.

## `jintia-skill` 11.6.5 — 2026-08-09

### Actualizado

- El contrato de NotebookLM MCP fija `@charlie.act7/gemini-notebook-mcp@2.3.4`, que administra el Chromium hermético de Patchright mediante su CLI pública `browser install/status`.

## `jintia-skill` 11.6.4 — 2026-08-08

### Añadido

- El paquete npm distribuye el wrapper universal de OpenAI (`.codex-plugin/plugin.json`, `.mcp.json` y README) junto al core canónico de Jintia, sin duplicar la Skill dentro del wrapper.

## `jintia-skill` 11.6.3 — 2026-08-08

### Añadido

- Publicación automática en npm al crear un tag `v*` vía GitHub Actions con Trusted Publishing (OIDC).

## `jintia-skill` 11.6.2 — 2026-08-08

### Corregido

- Unificada la fuente de verdad de los perfiles `minimum`, `core` y `full` en `visual-install-profiles.json` v3.
- `jintia capabilities profiles` ahora deriva sus requisitos Python, Node y binarios desde el contrato canónico.
- Mermaid queda fijado en `11.12.x`; Graphviz en `12.2.x` y PlantUML en `1.2025.x`.
- Eliminadas del perfil `full` las capacidades D2 y Vega-Lite que no estaban declaradas por el contrato semántico.

## `jintia-skill` 11.6.1 — 2026-08-07

### Corregido

- Versión npm 11.6.0 publicada sin los cambios de `self-test` y contrato expandido; 11.6.1 los incluye correctamente.

## `jintia-skill` 11.6.0 — 2026-08-07

### Añadido

- `jintia self-test --json` — comando de autocomprobación completo: valida fixture mínimo, renderiza HTML y compila PDF vía Vivliostyle; devuelve `{ ok, skillVersion, checks: { validate, render, vivliostyle, pdf } }`.
- `contract.commands.selfTest: true` — declarado en el contrato público.
- `capabilities profiles` — contrato expandido: cada perfil ahora expone `python.packages`, `node.packages` y `binaries` en lugar de la lista plana `packages`. Perfil `core` incluye `networkx` y `matplotlib`; `node` incluye `@mermaid-js/mermaid-cli`.

## `jintia-skill` 11.5.1 — 2026-08-07

### Añadido

- `jintia capabilities profiles --json` — nuevo endpoint que expone el mapa disciplina → perfil visual.
- `visual-install-profiles.json` v2 — LaTeX removido de todos los perfiles; Vivliostyle como base requerida.

## `jintia-skill` 11.5.0 — 2026-08-07

### Añadido

- `jintia contract` — endpoint para consultar contratos pedagógicos y requerimientos de cursos.
- `jintia status` — endpoint para verificar estado de procesos y recursos disponibles.

## `jintia-skill` 11.4.0 — 2026-08-06

### Añadido

- `legacy-linter.js` — modo `--course <ruta>`: escanea directorio de curso para detectar `latex/` (LGC-C01), `.tex` (LGC-C02), `\documentclass` (LGC-C03), `\begin{document}` (LGC-C04); exit code ≠ 0 cuando se encuentran.
- `migrate-runner.js` — flag `--quarantine`: mueve artefactos LaTeX al backup en lugar de solo copiarlos (elimina originals tras backup).
- `migrate-runner.js` — flags `--keep-first` / `--keep-last` para resolver semanas duplicadas explícitamente; sin ellos los duplicados quedan en `requiresReview` en lugar de auto-resolverse.
- `pdf-preflight.js` — env var `JINTIA_REQUIRE_PLAYWRIGHT=1`: falla con JIN-PLW-001 si Playwright no está instalado (sin fallback silencioso a modo estático).

### Corregido

- `jintia syllabus import` — era un stub silencioso; ahora devuelve error JIN-NYI-001 con exit code 1 y mensaje claro.
- `jintia legacy:check` — añadido `legacy-linter.js` al allowlist de `--json` forwarding en `runScript`.

## `jintia-skill` 11.3.0 — 2026-08-06

### Añadido

**Compuertas de seguridad (P0)**
- `runtime/core/evidence-gate.js` — bloquea generación de guías sin evidencia verificable; códigos JIN-EVD-001 (sin fuentes), JIN-EVD-002 (conocimiento genérico), JIN-EVD-003 (NLM caído sin respaldo local).
- `runtime/core/plan-state.js` — persistencia de planes semanales en `.jintia-plan.json`; máquina de estados `pending → blocked → approved → generated`.
- `runtime/core/syllabus-manager.js` — editor atómico del README.md: parseo, deduplicación de semanas, validación, backup automático con timestamp.
- `runtime/core/citations.js` — módulo unificado: `validateCitationKeys`, `renderInlineText`, `validateFigureAccessibility`; re-exporta utilidades de `citation-keys.js`.
- CLI `jintia plan save|approve|check|status`, `jintia syllabus check|import`, `jintia evidence check`.
- Playbooks expandidos: `commands/init.md`, `commands/syllabus.md`, `commands/plan.md`, `commands/guide.md` con precondiciones, listas NOT y flujo de recuperación NLM.
- `tests/regression.test.js` — 18 tests (R01–R07) para los 7 escenarios de fallo detectados el 2026-08-06.

**Pipeline y calidad (P1)**
- `scripts/legacy-linter.js` reglas LGC-010..015 — detección de LaTeX activo en rutas de curso; rutas de referencia exentas.
- `schemas/guide.schema.json` — nodo `citation` marcado como DEPRECADO; usar `{{cite:clave}}` inline.
- `content-linter.js` — JIN-CNT-011 (bibliography debe ser el último nodo), JIN-CNT-012 (citation deprecado), JIN-CNT-013 (figure sin src/visualSpec).
- `.github/workflows/ci.yml` — matriz Ubuntu / Windows / macOS con Node 22.13.0; job `e2e-pdf` (Ubuntu, push a master).
- `tests/windows-paths.test.js` — 8 tests con rutas con espacios, `&`, `()`, guion largo, tildes y Unicode.

**Operacional (P2)**
- `scripts/transcript-export.js` + `commands/transcript.md` — exporta traza editorial (planes, guías, sílabo) en modos `editorial`, `technical`, `summary`; error JIN-TRN-001 para `verbatim` (responsabilidad del harness).
- `scripts/migrate-runner.js` — escanea curso: detecta `latex/`, `.tex` y semanas duplicadas; crea `.jintia-backup/YYYYMMDD-HHMMSS/`; deduplica semanas automáticamente; informe estructurado `{ backedUp, fixed, requiresReview }`.
- `jintia update --verify-contract` — ejecuta `legacy:check` antes y `doctor + legacy:check` después de cada actualización.
- `jintia transcript export <curso>` disponible en CLI.

### Cambiado
- `runtime/core/index.js` exporta los cuatro módulos nuevos (`evidenceGate`, `planState`, `syllabusManager`, `citations`).
- `SKILL.md` sección 4 documenta `plan save`/`plan check` y los estados del plan.
- `references/bibliografia.md` reemplaza ejemplo `citation` por sintaxis inline canónica.
- `jintia migrate <curso>` enruta a `migrate-runner.js` (antes `legacy-manager.js`).

## `jintia-skill` 11.2.0 — 2026-08-06

### Añadido
- `citation-keys.js` — `collectCitationKeys(guide)` recorre recursivamente `content`, `assessment.items` y nodos `citation` para extraer todas las claves citadas; compartido entre renderer, linter y behavior-runner.
- `visual-linter.js` reescrito para `guide.json`: valida nodos `figure` contra `manifest.json`, exige `src`/`visualSpec`, `alt`, `caption`, `inspection.valid`, y detecta figuras huérfanas.
- `visual-renderer.js` y `visual-pipeline.js` emiten campo `node` — objeto listo para insertar en `guide.json sections[]`.
- `@citation-js/core`, `@citation-js/plugin-bibtex`, `@citation-js/plugin-csl` declarados como `optionalDependencies`.
- Fixture `reference.bib` y citas inline reales en `guide-sample.json` para cobertura de BHV-D-007.

### Cambiado
- `guide.schema.json`: nodos `figure` requieren `src` o `visualSpec` (`anyOf`).
- `content-linter.js`: JIN-CNT-009 y JIN-CNT-004 detectan citas inline `{{cite:}}` además de nodos `citation`.
- `behavior-runner.js`: BHV-D-006/007 usan `collectCitationKeys()`; BHV-D-007 exige citas reales, no solo `metadata.bibliography`.
- `bibliography-manager.js`: escapa HTML en `author`, `year` y `data-keys` (prevención XSS).
- `vivliostyle-adapter.js`: usa `where.exe`/`which` para ruta absoluta; lanza `.cmd` en Windows vía `cmd.exe /C` sin `shell: true`.
- `SKILL.md`: unifica sintaxis de citas a `{{cite:clave}}`/`{{cite:clave|narrative}}`; depreca `[@clave-bib]`.

## `jintia-skill` 11.1.0 — 2026-08-06 (RC2)

### Añadido (RC2)
- `citation-keys.js` — función compartida `collectCitationKeys(guide)` que recorre recursivamente `content`, `assessment.items` y nodos `citation` para extraer todas las claves citadas.
- `visual-linter.js` reescrito para `guide.json`: valida nodos `figure` contra `figure/manifest.json`, exige `src`/`visualSpec`, `alt`, `caption`, y detección de figuras huérfanas en el manifiesto.
- `visual-renderer.js` y `visual-pipeline.js` emiten campo `node` — objeto listo para insertar en `guide.json sections[]`.
- Citation.js (`@citation-js/core`, `@citation-js/plugin-bibtex`, `@citation-js/plugin-csl`) declarado como `optionalDependencies` e instalado.
- `reference.bib` de fixture para pruebas reales de citas.
- Citas inline en `guide-sample.json` para cubrir BHV-D-007 con evidencia real.

### Cambiado (RC2)
- `guide.schema.json`: nodos `figure` ahora requieren `src` o `visualSpec` (antes solo `alt` y `caption`).
- `guide-renderer.js`: usa `collectCitationKeys()` compartido en lugar de recolección manual ad-hoc.
- `content-linter.js`: JIN-CNT-009 y JIN-CNT-004 ahora detectan citas inline `{{cite:}}` además de nodos `citation`; usa `collectCitationKeys()`.
- `behavior-runner.js`: BHV-D-006 y BHV-D-007 usan `collectCitationKeys()` — exigen citas reales, no solo `metadata.bibliography`.
- `bibliography-manager.js`: escapa HTML en author, year y `data-keys` de citas construidas manualmente (modo narrativo y degradado).
- `vivliostyle-adapter.js`: usa `where.exe`/`which` para resolver la ruta absoluta del ejecutable; en Windows lanza `.cmd` vía `cmd.exe /C` en lugar de `shell: true`.
- `SKILL.md`: unifica sintaxis de citas a `{{cite:clave}}` / `{{cite:clave|narrative}}`; depreca `[@clave-bib]` y el nodo `citation` independiente.

### Añadido
- `doc-ref-checker.js` — detecta rutas internas rotas en Markdown de la skill.
- `legacy-linter.js` — detecta términos LaTeX/v10 prohibidos (LGC-001…LGC-009).
- `behavior-runner.js` y `behavior-eval.js` — verificación determinística y semántica del agente.
- Contratos semánticos `behaviors/semantic/` (BHV-SEM-001…005).
- `compile-stub.test.js` — prueba E2E del pipeline compile con ejecutable falso de Vivliostyle.
- `copyThemeAssets()` en `guide-renderer.js` — copia el CSS del tema a `.jintia-assets/` junto al HTML.
- Sintaxis `{{keyterm:...}}` en campos `content` — el renderer la convierte en `<span class="jintia-keyterm">` de forma segura.

### Cambiado
- `guide-renderer.js` integra `bibliography-manager.js`: los nodos `citation` y `bibliography` usan Citation.js (o modo degradado) en lugar de marcadores planos.
- `vivliostyle-adapter.js` usa `shell: true` en Windows para encontrar `.cmd` en PATH.
- `behavior-runner.js` BHV-D-005: verifica verbo en infinitivo español (-ar/-er/-ir) en `outcome`.
- `content-linter.js`: falla explícitamente si `guide.schema.json` está ausente o corrupto.
- `skill/package.json`: `compile`, `preview` y `preflight` ahora enrutan por `bin/jintia.js`.
- `SKILL.md`: documenta sintaxis `{{keyterm:...}}` en lugar del span HTML manual.
- `openai-plugin/.codex-plugin/plugin.json`: eliminadas referencias a LaTeX; licencia corregida a MIT.

### Corregido
- `bin/jintia.js` usage: elimina `--engine vivliostyle|pagedjs` (pagedjs no implementado).
- `legacy-linter.js` extiende su escaneo a `openai-plugin/` para detectar manifiestos con términos LaTeX.

## `jintia-skill` 11.0.0 — 2026-08-04

### Cambiado

- Motor de composición migrado de LaTeX a HTML puro con Vivliostyle.
- Nuevas plantillas HTML: Técnico y Cuaderno.
- Eliminadas las plantillas ElegantoBook y Kaohandt (LaTeX).
- Agregado migrador de contenido legado (`guide-migrator.js`).
- Validación de esquemas y preflight PDF integrados en el pipeline editorial.

## 10.10.1 — 2026-08-02

### Corregido

- Cambiado el paquete npm al scope oficial `@charlie.act7/jintia`, evitando las
  restricciones de similitud de nombres de npm para paquetes sin scope.
- Actualizados los comandos públicos a `npx @charlie.act7/jintia`.
- Preparada `jintia-skill` 10.10.1 con el contrato de publicación corregido.

## 10.10.0 — 2026-08-02

### Añadido

- Preparado el paquete público `@charlie.act7/jintia` para instalar
  `jintia-skill` 10.10.0 mediante `npx @charlie.act7/jintia install` en Claude
  Code, Codex y otros harnesses
  compatibles.
- Añadidos comandos directos `install`, `update`, `status`, `repair` y
  `uninstall`, con selección interactiva y opciones reproducibles para CI.
- Añadidas validación del contenido npm, prueba de instalación y publicación
  mediante trusted publishing de npm con OIDC.

### Corregido

- Corregidos los enlaces de privacidad y términos del plugin para usar la rama
  canónica `master`.

## 10.9.2 — 2026-08-01

### Cambiado

- Separada definitivamente Jintia Desktop en su propio repositorio con historial
  preservado y contrato de releases bloqueado por SHA-256.
- Eliminadas las dependencias de validación y documentación de la skill hacia el
  árbol fuente de la aplicación.
- Preparada `jintia-skill` 10.9.2 como primera release del repositorio dedicado.

## 10.9.1 — 2026-08-01

### Añadido

- Separada la distribución de la skill mediante ZIPs reproducibles, manifiesto
  versionado, SHA-256 y attestations de procedencia para que Jintia Desktop la
  consuma sin importar archivos fuente entre repositorios.
- Actualizada la integración oficial con
  `@charlie.act7/gemini-notebook-mcp@2.3.3` y Node.js `>=22.13.0`.
- Preparada `jintia-skill` 10.9.1 con un pipeline visual único que renderiza,
  inspecciona, valida, actualiza el manifiesto y entrega el bloque LaTeX.
- Implementados fallbacks ejecutables para Matplotlib, GeoPandas y TikZ, más
  generadores PlantUML, Circuitikz, Chemfig y Forest desde modelos neutrales.
- Ampliados los gráficos Vega-Lite, las métricas de complejidad, la captura
  selectiva de HTML y la conversión segura de SVG a PDF.
- Endurecidos accesibilidad, procedencia, tablas equivalentes, contraste por
  series, plantillas y pruebas recursivas multiplataforma.
- Extendida la matriz real de motores para comprobar Graphviz, Mermaid,
  PlantUML, D2, Vega-Lite, LaTeX, Python, Chrome y WaveDrom.

## 10.7.0 — 2026-07-28

### Añadido

- Incorporado un sistema visual neutral con especificaciones JSON, manifiesto,
  selector pedagógico, fallbacks registrados y adaptadores para motores
  generales y disciplinares.
- Añadidos renderizado, inspección, accesibilidad, previsualizaciones,
  regresión exacta y perceptual, imágenes diff y tablas CSV equivalentes.
- Añadidos generadores para redes, flujos, gráficos, mapas GeoJSON, forest
  plots, cronologías, señales digitales, estructuras RDKit y figuras
  progresivas.
- Añadidos perfiles visuales `Mínimo`, `Visual general` y `Completo` en Jintia
  Desktop, con versiones objetivo y capacidades deshabilitadas visibles.
- Incorporada la plantilla `Kaohandt Marginal` junto a `ElegantBook Clásico`
  mediante contratos portables para figuras y tablas.
- Añadida una matriz de integración continua para comprobar motores reales y
  renderizado con Chrome en Windows, macOS y Linux.

### Corregido

- Unificados los contratos de documentación, configuración y nombres de
  archivos entre la aplicación y la skill.
- Corregidos el sitio web institucional, el comportamiento sin logotipo y los
  metadatos de invocación de la skill.
- Corregido el detector de Chrome en Windows para evitar que una consulta de
  versión abra ventanas `newtab`.
- Corregidas las referencias que todavía exigían flotantes LaTeX directos en
  lugar de `guidefigure` y `guidetable`.

### Cambiado

- Adoptada **Jintia** como identidad del producto, con **Jintia Desktop** para
  la aplicación y `jintia-skill` para el motor instalable.
- Añadida compatibilidad para detectar instalaciones anteriores y conservar
  su configuración al instalar la nueva ruta `~/.claude/skills/jintia-skill`.
- Renombrados los metadatos de aplicación, instaladores, workflows y
  documentación sin alterar el contenido académico existente.
- Reescritas las guías públicas, técnicas y de integración con Claude.
- Sustituidas las plantillas Markdown de issues por formularios YAML.
- Normalizada la dependencia NotebookLM MCP verificada.
- Preparada la política, privacidad y automatización condicional requeridas
  para solicitar firma gratuita mediante SignPath Foundation.
- Publicada `jintia-skill` 10.7.0 con una matriz reproducible de pruebas
  multiplataforma como puerta de calidad del sistema visual.

## 10.4.0 — 2026-07-27

- Incorporada **Instructional Designer Manager 1.0.0**, aplicación de
  escritorio para configurar dependencias, institución, NotebookLM, cursos y
  la instalación o exportación de la skill.
- Reorganizado el repositorio como monorepo: `app/desktop/` contiene la
  aplicación Tauri y `skill/` contiene exclusivamente el paquete instalable.
- Añadidos workflows de GitHub Actions para generar instaladores NSIS/MSI en
  Windows y DMG en macOS al publicar un tag.
- Renovados los README en español e inglés con objetivo del producto,
  recorrido visual, capturas Full HD, instalación y arquitectura.
- Aplicado Liquid Glass únicamente a la capa flotante de controles, con
  contenido opaco, estados de foco y alternativas para reducir transparencia
  y movimiento.

## 10.3.1 — 2026-07-17

- Agregado `package.json` con engines, scripts npm y metadatos del paquete.
- Agregado `requirements.txt` con dependencia `pymupdf>=1.24.0`.
- Agregadas issue templates de GitHub: bug report, feature request, institution config.
- README: aclarado `[SKILL_PATH]` con rutas concretas por OS; agregado `pip install` previo al script Python.
- CHANGELOG: corregido título para usar la identidad canónica de Jintia.

## 10.3.0 — 2026-06-16

- Integración completa con notebooklm-mcp (roomi-fields/notebooklm-mcp).
- Paso 2 del Flujo de Arranque: se agrega `re_auth` como segundo intento de autenticación (antes del Flujo manual); se usa `select_notebook` para activar el notebook por defecto y evitar repetir `notebook_id`; se agrega `search_notebooks` como alternativa a `list_notebooks` cuando el id no está en la tabla.
- `ask_question`: ahora se solicita `source_format: "footnotes"` en todas las consultas de respaldo bibliográfico para obtener fuentes citadas al pie.
- `references/bibliografia.md`: mismos cambios en Paso A/B/C del workflow; se agrega Paso E opcional con `add_source` para ingestar URLs y texto plano nuevos al notebook del curso.

## 10.2.0 — 2026-06-10

- Validada con generación real (IFT200 Semana 07: compilación exitosa, validación NotebookLM contra Elmasri 7.ª ed.).
- Paso 2 del Flujo de Arranque: consulta a NotebookLM obligatoria en todo arranque; ante `authenticated: false`, intentar `setup_auth` antes del flujo manual.
- Cierre de Tarea: verificación obligatoria de recortes PDF en `bibliografia/recortes_por_semana/semana-XX/`; se cortan si faltan.
- Regla de plantilla de facto: la semana compilada más reciente del mismo curso manda sobre la referencia canónica (clase compartida `semanas/_shared/latex/`, `siunitx`, footer con logo).
- Tabla de Registros NotebookLM: columna de URL de compartir (IFT200 registrada) y nota de recuperación ante biblioteca local vacía.
- `latex-validator.js`: ejecuta `figure/screenshot.mjs` automáticamente si existe, antes de compilar.

## 10.1.0 — 2026-06-10

- Reestructuración con disclosure progresivo: SKILL.md compacto (~260 líneas) + 6 archivos en `references/` (plantilla-latex, figuras-tikz, figuras-html, bibliografia, compilacion-wsl, checklist).
- Resueltas contradicciones internas: política única sobre `[Pendiente de Verificación]` (prohibida como salida), numeración de bibliografía estrictamente secuencial, `\cover{}` comentado por defecto.
- Scripts alineados con la documentación: `latex-validator.js` con secuencia completa de 3 pasadas via WSL y conversión de rutas; `pdf_cutter_template.py` con salida a `bibliografia/recortes_por_semana/semana-XX/`.
- Checklist ampliado: figuras HTML, `\cover{}`, numeración secuencial.
- Fusionado el contenido único del antiguo `.claude/commands/instructional-designer-uide.md` (Recursos Visuales HTML, Captura de Screenshots, Compilación WSL, Paso de confirmación de plan).

## 10.0.0 — versión previa

- Versión monolítica del SKILL.md (~1.160 líneas) con flujo de arranque, plantilla ElegantBook, gramática de bloques, TikZ/ER Chen, citas APA y workflow NotebookLM como fallback.
