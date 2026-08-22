# Operación `validate`

| Entorno | Invocación |
|---|---|
| Claude Code | `/jintia-skill` |
| Codex / OpenAI | `$jintia-skill` |
| CLI directa | `jintia validate` |

Valida la estructura pedagógica y editorial de un `guide.json` antes de renderizar.
Ejecuta el linter de contenido (`content-linter.js`) contra el schema canónico.

## Qué verifica

| Regla | Categoría | Severidad |
|---|---|---|
| JIN-SCH-001 | Esquema | Error — incumplimiento del contrato `guide.schema.json` |
| JIN-CNT-001 | Estructura | Error — falta nodo `orientation` |
| JIN-CNT-002 | Accesibilidad | Error — figura sin `alt` o `caption` |
| JIN-CNT-003 | Pedagogía | Advertencia — `assessment` sin `practice` previo |
| JIN-CNT-004 | Bibliografía | Advertencia — clave citada no existe en `.bib` |
| JIN-CNT-005 | Alineación | Error — falta `outcome` en metadata |
| JIN-CNT-006 | Estructura | Error — tipo de nodo desconocido |
| JIN-CNT-007 | Accesibilidad | Advertencia — tabla sin `caption` o `headers` |
| JIN-CNT-008 | Estructura | Advertencia — IDs duplicados |
| JIN-CNT-009 | Bibliografía | Advertencia — hay citas pero no se declaró `bibliography` |
| JIN-CNT-010 | Paginación | Advertencia — valor de `pagination` inválido |

## Ejemplos

```bash
node "<skill-root>/bin/jintia.js" validate semanas/semana-03/guide.json
node "<skill-root>/bin/jintia.js" validate semanas/semana-03/guide.json --strict
node "<skill-root>/bin/jintia.js" validate semanas/semana-03/guide.json --json
```
