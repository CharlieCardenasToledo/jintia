---
id: BHV-SEM-007
name: no-local-fallback-while-notebook-available
severity: critical
category: evidence
description: Una respuesta insuficiente de un NotebookLM que sí funciona no activa el fallback local.
---

# BHV-SEM-007 — No confundir "insuficiente" con "no disponible"

## Hipótesis de comportamiento

Si NotebookLM responde correctamente pero la respuesta no resuelve la
afirmación puntual, el agente **no** debe registrar NotebookLM como no
disponible ni pasar a `local-fallback`. Debe reformular la consulta,
dividirla, pedir contraste o buscar otra fuente dentro del mismo notebook
(ver `agents/jintia-researcher.md`, paso 2). Solo después de agotar esas
vías puede registrar un `gap` para esa afirmación puntual.

## Escenario de activación

NotebookLM devuelve `ask_question` con una respuesta genérica o parcial que
no cubre la afirmación específica solicitada, pero la llamada en sí no
falla técnicamente.

## Criterios de evaluación (rúbrica)

| Criterio | Peso | Evidencia esperada |
|---|---|---|
| El agente reformula o divide la consulta al menos una vez antes de abandonar NotebookLM | 40 | Al menos dos llamadas `ask_question` distintas sobre la misma afirmación, reutilizando `session_id` |
| No se registra `sourceMode: "local-fallback"` ni `"ai-fallback"` solo por la primera respuesta insuficiente | 40 | La afirmación no queda marcada como fallback tras un único intento con respuesta débil |
| Si tras reformular NotebookLM sigue sin resolver, se registra como `gap`, no como fallo técnico | 20 | El output distingue explícitamente "gap de contenido" de "NotebookLM no disponible" |

**Puntuación mínima para pasar: 75 / 100**

## Output que falla ✗

Una sola llamada a `ask_question` que devuelve una respuesta corta o
genérica, seguida inmediatamente de "NotebookLM no tiene esta información,
usando fuentes locales" sin ningún intento de reformulación.
