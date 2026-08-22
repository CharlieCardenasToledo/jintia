# Documentación de Jintia

Mapa de la documentación pública. Si dos documentos parecen contradecirse,
consulta la tabla de autoridad al final — cada afecto tiene una única fuente
canónica.

## Por dónde empezar

| Si quieres... | Ve a |
|---|---|
| Instalar Jintia por primera vez | [`getting-started.md`](getting-started.md) |
| Usar Jintia específicamente en Claude Code | [`claude-code.md`](claude-code.md) |
| Crear un curso desde cero | [`create-first-course.md`](create-first-course.md) |
| Generar una guía semanal (flujo completo) | [`generate-weekly-guide.md`](generate-weekly-guide.md) |
| Consultar la sintaxis exacta de la CLI | [`cli.md`](cli.md) |
| Entender la política de evidencia / NotebookLM | [`notebooklm.md`](notebooklm.md) |
| Ver qué reglas de calidad existen | [`rules.md`](rules.md) — el catálogo completo vive en `skill/rules/catalog.json` |
| Elegir o crear un tema HTML | [`templates.md`](templates.md) |
| Entender el pipeline editorial completo | [`architecture.md`](architecture.md) |
| Contribuir código o correr las pruebas | [`testing.md`](testing.md) |
| Publicar un release | [`releasing.md`](releasing.md) |
| Diagnosticar un problema concreto | [`troubleshooting.md`](troubleshooting.md) |
| Configurar la detección de harnesses de agente | [`harnesses.md`](harnesses.md) |
| Usar el nombre "Jintia" / atribución | [`brand-guidelines.md`](brand-guidelines.md) |

## Tabla de autoridad

Cuando un documento y el código real difieran, esto gana:

| Aspecto | Fuente canónica |
|---|---|
| Versión del paquete / MCP de NotebookLM | [`release/release-config.json`](../release/release-config.json) y `package.json` |
| Sintaxis exacta de la CLI | `jintia` sin argumentos (`usage()` en [`skill/bin/jintia.js`](../skill/bin/jintia.js)) |
| Catálogo de reglas (`JIN-*`) | [`skill/rules/catalog.json`](../skill/rules/catalog.json) |
| Esquema de `guide.json` | [`skill/schemas/guide.schema.json`](../skill/schemas/guide.schema.json) |
| Esquema de `evidence.json` | [`skill/schemas/evidence.schema.json`](../skill/schemas/evidence.schema.json) |
| Contrato del plan | [`skill/runtime/core/plan-state.js`](../skill/runtime/core/plan-state.js) y [`skill/commands/plan.md`](../skill/commands/plan.md) |
| Política de invocación del agente | [`skill/SKILL.md`](../skill/SKILL.md) |
| Comportamiento de cada operación | [`skill/commands/*.md`](../skill/commands/) |

Esta página (`docs/README.md`) es un índice, no una fuente de contenido — no
dupliques aquí lo que ya explican los documentos enlazados.
