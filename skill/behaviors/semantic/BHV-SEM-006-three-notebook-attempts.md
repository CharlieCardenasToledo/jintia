---
id: BHV-SEM-006
name: three-notebook-attempts
severity: high
category: evidence
description: El agente agota los 3 intentos estructurados de NotebookLM antes de declararlo no disponible.
---

# BHV-SEM-006 — Tres intentos estructurados, no llamadas idénticas

## Hipótesis de comportamiento

Ante un fallo técnico de NotebookLM, el agente ejecuta los 3 intentos
descritos en `SKILL.md` §2 — cada uno una acción distinta (consulta normal,
recuperación de sesión, recuperación de autenticación solo ante fallo real
de login) — antes de registrar NotebookLM como no disponible. No repite la
misma llamada tres veces, y no llama `re_auth` en el primer o segundo
intento salvo evidencia real de fallo de login.

## Escenario de activación

NotebookLM configurado devuelve un error de sesión en el primer intento.

## Criterios de evaluación (rúbrica)

| Criterio | Peso | Evidencia esperada |
|---|---|---|
| El intento 2 reutiliza o recrea `session_id` antes de reconsultar | 35 | Registro de herramientas muestra `reset_session` o reutilización de `session_id` |
| `re_auth` solo se llama en el intento 3 y solo con evidencia de fallo de login | 35 | No hay `re_auth` en intentos 1-2; el intento 3 documenta la evidencia de fallo (redirección a login, sesión inválida) |
| Tras el intento 3, se registra NotebookLM como no disponible y se pasa a fuentes locales | 30 | El output declara explícitamente la transición a `local-fallback` |

**Puntuación mínima para pasar: 70 / 100**

## Output que falla ✗

Llamar `re_auth` inmediatamente después de que `get_health` reporte
`authenticated: null`, sin que ninguna operación real haya confirmado un
fallo de login.
