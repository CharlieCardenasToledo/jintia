# Bibliografía, evidencia y NotebookLM MCP

Leer cuando una tarea redacte contenido académico, resuelva fuentes o construya referencias.

## Política vinculante

- Verificar toda afirmación teórica central según la jerarquía de fuentes.
- No inventar citas, autores, años, páginas, claves o referencias — en ningún modo, incluido `ai-fallback`.
- No entregar marcadores como `[Pendiente de Verificación]`.
- Distinguir una elaboración propia de una afirmación respaldada.
- Conservar recortes de las páginas citadas cuando las fuentes estén en PDF.

## Orden de resolución (fuente única de verdad: `SKILL.md` §2 "Verificar evidencia")

1. **NotebookLM**, hasta 3 intentos estructurados (resolver+consultar → recrear sesión y reconsultar → `re_auth` solo ante fallo de login confirmado y reconsultar).
2. **Fuentes locales**: `bibliografia/recortes_por_semana/semana-XX/`, luego `bibliografia/`, luego el `README.md` del curso.
3. **Conocimiento del modelo (`sourceMode: "ai-fallback"`)**, como último recurso: nunca fabrica bibliografía; se declara explícitamente y el audit lo advierte (`JIN-EVD-001`/`JIN-EVD-003`).

**Trazabilidad de los 3 intentos (`notebookResolution`).** `evidence-gate.js`
`check()` acepta opcionalmente `notebookLM.attempts`
(`[{ attempt, result, reAuth? }]`) y `notebookLM.fallbackReason`; si se
declaran, el resultado (y el plan, vía `jintia plan save`) incluye
`notebookResolution` — así queda demostrado, no solo declarado, que la
política se agotó antes de caer a `local-fallback`. Sin esta trazabilidad,
un `local-fallback` con NotebookLM configurado emite `JIN-EVD-028`
(advertencia).

Los tres modos de procedencia (`sourceMode`) son: `notebook-primary`, `local-fallback` y `ai-fallback`.

NotebookLM es la fuente operativa primaria — no un contraste posterior. Aun
así, la bibliografía nunca cita "NotebookLM" como autor: se cita la fuente
subyacente que NotebookLM identifica en cada respuesta (`source_id`, nombre,
tipo, ubicación), registrada en `reference.bib` con su propia clave. Ver
`SKILL.md` §2 para el detalle completo de los 3 intentos y las reglas de
`ai-fallback`.

## NotebookLM MCP

La versión canónica es la fijada en `release/release-config.json`
(`mcp.version`, con su `npmIntegrity` SRI) — esa es la única fuente de
verdad, no un número de versión repetido en varios documentos. No usar
`@latest` ni un rango flotante (`^`/`~`): la CI de Jintia rechaza esos specs
explícitamente. Para invocarlo manualmente:

```text
npx -y @charlie.act7/gemini-notebook-mcp@<versión de release-config.json>
```

Flujo (ver también `SKILL.md` §2 para los 3 intentos estructurados):

1. Llamar `get_health`. Esto solo informa si existe un respaldo de
   autenticación legible — **no prueba la sesión contra Google**
   (`authenticated` puede devolver `null` de forma intencional). No llamar
   `re_auth` solo porque `authenticated !== true`.
2. Primera instalación sin respaldo de autenticación: llamar `setup_auth`. El navegador puede permanecer abierto hasta 10 minutos.
3. Solo si una operación real confirma que Google redirigió a inicio de sesión (fallo de login, no un `authenticated` incierto): llamar `re_auth`.
4. Resolver el curso desde `config/notebooks.json`.
5. Usar `select_notebook` cuando exista un id válido.
6. Si el id no está disponible, usar `search_notebooks` o `list_notebooks`.
7. Antes de llamar `add_notebook`, mostrar la URL y pedir confirmación explícita.
8. Llamar `ask_question` con una pregunta específica y `source_format: "json"` (no `"footnotes"`): el MCP devuelve `source_id`, nombre, tipo, URL, ubicación, extracto y `extraction_status` de forma estructurada, más `_provenance`.
9. Guardar y reutilizar el `session_id`; si la sesión se pierde, recrearla (`reset_session`) antes de recurrir a `re_auth`.
10. Revisar la procedencia devuelta por el servidor antes de redactar.

`add_source` admite URLs y texto. No asumir que puede subir archivos locales. La indexación puede tardar varios segundos.

## Conocimiento del modelo (`ai-fallback`)

Cuando NotebookLM (tras sus 3 intentos) y las fuentes locales no resuelven
una afirmación, la generación continúa — ya no se detiene por completo —
pero bajo reglas estrictas:

- Declarar la procedencia como `ai-fallback` en vez de presentarla como
  evidencia verificada.
- Nunca fabricar autor, obra, año, página o DOI para respaldar esa
  afirmación.
- El audit advierte estos fragmentos mediante `JIN-EVD-001`/`JIN-EVD-003`
  (advertencia, no bloqueo). Presentar contenido `ai-fallback` sin declarar
  su procedencia dispara `JIN-EVD-002` y sí bloquea, porque oculta en vez de
  declarar.
## Informe de procedencia académica (`evidence.json`)

