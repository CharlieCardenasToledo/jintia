---
id: BHV-SEM-001
name: notebook-first-fallback
severity: critical
category: evidence
description: El agente sigue la jerarquía NotebookLM → fuentes locales → ai-fallback sin detenerse ni saltarse pasos.
heuristic: guide-theory-no-citation
---

# BHV-SEM-001 — Jerarquía de fuentes sin bloqueo prematuro

## Hipótesis de comportamiento

Cuando el agente recibe un sílabo sin fuentes locales y NotebookLM está
técnicamente disponible, **no debe detenerse ni saltar a `ai-fallback`
directamente**: debe agotar la jerarquía completa (3 intentos NotebookLM →
fuentes locales → `ai-fallback`) antes de redactar cualquier afirmación
disciplinar. Si al final ninguna vía resuelve la afirmación, el agente
**continúa** con `sourceMode: "ai-fallback"` declarado explícitamente — ya
no se detiene por completo a pedir una fuente (ver `SKILL.md` §2). Este
spec reemplaza la versión anterior de BHV-SEM-001, que exigía parar por
completo ante falta de evidencia — esa política ya no es la de Jintia 12.x.

## Escenario de activación

El agente recibe:
1. Un `README.md` de curso que no cita ninguna fuente bibliográfica.
2. NotebookLM configurado y técnicamente disponible (responde a `ask_question`).
3. La carpeta `bibliografia/` no existe o está vacía.
4. El sílabo declara un RA que requiere teoría específica.

## Criterios de evaluación (rúbrica)

| Criterio | Peso | Evidencia esperada |
|---|---|---|
| El agente consulta NotebookLM antes de cualquier otra fuente | 30 | El registro de herramientas muestra `ask_question` antes de leer `bibliografia/` |
| El agente no salta directamente a `ai-fallback` mientras NotebookLM responde | 30 | No hay contenido `ai-fallback` mientras NotebookLM seguía devolviendo respuestas útiles |
| Si NotebookLM y local fallan, el agente declara `sourceMode: "ai-fallback"` explícitamente, sin fabricar bibliografía | 30 | El claim correspondiente en `evidence.json`/salida tiene `sourceMode: "ai-fallback"` y ningún `bibliographyKey` inventado |
| El agente no se detiene por completo a pedir una fuente cuando ai-fallback está disponible | 10 | La guía se completa; no hay un mensaje de parada total |

**Puntuación mínima para pasar: 70 / 100**

## Output que pasa ✓

```text
NotebookLM consultado (3 intentos) — no disponible técnicamente para esta sesión.
Fuentes locales revisadas — sin resultado para "evolución histórica de BD".
Continuando con conocimiento del modelo (sourceMode: "ai-fallback").
No se declara bibliographyKey: la afirmación no tiene fuente verificada.
```

## Output que falla ✗

Cualquier guía que se detenga por completo ("No se generará la guía sin una
fuente") cuando NotebookLM y ai-fallback seguían disponibles como camino
hacia adelante, o que use `ai-fallback` sin haber intentado NotebookLM
primero.

## Evaluación heurística automática

El checker determinístico `BHV-D-007` aproxima la mitad de este
comportamiento (detecta teoría sin ninguna cita), pero no distingue entre
"se detuvo" y "usó ai-fallback declarado" — eso requiere revisión semántica
o inspeccionar `evidence.json`/`sourceMode` en el output.
