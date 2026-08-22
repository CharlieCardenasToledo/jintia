# NotebookLM

NotebookLM es la fuente **primaria** de evidencia disciplinar en Jintia — no
una integración opcional para "contrastar" afirmaciones después de escribir.
Toda afirmación disciplinar central (definiciones, modelos, clasificaciones,
relaciones causales, cifras, normas, teorías) debe resolverse contra una
fuente verificable antes de redactarla, y la fuente queda registrada con su
procedencia declarada.

## Jerarquía de resolución (una sola, sin excepciones silenciosas)

```text
NotebookLM (hasta 3 intentos estructurados)
  ↓ agotados sin éxito
fuente local verificable (recortes, bibliografía, reference.bib, sílabo)
  ↓ ninguna disponible
ai-fallback (conocimiento del modelo, último recurso)
```

Los tres modos de procedencia (`sourceMode` en `evidence.json`) son:
`notebook-primary`, `local-fallback`, `ai-fallback`.

**Distinción obligatoria:** que NotebookLM responda pero la respuesta no
resuelva la pregunta **no** es indisponibilidad — el investigador debe seguir
preguntando (reformular, dividir la consulta, buscar otra fuente dentro del
notebook) antes de considerar la afirmación sin respaldo. Solo un fallo
técnico confirmado tras los 3 intentos activa el fallback local.

Los 3 intentos estructurados:

```text
intento 1: resolver notebook + ask_question
↓ falla
intento 2: reutilizar/recrear session_id + reconsultar
↓ falla
intento 3: re_auth SOLO si hay evidencia real de fallo de login + reconsultar
↓ falla
registrar NotebookLM como no disponible (temporal) → fuente local → ai-fallback
```

`ai-fallback` nunca fabrica autor, obra, año, página o DOI: se declara
explícitamente y `JIN-EVD-001`/`JIN-EVD-003` lo advierten (no bloquean).
Presentar contenido `ai-fallback` sin declarar su procedencia sí bloquea
(`JIN-EVD-002`), porque oculta la procedencia en vez de declararla.

El procedimiento completo para el agente investigador — incluidas las
herramientas MCP exactas (`get_health`, `setup_auth`, `re_auth`,
`select_notebook`, `ask_question` con `source_format: "json"`, `session_id`)
— vive en [`skill/references/bibliografia.md`](../skill/references/bibliografia.md)
y en `agents/jintia-researcher.md`; este documento resume la política para
un lector externo al repositorio.

## Versión del MCP

La integración usa una versión **fijada** de
[`@charlie.act7/gemini-notebook-mcp`](https://www.npmjs.com/package/@charlie.act7/gemini-notebook-mcp),
declarada en [`release/release-config.json`](../release/release-config.json)
(`mcp.version`, con su `npmIntegrity` SRI) — esa es la única fuente de
verdad; ningún otro documento debe repetir el número de versión, para que no
quede desincronizado en el próximo release. Nunca `@latest` ni un rango
flotante (`^`/`~`).

## Trazabilidad de intentos (`notebookResolution`)

`evidence-gate.js` `check()` acepta opcionalmente `notebookLM.attempts`
(`[{ attempt, result, reAuth? }]`) y `notebookLM.fallbackReason`. Si se
declaran, el resultado incluye `notebookResolution` y `jintia plan save` lo
persiste en el plan — así "NotebookLM no disponible" deja de ser solo una
instrucción de política y queda demostrado. Sin esta trazabilidad,
`local-fallback` con NotebookLM configurado emite `JIN-EVD-028`
(advertencia): la política de 3 intentos quedó declarada pero no probada.

## Informe de procedencia académica (`evidence.json`)

Cuando existe `semanas/semana-XX/evidence.json`, `jintia validate` calcula
sobre los `keyClaims` **realmente referenciados desde `guide.json`** (nunca
sobre claims huérfanos) el porcentaje por `sourceMode` y una clasificación
`academicProvenance`:

```text
Evidence provenance
NotebookLM primary .... 84 %
Local fallback ........ 16 %
AI fallback ............ 0 %

Academic provenance: STRONG
```

| Nivel | Condición |
|---|---|
| `STRONG` | `aiFallback = 0 %` y `notebookPrimary >= 80 %` |
| `GOOD` | `aiFallback <= 10 %` y sin keyClaims sin procedencia |
| `DEGRADED` | `aiFallback > 10 %`, o hay keyClaims con `extractionStatus: "partial"` |
| `WEAK` | `aiFallback > 30 %`, o hay `claimIds` de `guide.json` sin entrada en `evidence.json` |
| `BLOCKED` | hay keyClaims sin `sourceMode`, con `bibliographyKey` inexistente, con bibliografía fabricada en `ai-fallback`, o cuyo `targetId` no existe en `metadata.targets` (publish) |

En modo publish, además: todo keyClaim usado debe declarar un `targetId`
válido (`JIN-EVD-026`) y todo target de `metadata.targets` debe tener al
menos un keyClaim que lo sustente (`JIN-EVD-027`) — el grafo
target → claim → evidencia debe cerrar en el propio artefacto, no solo en la
matriz del plan.

## Configuración

El notebook de cada curso se registra en `config/notebooks.json` (ver
`config/notebooks.example.json` y `config/notebooks.schema.json` en la raíz
de la skill). Autenticarte una vez con `setup_auth` persiste la sesión; no
es necesario repetirlo salvo que una operación real confirme un fallo de
login.
