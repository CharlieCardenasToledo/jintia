# Generar una guía semanal

Este es el documento canónico del flujo semanal completo de Jintia 12.4. El
resto de la documentación (`getting-started.md`, `create-first-course.md`,
`SKILL.md`, `skill/commands/*.md`) enlaza aquí en vez de repetir estos pasos
— si otro documento parece contradecir esta secuencia, este archivo gana.

```text
README.md (sílabo)
  ↓
jintia plan  →  targets + alignmentMatrix + workloadBudget + assessmentContract
  ↓
Evidencia: NotebookLM (3 intentos) → fuente local → ai-fallback (declarado)
  ↓
jintia plan approve
  ↓
guide.json + evidence.json
  ↓
jintia guide finalize
  ↓
jintia ready  (validate --publish → provenance → bibliografía → render → html-lint → preflight → compile)
  ↓
agents/jintia-selfstudy-reviewer.md → PASS
  ↓
agents/jintia-finish-reviewer.md → ready
```

Cada paso se puede invocar desde Claude Code (`/jintia-skill`), Codex/ChatGPT
(`$jintia-skill`) o directamente por CLI (`jintia`).

---

## 1. Planificar antes de escribir

Nada se redacta sin un plan aprobado. El plan descompone el resultado de
aprendizaje del sílabo en `targets` (verbo + descripción) y completa, por
cada uno, las cinco columnas de la matriz de alineación: enseñanza, práctica,
feedback, evaluación, evidencia.

```
/jintia-skill planifica la semana 3
```

o directamente por CLI, guardando el plan como JSON (ver
[`skill/commands/plan.md`](../skill/commands/plan.md) para el esquema
completo, incluidos `workloadBudget` y `assessmentContract`):

```bash
npx @charlie.act7/jintia plan save . 03 --file plan-03.json
```

Muestra el plan al usuario y espera aprobación explícita antes de continuar.

## 2. Resolver la evidencia (NotebookLM-first)

Jerarquía única, sin excepciones silenciosas:

```text
NotebookLM (hasta 3 intentos estructurados)
  ↓ agotados sin éxito
fuente local verificable (recortes, bibliografía, reference.bib)
  ↓ ninguna disponible
ai-fallback (conocimiento del modelo, último recurso, nunca fabrica bibliografía)
```

Cada afirmación disciplinar central (keyClaim) queda registrada con su
`sourceMode` declarado explícitamente — nunca se presenta conocimiento
genérico como si fuera evidencia verificada. Ver
[`docs/notebooklm.md`](notebooklm.md) para el detalle de la política y los
códigos `JIN-EVD-*` asociados.

## 3. Aprobar el plan

```bash
npx @charlie.act7/jintia plan approve . 03
```

Bloquea (`JIN-PLN-001..004`) si `targets`, la matriz de alineación, el
presupuesto de horas (`workloadBudget`) o el contrato de evaluación
(`assessmentContract`, cuando el sílabo declara actividades calificadas)
están incompletos. El escape explícito es `"legacy": true` en el plan — no
la ausencia silenciosa de `targets`.

## 4. Redactar `guide.json` y `evidence.json`

La fuente canónica de cada guía es `semanas/semana-03/guide.json`. Estructura
mínima recomendada (ver [`skill/commands/guide.md`](../skill/commands/guide.md)
para el ejemplo completo):

```json
{
  "metadata": {
    "course": "IFT200", "week": 3, "topic": "Modelo Entidad-Relación",
    "outcome": "El estudiante diseña un MER para un dominio de negocio real.",
    "hours": 4, "theme": "jintia-tecnico", "bibliography": "reference.bib", "citationStyle": "apa",
    "targets": [{ "id": "T1", "verb": "diseñar", "description": "Diseñar un MER para un dominio real." }]
  },
  "sections": [
    { "type": "orientation", "id": "o", "route": ["Teoría", "Práctica", "Evaluación"], "purpose": "...", "materials": ["..."], "successCriteria": ["..."], "estimatedMinutes": 15 },
    { "type": "theory",      "id": "t", "targetIds": ["T1"], "claimIds": ["CLM-001"], "content": "... {{cite:clave}}", "estimatedMinutes": 60 },
    { "type": "practice",    "id": "p", "mode": "guided", "targetIds": ["T1"], "workedExample": "...", "prompt": "...", "steps": ["...", "..."], "successCriteria": ["..."], "selfCheck": "...", "remediation": "...", "estimatedMinutes": 40 },
    { "type": "assessment",  "id": "e", "targetIds": ["T1"], "product": "...", "criteria": [{ "description": "...", "weight": 100 }], "estimatedMinutes": 20 },
    { "type": "bibliography","id": "refs" }
  ]
}
```

Junto a `guide.json`, `evidence.json` registra un keyClaim por cada
`claimIds` usado, con `sourceMode`, `bibliographyKey` y `targetId` (obligatorio
en publish: todo target debe tener al menos un keyClaim que lo sustente).

Escríbelo mediante:

```bash
npx @charlie.act7/jintia guide create   . 03 --input draft.json
npx @charlie.act7/jintia guide finalize . 03
```

`guide create` exige plan aprobado y compuerta de evidencia permitida;
`guide finalize` valida y marca el plan como `generated`.

> **Temas disponibles:** `jintia-clasico`, `jintia-tecnico` (A4),
> `jintia-cuaderno` (A5). Consulta [Temas HTML](./templates.md).

## 5. Cerrar la publicación con `jintia ready`

```bash
npx @charlie.act7/jintia ready semanas/semana-03/guide.json
```

Corre en cadena, deteniéndose en el primer paso bloqueante:

```text
validate --publish → evidencia (provenance) → bibliografía (pre-render)
  → render → html-lint → bibliografía (post-render) → preflight
  → compile (PDF)
```

Decisiones posibles: `READY` (todo, incluido el PDF), `PRECHECK_READY` (todo
excepto el PDF, con `--skip-pdf`), `NEEDS_CHANGES` (advertencias sin
bloqueo), `BLOCKED` (algún paso falló, incluido Vivliostyle ausente sin
`--skip-pdf`). Ver [`skill/commands/ready.md`](../skill/commands/ready.md).

## 6. Revisión de agente (necesaria, no sustituible por script)

`DETERMINISTIC DECISION: READY` es una condición necesaria pero no
suficiente. Antes de compartir el material, confirma por separado:

1. [`agents/jintia-selfstudy-reviewer.md`](../skill/agents/jintia-selfstudy-reviewer.md) → decisión `PASS` (prueba "estudiante sin profesor").
2. [`agents/jintia-finish-reviewer.md`](../skill/agents/jintia-finish-reviewer.md) → decisión `ready`, incorporando el `PASS` anterior.

Solo cuando las tres señales coinciden (`jintia ready` + selfstudy + finish
reviewer) la guía está lista para publicarse.

---

## Estructura de archivos generados

```text
semanas/semana-03/
├── guide.json          ← fuente canónica (editable)
├── evidence.json        ← procedencia por afirmación disciplinar
├── reference.bib        ← bibliografía de la semana
├── guide.html           ← HTML renderizado (jintia render / ready)
├── guide.pdf             ← PDF final (jintia compile / ready)
└── figure/               ← imágenes del pipeline visual
```
