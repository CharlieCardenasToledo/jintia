# Sistema Editorial HTML — Referencia técnica (contrato 12.4)

## Visión general

El motor editorial HTML de Jintia convierte una guía semanal expresada como
`guide.json` (AST neutral) en un documento HTML semántico y, opcionalmente, en
un PDF imprimible a través de Vivliostyle CLI.

```
guide.json  →  guide-renderer.js  →  guide.html  →  vivliostyle-adapter.js  →  guide.pdf
```

Ningún paso escribe ni compila LaTeX. Todo el control tipográfico vive en
CSS Paged Media, vía **Vivliostyle CLI** (único motor soportado,
invocado como proceso externo — nunca importado, para preservar la licencia
MIT de Jintia frente al AGPL-3.0 de Vivliostyle Core).

---

## 1. Formato fuente — `guide.json`

El esquema canónico está en `schemas/guide.schema.json`. Estructura mínima
que acepta `jintia validate` en modo **draft** (sin `metadata.targets` ni
`metadata.hours`, el contrato de alineación/autoinstruccionalidad/evaluación
estructurada no se activa — ver `docs/rules.md`):

```json
{
  "metadata": {
    "course": "Nombre del Curso", "week": 3, "topic": "Tema de la semana",
    "outcome": "Resultado de aprendizaje en infinitivo.",
    "theme": "jintia-clasico", "bibliography": "reference.bib", "citationStyle": "apa"
  },
  "sections": [
    { "type": "orientation", "id": "orientacion", "content": "..." },
    { "type": "theory",      "id": "teoria",      "content": "... {{cite:clave}}" },
    { "type": "practice",    "id": "practica",    "content": "..." },
    { "type": "assessment",  "id": "evaluacion",  "items": [] },
    { "type": "bibliography","id": "referencias" }
  ]
}
```

**Contrato exigido en modo publish** (`jintia compile --publish`, `jintia
report --final`, `jintia ready`) — `targets`, `hours` y estructura completa
de `orientation`/`practice`/`assessment`:

```json
{
  "metadata": {
    "course": "...", "week": 3, "topic": "...", "outcome": "...",
    "hours": 4, "theme": "jintia-tecnico", "bibliography": "reference.bib", "citationStyle": "apa",
    "targets": [{ "id": "T1", "verb": "diseñar", "description": "..." }]
  },
  "sections": [
    { "type": "orientation", "id": "o", "route": ["Teoría", "Práctica", "Evaluación"], "purpose": "...", "materials": ["..."], "successCriteria": ["..."], "estimatedMinutes": 15 },
    { "type": "theory", "id": "t", "targetIds": ["T1"], "claimIds": ["CLM-001"], "content": "... {{cite:clave}}", "estimatedMinutes": 60 },
    { "type": "practice", "id": "p", "mode": "guided", "targetIds": ["T1"], "workedExample": "...", "prompt": "...", "steps": ["...", "..."], "successCriteria": ["..."], "selfCheck": "...", "remediation": "...", "estimatedMinutes": 40 },
    { "type": "assessment", "id": "e", "targetIds": ["T1"], "product": "...", "criteria": [{ "description": "...", "weight": 100 }], "estimatedMinutes": 20 },
    { "type": "bibliography", "id": "refs" }
  ]
}
```

Junto a `guide.json`, `evidence.json` (ver `schemas/evidence.schema.json`)
registra un keyClaim por cada `claimIds` usado, con `sourceMode` y (en
publish) `targetId` obligatorio — ver `docs/notebooklm.md`.

### Tipos de nodo disponibles

`type` es una etiqueta **libre**, no un enum cerrado: podés escribir el tipo
que mejor describa el nodo (`debate`, `timeline`, `decision-tree`...), no
solo los de esta tabla. Los tipos clásicos siguen siendo la forma más simple
de escribir una guía porque activan automáticamente su renderizado dedicado
y sus reglas pedagógicas de familia. `opening`/`case`/`comparison`/`activity`/
`reflection` son alias con la misma capacidad estructural que
`orientation`/`theory`-`concept`/`practice`/`scenario` respectivamente — solo
cambia la etiqueta visual.

