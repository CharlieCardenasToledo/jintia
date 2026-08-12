# Adaptación de Diagram Design

Jintia adapta la gramática editorial de `cathrynlavery/diagram-design` en la revisión `3c5c34ba3bf9dcf204b55c2dd613f8fa194cf584` (licencia MIT).

La adaptación es un motor interno `editorial-svg`; no instala ni ejecuta la Skill upstream y no tiene dependencia de red, navegador, Python ni subprocess. Jintia conserva la autoridad de selección, los tokens visuales locales y todos los motores formales disciplinares.

El motor cubre inicialmente flowchart, concept-map, technical-diagram, argument-map, curriculum-map y timeline no cuantitativo. Rechaza modelos de más de 12 nodos, 16 edges, cuatro niveles, riesgo de cruces alto, etiquetas no representables o más de dos focos.

El SVG es accesible, autosuficiente, escapado, determinista y usa rejilla de 4 px con conectores ortogonales. La licencia viaja en el paquete npm junto al adaptador.
