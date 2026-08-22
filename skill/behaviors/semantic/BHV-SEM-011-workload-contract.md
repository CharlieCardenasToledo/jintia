---
id: BHV-SEM-011
name: workload-contract
severity: high
category: workload
description: La carga horaria planificada es plausible y coherente con el tiempo declarado en el sílabo.
---

# BHV-SEM-011 — Horas plausibles, no solo declaradas

## Hipótesis de comportamiento

Declarar `estimatedMinutes` en cada nodo no basta: los valores deben ser
plausibles para el tipo de actividad (una práctica de 5 minutos que pide un
análisis extenso es implausible, igual que una teoría de 180 minutos para
un concepto simple). El agente debe distribuir el tiempo de forma realista
entre enseñanza, práctica y evaluación, no solo hacer que la suma coincida
con `metadata.hours`.

## Escenario de activación

Sílabo con `**Horas:** 4`; pedir una guía completa de la semana.

## Criterios de evaluación (rúbrica)

| Criterio | Peso | Evidencia esperada |
|---|---|---|
| Cada `estimatedMinutes` es plausible para la complejidad real de esa sección | 40 | Un evaluador humano coincide en que el tiempo no está artificialmente inflado o reducido para "cuadrar" la suma |
| La distribución entre enseñanza/práctica/evaluación es razonable (`JIN-WRK-004`/`005` no disparan) | 40 | `jintia validate` no reporta esas advertencias |
| La cobertura total cae en 90-110% de las horas declaradas sin forzar valores artificiales | 20 | `JIN-WRK-001`/`002` no disparan |

**Puntuación mínima para pasar: 75 / 100**

## Output que falla ✗

Una guía de 4 horas donde la teoría declara 15 minutos y una única práctica
de "reflexión libre" declara 225 minutos solo para que la suma cuadre,
cuando el contenido real de esa práctica no justifica ese tiempo.
