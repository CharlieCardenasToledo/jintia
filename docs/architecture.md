# Arquitectura

Jíntia convierte contenido pedagógico estructurado en documentos HTML y PDF
mediante un pipeline editorial propio, precedido por un contrato pedagógico
(plan → evidencia) que se resuelve antes de escribir cualquier contenido.

## Visión general

```
README.md (sílabo)
    │
    ▼
plan-state.js  ←──────────────►  evidence-gate.js
(targets, alignmentMatrix,        (NotebookLM → local → ai-fallback)
 workloadBudget, assessmentContract)
    │  jintia plan approve (JIN-PLN-001..004)
    ▼
guide.json + evidence.json
    │
    ▼
content-linter.js  (rule-catalog.js: fuente única de severidad/categoría)
    │  jintia validate --publish
    ▼
guide-renderer.js  →  guide.html
    │                     │
    │              html-linter.js
    │                     │
    │              pdf-preflight.js
    │                     │
    ▼                     ▼
vivliostyle-adapter.js (proceso externo)
    │
    ▼
guide.pdf

ready.js orquesta toda la cadena desde guide.json hasta guide.pdf de un
solo golpe, deteniéndose en el primer bloqueo (jintia ready).
```

La fuente canónica de una semana es siempre `guide.json` + `evidence.json`.
El HTML se genera a partir de `guide.json`; el PDF se genera a partir del
HTML. Nunca se edita el HTML directamente. Nada de esto se escribe sin un
plan aprobado.

## Contrato pedagógico previo a la redacción

### `skill/runtime/core/plan-state.js`

Persiste `.jintia-plan.json` por semana. Estados: `pending` → `approved` →
`generated` (o `blocked`, reservado para contrato curricular irresoluble —
semana/RA inexistente en el sílabo — nunca por falta de evidencia externa,
que siempre tiene un fallback). `approvePlan()` exige, para todo plan que no
declare `"legacy": true`: `targets` no vacío, `alignmentMatrix` completa
(enseñanza/práctica/feedback/evaluación/evidencia por target),
`workloadBudget` consistente (70-130% de cobertura) y `assessmentContract`
alineado con las actividades calificadas del sílabo (`JIN-PLN-001..004`).

### `skill/runtime/core/evidence-gate.js`

Aplica la jerarquía NotebookLM (3 intentos) → fuente local verificable →
`ai-fallback` (último recurso, nunca fabrica bibliografía). Acepta
opcionalmente `notebookLM.attempts`/`fallbackReason` para trazabilidad
(`notebookResolution`); sin ella, `local-fallback` con NotebookLM
configurado advierte `JIN-EVD-028`. Ver `docs/notebooklm.md`.

### `skill/runtime/core/rule-catalog.js`

Punto de acceso único a `rules/catalog.json` (id, categoría, severidad,
descripción de cada `JIN-*`). `content-linter.js` y `rules-runner.js` lo
consultan en vez de mantener copias locales — evita drift entre el catálogo
documentado y el comportamiento real de los validadores.

## Componentes principales

### `skill/scripts/guide-renderer.js`

Motor de renderizado central. Lee `guide.json`, aplica el tema HTML
seleccionado y produce un HTML semántico con atributos `data-pagination`
que controlan el comportamiento de paginación en impresión.

Cada tipo de sección pedagógica se renderiza con su propio componente:

| Tipo | Clase CSS | Comportamiento de página |
|---|---|---|
| `orientation` | `jintia-orientation` | `atomic` (no se divide) |
| `theory` | `jintia-theory` | `splittable` |
| `concept` | `jintia-concept` | `atomic` |
| `practice` | `jintia-practice` | `splittable` |
| `warning` | `jintia-warning` | `atomic` |
| `critical-error` | `jintia-critical-error` | `atomic` |
| `figure` | `jintia-figure` | `atomic` |
| `assessment` | `jintia-assessment` | `page-contained` |
| `bibliography` | `jintia-bibliography` | `splittable` |

