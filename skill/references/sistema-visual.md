# Sistema visual neutral

Leer esta referencia cuando una guía requiera gráficos, mapas, diagramas,
interfaces, imágenes anotadas o notación disciplinar.

## Decidir antes de renderizar

1. Precisar la operación cognitiva: identificar, clasificar, comparar,
   secuenciar, relacionar, jerarquizar, cuantificar, localizar, explicar
   causalidad, simular o argumentar.
2. Modelar los datos, entidades, relaciones, tiempo o espacio.
3. Elegir la representación. No elegir el motor por la plantilla.
4. Elegir el motor por precisión, complejidad, notación, accesibilidad y
   reproducibilidad.
5. Crear `figure/specs/fig-id.json` conforme a
   `schemas/visual-spec.schema.json`.
6. Ejecutar `node "<skill-root>/scripts/visual-renderer.js" --spec <spec> --template
   <activeTemplate>`.
7. Comprobar el archivo renderizado y `figure/manifest.json`.

Un JSON válido también es YAML válido. Preferir JSON para no exigir un parser
adicional.

Usar `model` en lugar de código cuando la figura sea una red, flujo, diagrama
D2, gráfico de barras o estructura química RDKit. El renderizador genera una
fuente compatible con el motor disponible y puede aplicar un fallback sin
reinterpretar código ajeno. Usar `source` para notaciones que todavía no tengan
generador neutral.

## Selección inicial

| Necesidad | Representación | Motor preferido |
|---|---|---|
| Magnitud, distribución o tendencia | gráfico | Vega-Lite |
| Estimación e incertidumbre | forest plot | Vega-Lite |
| Relación entre entidades | red | Graphviz |
| Proceso corto o decisión | flujo | Mermaid |
| Arquitectura o UML formal | diagrama técnico | PlantUML |
| Jerarquía o layout declarativo | diagrama | D2 |
| Cronología | línea temporal | D2 |
| Señal digital | diagrama temporal | WaveDrom |
| Interfaz reconocible | mock-up | HTML/CSS local |
| Fórmula o diagrama pequeño integrado | figura LaTeX | TikZ |
| Territorio | mapa | GeoPandas |
| Química | notación disciplinar | mhchem/chemfig |
| Electrónica | notación disciplinar | Circuitikz |

No sustituir fotografías clínicas, radiografías, obras, manuscritos, mapas
históricos, micrografías o piezas existentes por dibujos inventados. Usar una
fuente verificable y registrar procedencia y licencia.

## Estructura por guía

```text
figure/
├── specs/
├── data/
├── sources/
├── rendered/
├── previews/
└── manifest.json
```

Conservar fuentes editables y datos. Usar PDF para vectores y PNG para
fotografías o capturas. Conservar SVG como fuente o intermedio.

## Accesibilidad y honestidad

- Escribir `altText` que exprese el patrón o relación relevante.
- Añadir `longDescription` cuando la figura sea compleja.
- Asociar `dataTable` a toda visualización cuantitativa.
  Si la especificación contiene `model.categories` y `model.values`, el
  renderizador genera automáticamente `figure/data/fig-id.csv`.
  También genera CSV para `model.estimates` y mapas GeoJSON con
  `model.valueField`.
- No depender solo del color; combinar etiquetas, formas o tipos de línea.
- Declarar `palette.foreground` y `palette.background` cuando exista texto
  renderizado; el linter exige contraste mínimo 4.5:1.
- Registrar fuente, licencia y procedencia.
- No truncar ejes ni usar 3D, doble eje, pastel o radar sin justificación.
- Registrar todo fallback. No afirmar que una figura se renderizó si el motor
  no está disponible.

## Adaptación editorial

Usar siempre:

```latex
\begin{guidefigure}[placement=auto]
\centering
\includegraphics[width=\linewidth]{figure/rendered/fig-id.pdf}
\guidefigurecaption{Descripción.}{fig:id}
\end{guidefigure}
```

`main`, `wide` y `margin` son decisiones de colocación. ElegantBook normaliza
las tres a su flujo principal. Kaohandt cambia temporalmente a layout ancho o
usa `marginfigure`; reservar `margin` para contenido complementario y breve.
Mantener resultados, instrucciones y criterios en el flujo principal.

## Figuras progresivas

Definir `model.stages` con identificador, etiqueta y `nodeIds`. Ejecutar:

```text
node "<skill-root>/scripts/visual-progressive.js" --spec figure/specs/fig-id.json --render
```

Cada etapa acumula los nodos y relaciones anteriores, recibe un identificador
estable y se registra como figura independiente. Usar esta modalidad solo
cuando revelar toda la estructura a la vez aumente innecesariamente la carga
cognitiva.

## Contratos de motores ejecutables

- HTML debe ser autosuficiente, sin CDN. Chrome genera un PNG con viewport fijo.
- Matplotlib y GeoPandas deben escribir el archivo indicado por
  `JINTIA_VISUAL_OUTPUT` y respetar `JINTIA_VISUAL_FORMAT`.
- RDKit acepta `model.smiles`, genera SVG y requiere el módulo local `rdkit`.
- TikZ, Circuitikz, Chemfig y Forest deben proporcionar un documento
  `standalone` completo.
- Ejecutar `visual-capabilities.js` antes de planificar un lote grande.
- No aplicar fallback cuando `formalNotationRequired` sea verdadero.
- Ejecutar pruebas con motores reales mediante
  `JINTIA_REAL_RENDER_TESTS=1 npm test`; mantenerlas opt-in porque Chrome y
  otros procesos gráficos pueden ser inestables en CI o sandboxes.
- Ejecutar `visual-inspector.js figure/manifest.json` después del renderizado.
  El inspector usa `pdftoppm` o Inkscape cuando están disponibles para crear
  previsualizaciones PNG; si no, registra la limitación sin inventar el archivo.
- Crear un baseline solo después de revisión humana con
  `visual-regression.js figure/manifest.json --update`. Las ejecuciones
  posteriores sin `--update` deben fallar ante figuras nuevas, ausentes o
  modificadas.
- Usar `--mode perceptual --threshold 0.01` para tolerar hasta 1 % de píxeles
  materialmente distintos. Revisar las imágenes generadas en `figure/diffs/`
  antes de aceptar un nuevo baseline.
- El linter inspecciona `viewBox`, tamaño de texto, recursos externos,
  animaciones, densidad de relaciones y etiquetas extensas. Tratar sus
  advertencias como señales para dividir o simplificar la figura.
# Selección editorial SVG

Si la apariencia o notación es evidencia formal, se usa el motor disciplinar. Si es una representación editorial soportada y permanece dentro de 12 nodos, 16 aristas, cuatro niveles y riesgo bajo, se usa `editorial-svg`; si no, se conserva el motor especializado existente. El motor interno es autosuficiente, accesible y determinista.
