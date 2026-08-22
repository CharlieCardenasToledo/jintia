# Operación `plan`

| Entorno | Invocación |
|---|---|
| Claude Code | `/jintia-skill` |
| Codex / OpenAI | `$jintia-skill` |
| CLI directa | `jintia plan save` / `jintia plan approve` |

Planifica una semana instruccional antes de escribir cualquier archivo.
El plan es un paso técnico obligatorio: `guide` no puede ejecutarse sin un plan aprobado.

## Cuándo usar este playbook

Cuando el usuario pide planificar una semana: `/jintia-skill planifica la semana N` (Claude Code) o `$jintia-skill planifica la semana N` (Codex).

## Precondiciones

1. `README.md` existe y pasa `jintia syllabus validate`.
2. La semana solicitada existe en el sílabo (no se inventa).
3. La compuerta de evidencia se verificó: `jintia evidence check <curso> <semana>`.

Si alguna precondición falla, informar claramente y detener.

## Lo que hace `plan`

1. Extraer el contrato semanal del sílabo (tema, resultado, actividades, horas).
2. Verificar NotebookLM según el flujo de `references/bibliografia.md`.
3. Identificar evidencia disponible (verificada) y evidencia faltante.
4. Mostrar el plan al usuario para aprobación.
5. Guardar el plan: `jintia plan save <curso> <semana>`.
6. Esperar aprobación explícita del usuario.
7. Después de aprobación: `jintia plan approve <curso> <semana>`.

## Lo que `plan` NO hace

- NO crea archivos de guía (`guide.json`, `reference.bib`).
- NO genera contenido académico.
- NO inventa semanas que no estén en el sílabo.
- NO continúa si la evidencia está bloqueada.

## Salida normalizada del plan

```json
{
  "course": "CC05A_IFT200",
  "week": 1,
  "topic": "Introducción a bases de datos",
  "outcomes": {
    "teaching": "Diferenciar el enfoque de bases de datos...",
    "practice": "Diagnosticar redundancia...",
    "autonomous": "Investigar la evolución..."
  },
  "targets": [
    { "id": "T1", "verb": "diferenciar", "description": "Diferenciar el enfoque de BD frente a archivos." }
  ],
  "alignmentMatrix": [
    { "targetId": "T1", "teaching": true, "practice": true, "feedback": true, "assessment": true, "evidence": true }
  ],
  "workloadBudget": { "declaredMinutes": 240, "plannedMinutes": 235 },
  "assessmentContract": [
    { "code": "PE-1.1", "targetIds": ["T1"], "product": "Informe diagnóstico", "points": 2.25 }
  ],
  "evidence": [
    {
      "source": "Beynon-Davies (2018)",
      "status": "verified",
      "location": "bibliografia/beynon-davies.pdf"
    }
  ],
  "missingEvidence": [
    "Material ASU IFT-200 Module 1"
  ],
  "provenance": "notebook-primary",
  "plannedFiles": [
    "semanas/semana-01/guide.json",
    "semanas/semana-01/evidence.json",
    "semanas/semana-01/reference.bib",
    "semanas/semana-01/figure/"
  ],
  "status": "pending"
}
```

`targets`/`alignmentMatrix`/`workloadBudget`/`assessmentContract` son el
contrato pedagógico previo a la redacción: **antes de escribir contenido**,
descomponer el RA en targets y completar, por cada uno, las cinco columnas
de la matriz (enseñanza, práctica, feedback, evaluación, evidencia).

Este contrato es **obligatorio** para todo plan nuevo. `jintia plan approve`
bloquea si falta cualquiera de estas piezas:

```text
JIN-PLN-001  targets ausentes o vacíos
JIN-PLN-002  alignmentMatrix incompleta (falta alguna de las 5 dimensiones)
JIN-PLN-003  workloadBudget ausente o fuera del rango 70-130% (declaredMinutes vs. plannedMinutes)
JIN-PLN-004  assessmentContract no cubre las actividades calificadas del sílabo, o sus 'points' no coinciden
```