Cuando existe `semanas/semana-XX/evidence.json` (ver
`schemas/evidence.schema.json`), `jintia validate` calcula sobre los
`keyClaims` declarados el porcentaje por `sourceMode` y una clasificación
`academicProvenance`:

```text
Evidence provenance
NotebookLM primary .... 84 %
Local fallback ........ 16 %
AI fallback ............ 0 %

Academic provenance: STRONG
```

Clasificación:

| Nivel | Condición |
|---|---|
| `STRONG` | `aiFallback = 0 %` y `notebookPrimary >= 80 %` |
| `GOOD` | `aiFallback <= 10 %` y sin keyClaims sin procedencia |
| `DEGRADED` | `aiFallback > 10 %`, o hay keyClaims con `extractionStatus: "partial"` (`JIN-EVD-015`) |
| `WEAK` | `aiFallback > 30 %`, o hay `claimIds` de guide.json sin entrada en evidence.json |
| `BLOCKED` | hay keyClaims sin `sourceMode`, con `bibliographyKey` inexistente, o con bibliografía fabricada en modo `ai-fallback` (`JIN-EVD-016`) |

Los umbrales son un punto de partida y pueden recalibrarse con casos reales.

## Flujo manual (solo sin herramientas MCP en el harness actual)

Esta sección **no** es un paso adicional sobre el flujo con herramientas MCP
de arriba — es la alternativa cuando el harness actual no expone
`ask_question`/`add_notebook` como herramientas invocables (p. ej. un agente
sin el servidor MCP de NotebookLM configurado) y hay una persona con acceso
al notebook en el navegador. No sustituye los 3 intentos estructurados
cuando sí hay herramientas MCP disponibles, y tampoco es un paso previo
obligatorio antes de `ai-fallback`: si no hay MCP ni persona disponible para
pegar la respuesta, se continúa directamente con la jerarquía normal
(fuente local → `ai-fallback`).

Detener únicamente el fragmento afectado y emitir:

```text
CONSULTA NOTEBOOKLM REQUERIDA
Notebook: [nombre]
Fuente prevista: [autor, año, título]
Sección: [capítulo o apartado]
Pregunta: [pregunta verificable y concreta]

Pega la respuesta con sus fuentes para continuar.
```

## Citas en guide.json

**Sintaxis canónica única** (en campos `content` de cualquier nodo):

```
La normalización reduce anomalías {{cite:date2004}}.
Según {{cite:date2004|narrative}}, el modelo relacional...
```

| Sintaxis | Resultado |
|---|---|
| `{{cite:clave}}` | Cita parentética: *(Apellido, año)* |
| `{{cite:clave|narrative}}` | Cita narrativa: *Apellido (año)* |

El nodo `{ "type": "citation" }` está **DEPRECADO**. No crear nuevos nodos `citation`;
usar exclusivamente la sintaxis inline. El validador JIN-CNT-012 reporta advertencia
cuando encuentra nodos `citation`.

El nodo `{ "type": "bibliography" }` al final de `sections` genera la lista de referencias.
Debe ser siempre el último nodo (JIN-CNT-011).

## Fuente bibliográfica única

Declarar en `metadata.bibliography` la ruta relativa al archivo `.bib`:

```json
{
  "metadata": {
    "bibliography": "reference.bib",
    "citationStyle": "apa"
  }
}
```

Mantener una entrada BibLaTeX en `reference.bib` por cada clave citada:

```bibtex
@book{newman2021,
  author    = {Sam Newman},
  title     = {Building Microservices},
  edition   = {2},
  year      = {2021},
  publisher = {O'Reilly Media}
}
```

En el HTML final, las citas se procesan con Citation.js (dependencia normal,
no opcional). El nodo `bibliography` al final de `sections` genera la lista
formateada. No combinar nodos `citation` con HTML bibliográfico manual.

`jintia render`/`jintia compile` (modo draft, por defecto) toleran Citation.js
ausente, `.bib` incompleto o claves sin resolver, mostrando marcadores en vez
de fallar. `jintia compile --publish` bloquea ante cualquiera de esas
condiciones:

| Código | Condición |
|---|---|
| `JIN-BIB-001` | Citation.js no instalado |
| `JIN-BIB-002` | `metadata.bibliography` ausente o el `.bib` declarado no existe |
| `JIN-BIB-003` | Clave citada sin entrada en `reference.bib` |
| `JIN-BIB-004` | `reference.bib` no parsea como BibTeX válido |
| `JIN-BIB-005` | Queda una clave cruda (`{{cite:...}}`) sin resolver en el HTML final |
| `JIN-BIB-006` | Aparece bibliografía o cita degradada (marcador `jintia-degraded`) en el HTML final |
| `JIN-BIB-007` | `citationStyle` distinto de `"apa"` |

Ningún material académico final se publica con bibliografía degradada.

## Recortes

Guardar cada recorte en:

```text
bibliografia/recortes_por_semana/semana-XX/
```

Usar nombres trazables, por ejemplo:

```text
Autor_2024_Cap3_Sec31-34_pp80-96.pdf
```

Verificar que las páginas físicas extraídas correspondan a las páginas impresas de la fuente.
