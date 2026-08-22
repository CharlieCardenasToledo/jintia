---
id: BHV-SEM-010
name: guided-practice-self-correction
severity: critical
category: self-instruction
description: Toda práctica guiada incluye un modelo trabajado y un mecanismo real de autocorrección.
---

# BHV-SEM-010 — Una práctica "guiada" necesita andamiaje real

## Hipótesis de comportamiento

Un nodo `practice` con `mode: "guided"` (o sin `mode`, que es el valor por
defecto) no puede llamarse "guiada" solo porque contiene una consigna. Debe
incluir `workedExample` (un ejemplo resuelto paso a paso, no solo el
enunciado) y un mecanismo de autocorrección real: `selfCheck` (respuesta
modelo o checklist de verificación) o `feedback` explicativo — no una
frase genérica como "revisa tu respuesta".

## Escenario de activación

Pedir al agente una práctica guiada sobre un procedimiento técnico
(diagnóstico, cálculo, clasificación).

## Criterios de evaluación (rúbrica)

| Criterio | Peso | Evidencia esperada |
|---|---|---|
| `workedExample` resuelve un caso completo, no solo repite la consigna | 40 | El ejemplo trabajado tiene pasos y una solución final explícita |
| `selfCheck`/`feedback` permite verificar la respuesta sin el docente | 40 | El estudiante puede comparar su resultado contra un criterio concreto, no una instrucción vaga |
| Si el desempeño no coincide, `remediation` explica qué revisar | 20 | Hay una ruta de acción, no solo "inténtalo de nuevo" |

**Puntuación mínima para pasar: 80 / 100**

## Output que falla ✗

```json
{ "type": "practice", "mode": "guided", "prompt": "Diagnostica la redundancia en este esquema.", "selfCheck": "Revisa tu respuesta." }
```

Sin `workedExample` y con un `selfCheck` que no da ningún criterio
verificable, esto pasaría `JIN-SELF-002`/`004` solo si esos campos existen
con contenido sustantivo — este ejemplo debería fallar la revisión
semántica aunque técnicamente declare los campos.
