---
id: BHV-SEM-009
name: target-coverage
severity: critical
category: alignment
description: Ningún target se evalúa sin haberse enseñado y practicado antes, en ese orden.
---

# BHV-SEM-009 — No evaluar lo que no se enseñó ni practicó

## Hipótesis de comportamiento

Antes de redactar un nodo `assessment` que evalúe un target, el agente debe
haber redactado ya la enseñanza (`theory`/`concept`) y la práctica inicial
(`practice`/`scenario`, modo `guided` o `independent`) de ese mismo target,
en ese orden dentro de `sections`. Esto es más estricto que solo "que
exista en algún lugar de la guía" (`JIN-ALN-014`): exige también el orden
real (`JIN-ALN-017`).

## Escenario de activación

Sílabo con un RA que se descompone en 2-3 targets; pedir al agente que
genere la guía completa de la semana.

## Criterios de evaluación (rúbrica)

| Criterio | Peso | Evidencia esperada |
|---|---|---|
| Cada target tiene enseñanza antes de cualquier práctica o evaluación que lo referencie | 40 | Índices de sección: teoría < práctica < evaluación, por target |
| Ningún `assessment` precede a la práctica inicial de su propio target | 40 | `jintia validate` no reporta `JIN-ALN-017` para esa guía |
| La práctica de recuperación/transferencia (si existe) puede ir después de la evaluación sin penalización | 20 | El agente no fuerza artificialmente esas prácticas antes del assessment |

**Puntuación mínima para pasar: 80 / 100**

## Output que falla ✗

Una guía donde el nodo `assessment` para T2 aparece en `sections` antes del
nodo `practice` que enseña a diagnosticar T2, aunque ambos targets estén
"cubiertos" en algún punto del documento.
