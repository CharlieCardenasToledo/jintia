# Operación `behavior`

| Entorno | Invocación |
|---|---|
| Claude Code | `/jintia-skill` |
| Codex / OpenAI | `$jintia-skill` |
| CLI directa | `jintia behavior` |

Verifica que un `guide.json` cumple los contratos de comportamiento del agente:
orden de nodos, integridad bibliográfica, outcome sustantivo, secuencia canónica,
y otros invariantes observables que no cubre el linter de esquema.

Jintia distingue dos tipos de evaluación de comportamiento:

| Tipo | Comando | Requiere API |
|---|---|---|
| Determinístico (estructural) | `jintia behavior <guide.json>` | No |
| Semántico (LLM judge) | `jintia behavior eval --output <archivo>` | Sí (`ANTHROPIC_API_KEY`) |

## Evaluación determinística

Ejecuta 7 contratos verificables sin llamadas externas:

```bash
node "<skill-root>/bin/jintia.js" behavior semanas/semana-03/guide.json
node "<skill-root>/bin/jintia.js" behavior semanas/semana-03/guide.json --strict
node "<skill-root>/bin/jintia.js" behavior semanas/semana-03/guide.json --json
```

### Contratos determinísticos

| ID | Nombre | Qué verifica |
|---|---|---|
| BHV-D-001 | scenario-after-theory | `scenario` aparece después del último nodo teórico |
| BHV-D-002 | bibliography-at-end | `bibliography` es siempre el último nodo |
| BHV-D-003 | assessment-after-practice | `assessment` está precedido por `practice` o `scenario` |
| BHV-D-004 | orientation-is-first | El primer nodo es siempre `orientation` |
| BHV-D-005 | outcome-is-substantive | `outcome` ≥ 15 caracteres, comienza con verbo |
| BHV-D-006 | no-orphan-citation-keys | Todas las claves `citation` existen en `.bib` |
| BHV-D-007 | no-theory-without-any-citation | Guías con teoría declaran al menos una referencia |

## Evaluación semántica (LLM judge)

Evalúa outputs del agente contra specs que requieren comprensión del contenido:

```bash
# Listar specs semánticos disponibles
node "<skill-root>/bin/jintia.js" behavior list

# Evaluar un guide.json contra todos los specs semánticos
ANTHROPIC_API_KEY=sk-... node "<skill-root>/bin/jintia.js" behavior eval --output semanas/semana-03/guide.json

# Evaluar contra un spec específico
ANTHROPIC_API_KEY=sk-... node "<skill-root>/bin/jintia.js" behavior eval \
  --output semanas/semana-03/guide.json --spec BHV-SEM-002
```

### Contratos semánticos

| ID | Nombre | Qué evalúa |
|---|---|---|
| BHV-SEM-001 | notebook-first-fallback | El agente sigue NotebookLM → local → ai-fallback sin detenerse ni saltarse pasos |
| BHV-SEM-002 | no-invented-references | El agente no inventa autores, años ni títulos |
| BHV-SEM-003 | outcome-preserved | El RA del sílabo se copia textualmente, sin parafrasearlo |
| BHV-SEM-004 | visual-by-cognitive-function | Las figuras se eligen por función cognitiva, no decoración |
| BHV-SEM-005 | honest-about-failures | El agente reporta fallos reales, no afirma éxito falso |
| BHV-SEM-006 | three-notebook-attempts | Los 3 intentos NotebookLM son estructurados, no llamadas idénticas |
| BHV-SEM-007 | no-local-fallback-while-notebook-available | Una respuesta insuficiente de NotebookLM no activa el fallback local |
| BHV-SEM-008 | ai-fallback-declared | Todo contenido con `ai-fallback` lo declara y nunca fabrica bibliografía |
| BHV-SEM-009 | target-coverage | Ningún target se evalúa sin haberse enseñado y practicado antes, en orden |
| BHV-SEM-010 | guided-practice-self-correction | Toda práctica guiada tiene modelo trabajado y autocorrección real |
| BHV-SEM-011 | workload-contract | La carga horaria planificada es plausible, no solo numéricamente ajustada |
| BHV-SEM-012 | apa-publish | El material final pasó `compile --publish` sin degradación bibliográfica |

## Flujo de verificación recomendado

```bash
jintia validate  guide.json        # esquema + reglas pedagógicas
jintia behavior  guide.json        # contratos de comportamiento determinísticos
jintia behavior  guide.json --strict  # falla también en inconclusos
```

Añadir el eval semántico en revisiones de entregables importantes:

```bash
ANTHROPIC_API_KEY=... jintia behavior eval --output guide.json
```
