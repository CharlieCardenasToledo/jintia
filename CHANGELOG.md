# Changelog — Jintia

Este archivo sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y versionado semántico.

## Sin publicar

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