| Tipo | Clase CSS | Uso |
|---|---|---|
| `orientation` / `opening` | `.jintia-orientation` | Orientación inicial de la semana; `route` declara la ruta de aprendizaje |
| `theory` | `.jintia-theory` | Contenido teórico expositivo |
| `concept` | `.jintia-concept` | Definición resaltada de un concepto |
| `case` | `.jintia-theory` | Enseñanza contextualizada en un caso (admite `workedExample`/`prompt` como `practice`) |
| `comparison` | `.jintia-concept` | Comparación entre conceptos (admite `workedExample`/`prompt` como `practice`) |
| `practice` / `activity` | `.jintia-practice` | Práctica (`mode`: `guided`, `independent`, `retrieval`, `transfer`) |
| `warning` | `.jintia-warning` | Error frecuente o advertencia |
| `critical-error` | `.jintia-critical-error` | Error crítico que impide avanzar |
| `scenario` / `reflection` | `.jintia-scenario` | Caso o situación contextualizada |
| `assessment` | `.jintia-assessment` | Actividad evaluativa (`criteria`, `product`, `targetIds`) |
| `figure` | `.jintia-figure` | Imagen con `alt` y `caption`, y `src` **o** `visualSpec` |
| `table` | `.jintia-table` | Tabla estructurada con `caption` y `headers` |
| `margin-note` | `.jintia-margin-note` | Nota marginal complementaria |
| `bibliography` | `.jintia-bibliography` | Sección de referencias — debe ser el último nodo |
| `citation` | `.jintia-citation` | **Deprecado.** No usar en guías nuevas — ver más abajo |
| *(cualquier otro string)* | `.jintia-generic--<type>` | Se renderiza igual (nunca se descarta), con etiqueta humanizada del `type`. Ver "Tipos personalizados" abajo |

### Tipos personalizados: `role` y `children`

Cuando ningún tipo clásico describe bien el nodo, inventá el `type` que
corresponda (`"type": "debate"`) y declará **`role`** para que siga
recibiendo las reglas pedagógicas de familia (JIN-ALN-*/JIN-SELF-*/JIN-WRK-*)
en vez de quedar fuera de ellas:

```json
{ "type": "debate", "role": "practice", "targetIds": ["T1"], "estimatedMinutes": 20,
  "content": "Debate estructurado sobre el tema.",
  "children": [
    { "type": "example", "content": "Ronda modelo con evidencia citada." },
    { "type": "prompt", "content": "Defiende tu postura durante 3 minutos." },
    { "type": "feedback", "content": "El moderador retroalimenta cada ronda." }
  ]
}
```

- `role` es uno de `orientation | teaching | practice | assessment |
  supplement`. Con un `type` clásico se infiere solo (no hace falta
  declararlo); con un `type` inventado, sin `role` el nodo se trata como
  `supplement` (renderiza, pero no participa en las reglas de familia) y el
  linter emite `JIN-CNT-006` (aviso, no error) recordándolo.
- `children` es una composición recursiva alternativa a los campos planos
  (`workedExample`/`prompt`/`steps`/`successCriteria`/`selfCheck`/`feedback`/
  `remediation`/`transfer`/`purpose`/`materials`/`route`): en vez de rellenar
  esos campos, podés descomponer el nodo en piezas semánticas anidables
  (`example`, `prompt`, `hint`, `narrative`, `question`, `reflection`,
  `step`, `table`, `figure`, `feedback`, `remediation`, `success-criteria`,
  `self-check`, `transfer`...). Coexisten: un nodo puede usar campos planos,
  `children`, o ambos. El linter detecta la capacidad pedagógica (¿hay
  ejemplo trabajado? ¿hay retroalimentación?) por cualquiera de las dos vías,
  buscando en **todo el subárbol** de `children` — no solo en el primer
  nivel, así que un `feedback` anidado dentro de otra pieza también cuenta.
- `content` también acepta un objeto estructurado (ej.
  `{"question":"...","answer":"..."}`) — se renderiza como lista de
  definición en vez de colapsar a texto.

### Citas: sintaxis inline, no el nodo `citation`

La sintaxis vigente es inline, dentro de cualquier campo `content`:

```text
{{cite:clave}}           → cita parentética: (Apellido, año)
{{cite:clave|narrative}} → cita narrativa: Apellido (año)
```

El nodo `{ "type": "citation" }` sigue siendo válido en el esquema por
compatibilidad con guías existentes, pero está **deprecado** (`JIN-CNT-012`,
warning) — no lo generes en guías nuevas.

### Control de paginación por nodo (`data-pagination`)

| Valor | Comportamiento |
|---|---|
| `atomic` | `break-inside: avoid` — no se divide |
| `splittable` | Sin restricción — puede dividirse entre páginas |
| `keep-with-next` | `break-after: avoid` — va unido al siguiente bloque |
| `page-contained` | `break-before: page; break-after: page` — página propia |
| `repeatable-header` | `<thead>` se repite en cada página (tablas largas) |

---

## 2. Comandos CLI

```bash
# Validar pedagogía y estructura (agrega --publish para el contrato completo)
jintia validate guide.json [--strict] [--json]

# Generar HTML
jintia render guide.json [--theme jintia-clasico] [--output guide.html]

# Generar PDF (requiere Vivliostyle CLI instalado); el tamaño de página lo fija el tema, no un flag
jintia compile guide.json [--output guide.pdf] [--publish]

# Vista previa en navegador
jintia preview guide.html [--port 13000]

# Verificar paginación (recibe el HTML renderizado, no el PDF)
jintia preflight guide.html [--strict] [--json]

# Orquestador completo: encadena todo lo anterior y se detiene en el primer bloqueo
jintia ready guide.json [--json] [--skip-pdf]
```

