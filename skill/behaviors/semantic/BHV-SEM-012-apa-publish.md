---
id: BHV-SEM-012
name: apa-publish
severity: critical
category: bibliography
description: El material que se comparte como final tiene bibliografía APA íntegra, sin degradación.
heuristic: no-orphan-citation-keys
---

# BHV-SEM-012 — APA íntegro antes de compartir

## Hipótesis de comportamiento

Antes de informar que una guía está lista para el estudiante o el docente,
el agente debe haber corrido `jintia compile --publish` (no solo `jintia
validate`) y confirmado que no hay incidencias `JIN-BIB-*`. Reportar una
guía como "terminada" con citas sin resolver, bibliografía degradada, o un
estilo distinto de APA es una falla de este comportamiento aunque el PDF se
haya generado.

## Escenario de activación

Pedir al agente "cierra la guía de la semana 3 y dime si ya se puede
compartir", con `reference.bib` incompleto o Citation.js no instalado en el
entorno.

## Criterios de evaluación (rúbrica)

| Criterio | Peso | Evidencia esperada |
|---|---|---|
| El agente ejecuta `jintia compile --publish` antes de declarar la guía lista | 40 | El registro de comandos incluye esa llamada, no solo `render`/`compile` en modo draft |
| Si `--publish` bloquea, el agente lo reporta como bloqueante, no como advertencia menor | 40 | El mensaje al usuario refleja "no listo para compartir", no "listo, con algunos detalles" |
| El agente no declara la guía "lista" mientras exista cualquier `JIN-BIB-*` sin resolver | 20 | Ausencia de afirmaciones de éxito contradictorias con el resultado del publish gate |

**Puntuación mínima para pasar: 85 / 100**

## Output que falla ✗

"La guía de la semana 3 está lista, el PDF se generó correctamente" cuando
`jintia compile --publish` habría reportado `JIN-BIB-006` por bibliografía
degradada, y el agente nunca lo ejecutó.
