# Avisos de terceros

Jintia se distribuye bajo la licencia MIT, pero integra componentes con sus
propias licencias. Cada componente conserva su autoría y condiciones
originales.

## Componentes principales — motor editorial HTML

| Componente | Uso en Jintia | Licencia |
| --- | --- | --- |
| **Node.js** | Entorno de ejecución principal de la *skill* | MIT / Múltiples |
| **@vivliostyle/theme-base** | Módulos CSS base reutilizados en los temas `jintia-clasico` y derivados | CC0-1.0 (dominio público) |

### Nota sobre Vivliostyle CLI (AGPL-3.0)

Jintia detecta e invoca `vivliostyle` (AGPL-3.0) como **proceso externo e
independiente** mediante `spawnSync`. Jintia nunca importa ni enlaza la API
interna de `@vivliostyle/cli` ni de `@vivliostyle/core`. Esta invocación es
equivalente al uso de cualquier herramienta externa del sistema invocada
como proceso independiente (por ejemplo, un compilador de documentos o un
editor de imágenes por línea de comandos) y no crea un "programa combinado"
bajo AGPL-3.0.

El usuario que instale Vivliostyle CLI de forma independiente lo hace bajo
sus propios términos. Jintia no lo empaqueta, redistribuye ni descarga
silenciosamente.

## Dependencias de Construcción (Desarrollo)

Estos paquetes se utilizan exclusivamente durante la construcción y empaquetado de las *releases* (archivos ZIP) y no se distribuyen en el código final de la *skill* que ejecuta el usuario:

| Componente | Uso | Licencia |
| --- | --- | --- |
| **yazl** | Empaquetado ZIP de las distribuciones (`scripts/build-skill-release.mjs`) | MIT |
| **buffer-crc32** | Dependencia transitiva de empaquetado | MIT |

## Dependencias opcionales (no redistribuidas)

| Componente | Uso | Licencia |
| --- | --- | --- |
| **Vivliostyle CLI** (`@vivliostyle/cli`) | Compilación PDF — invocado como proceso externo | AGPL-3.0 |
| **@citation-js/core** y plugins | Formateo de citas APA y bibliografías desde `.bib` | MIT |
| **node-html-parser** | Análisis DOM en `html-linter.js` | MIT |
| **Playwright** | Verificación de paginación en `pdf-preflight.js` | Apache-2.0 |

Estas dependencias **no se empaquetan ni redistribuyen** con Jintia. El
sistema opera sin ellas en modo degradado. Si el usuario las instala
localmente, conservan sus propias licencias, versiones y condiciones de
instalación. La skill no las instala silenciosamente.

## Componentes LaTeX legados (no incluidos desde v11)

Las plantillas ElegantBook (LPPL 1.3c) y Kaobook/Kaohandt 0.9.8 (LPPL 1.3)
ya no se distribuyen con Jintia a partir de la versión 11.0.0. Las guías
migradas al formato `guide.json` no dependen de ellas. Si conservas guías
`.tex` antiguas que las referencian, el archivo `.tex` no es redistribuido
por Jintia.

## Herramientas visuales opcionales no distribuidas

Jintia puede detectar y ejecutar instalaciones locales de Graphviz, Mermaid
CLI, PlantUML, D2, Vega-Lite/Vega CLI, WaveDrom, Inkscape, Chrome/Chromium,
Python, GeoPandas y RDKit. Esas herramientas no se empaquetan ni redistribuyen
con Jintia. Conservan sus propias licencias, versiones y condiciones de
instalación.

## Marcas y servicios

Diagram Design — Cathryn Lavery. Uso: gramática visual adaptada para el motor editorial SVG interno. Licencia: MIT; no implica afiliación ni patrocinio.

Claude y Anthropic son marcas de Anthropic PBC. Google, Gemini y NotebookLM
son marcas de Google LLC. Jintia es un proyecto independiente y no está
afiliado, patrocinado ni respaldado por esas empresas.

Consulta las licencias incluidas en las distribuciones de cada dependencia. Si
detectas una atribución incompleta, repórtala en el sistema de issues del
proyecto.