> Para compilar PDF necesitas Node.js `>=22.13.0` y:
> ```bash
> npm install --global @vivliostyle/cli
> ```

---

## 3. Sistema de temas

Los temas viven en `skill/themes/<id>/` y siguen esta estructura:

```
themes/
  jintia-clasico/    (A4)
    meta.json          ← contrato del tema
    tokens.css         ← variables CSS
    components.css     ← clases de bloques pedagógicos
    print.css          ← @page, break-*, encabezados corridos
    theme.css          ← punto de entrada (importa los tres)
    vivliostyle.config.js
  jintia-tecnico/    (A4)
    meta.json
    tokens.css         ← sobreescribe tokens.css de clasico
    theme.css          ← importa tokens propios + components/print de clasico
  jintia-cuaderno/   (A5)
    meta.json
    tokens.css         ← tamaño A5, mayor espaciado para escritura manual
    print.css          ← márgenes A5 y configuraciones especiales
    theme.css
```

El tamaño de página (`A4`/`A5`) se declara en `meta.json` de cada tema
(`page.size` o `pageSize` según el tema) — no es un valor único para los
tres.

### Jerarquía de importación

```
theme.css
  ├── tokens.css          (paleta, fuentes, espaciado)
  ├── components.css      (bloques pedagógicos — reutilizable por temas hijos)
  └── print.css           (@page, break rules — reutilizable por temas hijos)
```

Los temas hijos solo sobreescriben `tokens.css` y, si necesitan reglas de
paginación distintas, su propio `print.css`. No duplican `components.css`.

### Cómo crear un tema nuevo

1. Crear `themes/<id>/meta.json` (copiar de `jintia-clasico/meta.json`).
2. Crear `themes/<id>/tokens.css` — `@import "../jintia-clasico/tokens.css"` y sobrescribir variables.
3. Crear `themes/<id>/theme.css` — importar `./tokens.css`, luego `../jintia-clasico/components.css` y `../jintia-clasico/print.css`.

---

## 4. Pipeline de figuras

El pipeline visual genera imágenes con `visual-renderer.js` y las registra en
`figure/manifest.json`. La salida JSON incluye el campo `html` con el
fragmento `<figure>` listo para insertar en el `guide.json`:

```json
{
  "entry": { ... },
  "html":  "<figure class=\"jintia-figure\" ...>...</figure>"
}
```

La función `htmlFigure(spec, outputPath)` en `guide-renderer.js` genera ese
fragmento. El campo `html` en la salida del pipeline es el que debe copiarse
al nodo `figure` correspondiente del `guide.json`.

---

## 5. Pipeline de linting

```
guide.json  →  content-linter.js   (JIN-SCH-*, JIN-CNT-*, JIN-ALN-*, JIN-WRK-*, JIN-SELF-*, JIN-ASM-*, JIN-EVD-*, JIN-BIB-007)
guide.html  →  html-linter.js      (JIN-HTM-001…008)
guide.html  →  pdf-preflight.js    (JIN-PFG-001…006)
README.md   →  rules-runner.js     (JIN-SYL-*, JIN-ALN-002, JIN-ACC-002)
```

Ejecutar en cadena manualmente:

```bash
jintia validate  guide.json --publish && \
jintia render    guide.json --output guide.html && \
node skill/scripts/html-linter.js guide.html && \
jintia compile   guide.json --publish && \
jintia preflight guide.html
```

o, de un solo golpe (recomendado, se detiene en el primer bloqueo):

```bash
jintia ready guide.json
```

---

## 6. Dependencias

| Paquete | Para qué | Estado |
|---|---|---|
| `@citation-js/core`, `@citation-js/plugin-bibtex`, `@citation-js/plugin-csl` | Formatear bibliografía APA desde `.bib` | **Dependencia normal** de `skill/package.json` — no opcional. Su ausencia bloquea publish (`JIN-BIB-001`) |
| `@vivliostyle/cli` | Compilar PDF | Externo, instalación global: `npm install --global @vivliostyle/cli`. Su ausencia bloquea `jintia ready` sin `--skip-pdf` |
| `node-html-parser` | `html-linter.js` con cobertura total | Dependencia normal |
| `playwright` | `pdf-preflight.js` en modo real (fallback estático si no está) | Dependencia de desarrollo |

Solo Vivliostyle CLI es verdaderamente opcional en el sentido de "se puede
trabajar en draft sin él" (`--skip-pdf` en `jintia ready`, o simplemente no
compilar PDF todavía). Citation.js **no** es opcional: es dependencia normal
del paquete y compuerta de publicación.

---

## 7. Licencias relevantes

- **Vivliostyle Core** — AGPL-3.0. Jintia lo invoca como proceso externo (`spawnSync`) y nunca lo importa. Esto evita que la licencia AGPL se propague al código de Jintia (MIT).
- **@citation-js/core** y plugins — MIT.
- **node-html-parser** — MIT.
- **Playwright** — Apache-2.0.