`JIN-PLN-004` solo se evalúa cuando el sílabo declara actividades calificadas
en un formato reconocible (ver `parseGradedActivities` en
`runtime/core/syllabus-manager.js`); si el sílabo usa un formato distinto, no
se fuerza el cruce.

**Excepción explícita — `legacy: true`.** Un plan que declara `"legacy":
true` en su JSON queda exento de `JIN-PLN-001..004`: solo se usa para planes
que deliberadamente no adoptan este contrato todavía. No es un opt-in
silencioso por ausencia de `targets` — debe declararse a propósito. Si un
plan `legacy: true` igualmente incluye `targets`, la matriz de alineación
sigue exigiéndose completa para esos targets.

## Estados del plan

| Estado | Significado |
|---|---|
| `pending`   | Plan calculado, esperando aprobación del usuario. Incluye planes con procedencia `ai-fallback`: la ausencia de fuentes externas ya no bloquea por sí sola. |
| `blocked`   | Contrato curricular irresoluble: semana o resultado de aprendizaje inexistente en el sílabo, o sílabo inconsistente (verificado en `plan approve`). **No** se usa por falta de evidencia externa. |
| `approved`  | Usuario aprobó el plan; se puede generar guide.json |
| `generated` | guide.json fue creado con éxito |

## Flujo ante NotebookLM no disponible

Jerarquía única (fuente de verdad: `SKILL.md` §2): NotebookLM (3 intentos) →
fuentes locales → conocimiento del modelo (`ai-fallback`, ya no bloquea).

**Distinción obligatoria, no confundir:**

- **NotebookLM técnicamente no disponible** (no responde, sesión rota, fallo
  de autenticación real): dispara la cadena de 3 intentos de abajo. Solo
  cuando los 3 intentos se agotan se pasa a fuentes locales.
- **NotebookLM responde pero la respuesta no resuelve la pregunta**: esto
  **no** es indisponibilidad y **no** activa el fallback local. El
  investigador debe seguir preguntando dentro del mismo notebook —
  reformular, dividir la consulta, pedir contraste, buscar otra fuente
  dentro del notebook — antes de considerar la afirmación sin respaldo. Ver
  `agents/jintia-researcher.md` para el procedimiento de reformulación.

```
intento 1: resolver notebook + ask_question
↓ falla
intento 2: reutilizar/recrear session_id + reconsultar
↓ falla
intento 3: re_auth SOLO si hay evidencia real de fallo de login + reconsultar
↓ falla
registrar NotebookLM como no disponible (temporal)
↓
revisar fuentes locales (recortes, bibliografía, reference.bib)
↓
si hay fuente local → continuar con procedencia "local-fallback"
↓ si ninguna fuente local
continuar con procedencia "ai-fallback" (JIN-EVD-001 / JIN-EVD-003, advertencia)
nunca fabricar autor, obra, año, página o DOI en este modo
```

Código JIN-EVD-002 (bloquea) si el agente presenta conocimiento genérico como
evidencia verificada sin declarar la procedencia `ai-fallback`.

**Trazabilidad de los 3 intentos (opcional, recomendado).** `evidence-gate.js
check()` acepta `notebookLM.attempts` (`[{ attempt, result, reAuth? }]`) y
`notebookLM.fallbackReason`; si se declaran, el resultado incluye
`notebookResolution` y `jintia plan save` lo persiste en el plan. Sin esto,
`local-fallback` con NotebookLM configurado emite `JIN-EVD-028` (advertencia):
la política de 3 intentos queda declarada pero no demostrada.

## Uso determinista (CLI)

```bash
# Guardar plan desde JSON
node "<skill-root>/bin/jintia.js" plan save ./curso 01 --file plan.json

# Aprobar plan (después de que el usuario confirme)
node "<skill-root>/bin/jintia.js" plan approve ./curso 01

# Verificar estado antes de guide
node "<skill-root>/bin/jintia.js" plan check ./curso 01

# Ver detalle del plan
node "<skill-root>/bin/jintia.js" plan status ./curso 01
```

## Siguiente paso

Una vez aprobado (`plan approve`), procede con `commands/guide.md`.
