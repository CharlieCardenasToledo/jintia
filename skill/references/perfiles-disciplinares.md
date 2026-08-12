# Perfiles disciplinares visuales

Leer únicamente el perfil relacionado con la asignatura. Estas reglas
complementan, pero no reemplazan, la selección por operación cognitiva.

| Perfil | Representaciones prioritarias | Restricciones |
|---|---|---|
| Salud | anatomía anotada, flujo clínico, curva, tabla diagnóstica | Usar imágenes verificables; no inventar signos clínicos |
| Ciencias naturales | estructura, ciclo, taxonomía, serie experimental | Distinguir observación de modelo |
| Matemáticas y estadística | ecuación, función, distribución, simulación | Mostrar escala, dominio, unidades y supuestos |
| Ingeniería | circuito, esquema, arquitectura, señal, procedimiento | Usar notación normalizada y unidades |
| Economía y administración | serie, distribución, flujo, matriz, red | No truncar ejes ni ocultar base o moneda |
| Ciencias sociales | red, cronología, mapa, causalidad, comparación | Diferenciar asociación, mecanismo e inferencia causal |
| Derecho | árbol normativo, línea procesal, matriz de precedentes | Conservar jurisdicción, vigencia y jerarquía |
| Educación | alineación, secuencia, rúbrica, mapa conceptual | Vincular representación con evidencia de aprendizaje |
| Humanidades | cronología, red de personajes, mapa, edición anotada | Usar reproducciones con procedencia |
| Arte y diseño | composición, comparación, proceso, obra anotada | No sustituir la obra o pieza real por una recreación |
| Investigación | flujo metodológico, DAG, tabla de variables, forest plot | Declarar población, medición, incertidumbre y fuente |

## Motores formales

- Usar `chemfig` y `mhchem` en química.
- Usar RDKit desde `model.smiles` para representaciones moleculares
  reproducibles; no usarlo como sustituto de fotografías o micrografías.
- Usar `circuitikz` en circuitos eléctricos.
- Usar `wavedrom` en señales digitales.
- Usar forest plots Vega-Lite para estimaciones con intervalos.
- Usar GeoJSON verificable y `valueField` explícito para mapas coropléticos.
- Usar DAGitty o una representación DAG equivalente para causalidad.
- Usar Forest para jerarquías lingüísticas o filogenéticas pequeñas.
- Usar PlantUML cuando la notación UML sea evaluada.

No degradar a un motor semánticamente más débil cuando la notación formal sea
parte del criterio de evaluación. Detener el renderizado y declarar la
dependencia ausente.
# Matriz del motor editorial

Arquitecturas conceptuales, flujos clínicos, mapas conceptuales y diagramas técnicos genéricos pequeños usan `editorial-svg`. UML/C4 usa PlantUML, circuitos CircuitikZ, señales WaveDrom, química formal RDKit/Chemfig y resultados cuantitativos Vega-Lite. La selección es semántica, no un motor por carrera.