### `skill/scripts/vivliostyle-adapter.js`

Invoca Vivliostyle CLI como proceso externo mediante `spawnSync`. Nunca importa
la API interna de Vivliostyle (eso violaría la licencia AGPL, que no se
propaga porque nunca hay `require`/`import` de su código, solo un proceso
hijo). Es el **único** motor de compilación soportado. El adaptador acepta
`--theme`, `--output` y `--size`.

### `skill/scripts/content-linter.js`

Valida `guide.json` contra `skill/schemas/guide.schema.json` y contra
`rules/catalog.json` antes de renderizar. Aplica, según lo declarado en la
guía y el modo (draft/publish): `JIN-SCH-*` (esquema y contrato de publish),
`JIN-CNT-*` (estructura), `JIN-ALN-*` (alineación target-enseñanza-práctica-
evaluación), `JIN-WRK-*` (carga horaria), `JIN-SELF-*` (autoinstruccionalidad),
`JIN-ASM-*` (evaluación estructurada) y `JIN-EVD-*` (procedencia de
`evidence.json`, incluido el grafo target → claim → evidencia en publish).

### `skill/scripts/ready.js`

Orquestador de publicación (`jintia ready`): encadena `validate --publish` →
procedencia de evidencia → bibliografía (pre-render) → `render` →
`html-lint` → bibliografía (post-render) → `preflight` → `compile`,
deteniéndose en el primer paso bloqueante. Decide entre `READY`,
`PRECHECK_READY` (con `--skip-pdf`), `NEEDS_CHANGES` y `BLOCKED`. No
sustituye la revisión de `jintia-selfstudy-reviewer`/`jintia-finish-reviewer`
(contratos de agente, no deterministas).

### `skill/scripts/html-linter.js`

Valida el HTML generado mediante análisis DOM. Aplica las reglas `JIN-HTM-*`:
imágenes con alt, bloques con `data-pagination`, tablas con caption y thead.

### `skill/scripts/pdf-preflight.js`

Analiza el PDF post-renderizado con Playwright. Detecta encabezados huérfanos,
figuras separadas de su caption, tablas desbordadas y páginas con menos del 20 %
de contenido.

### `skill/scripts/bibliography-manager.js`

Integra Citation.js para leer archivos `.bib` y resolver citas inline. Reemplaza
el sistema anterior basado en `biber`.

## Temas HTML

Los temas viven en `skill/themes/`. Cada tema es un directorio con:

```
jintia-clasico/
├── meta.json              ← contrato del tema
├── tokens.css             ← design tokens
├── components.css         ← bloques pedagógicos
├── print.css              ← @page y break-*
├── theme.css              ← punto de entrada
└── vivliostyle.config.js  ← configuración para Vivliostyle
```

El tema activo se declara en `guide.json` (`metadata.theme`) o en
`skill/config/institution.json` (`activeTemplate`).

## Esquemas JSON

| Archivo | Valida |
|---|---|
| `skill/schemas/guide.schema.json` | Estructura de `guide.json` |
| `skill/schemas/evidence.schema.json` | Estructura de `evidence.json` (procedencia por keyClaim) |
| `skill/schemas/visual-spec.schema.json` | Especificaciones de figuras |
| `skill/schemas/visual-manifest.schema.json` | Manifiesto del pipeline visual |
| `skill/config/institution.schema.json` | Configuración institucional |
| `skill/config/notebooks.schema.json` | Registro de notebooks de NotebookLM por curso |

## Distribución

```
packages/
├── core/       ← fachada de skill/runtime/core
├── cli/        ← punto de entrada npx
├── rules/      ← reglas exportables
├── templates/  ← temas exportables
└── skill/      ← skill completa empaquetada
```

El paquete npm `@charlie.act7/jintia` expone el binario `jintia` que orquesta
todos los scripts anteriores desde un único punto de entrada.
