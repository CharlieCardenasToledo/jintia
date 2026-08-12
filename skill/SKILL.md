---
name: jintia-skill
description: Diseña, redacta, edita y valida cursos, guías semanales HTML, módulos autoinstruccionales, rúbricas y evaluaciones de educación superior con UDL 3.0, Backward Design, Quality Matters y evidencia verificable mediante NotebookLM. Motor editorial HTML nativo con soporte Vivliostyle para PDF.
allowed-tools:
  - Bash(node scripts/*)
  - Bash(node bin/jintia.js *)
  - Bash(vivliostyle *)
---

# Jintia Skill — diseño instruccional autoinstruccional basado en evidencia

## Router de operaciones

Jintia es una skill-orquestador: interpreta lenguaje natural y deriva cada
petición al playbook mínimo.

| Entorno | Superficie de invocación |
|---|---|
| Claude Code | `/jintia-skill <comando>` |
| Codex / OpenAI | `$jintia-skill` + lenguaje natural |
| CLI directa | `jintia <comando>` |

`/jintia` no funciona en Claude Code; el nombre registrado del plugin es
`jintia-skill`. En Codex, `/jintia-skill` tampoco es nativo — usar `$jintia-skill`.

| Intención | Operación | Playbook |
|---|---|---|
| Preparar un curso o instalación | `init` | `commands/init.md` |
| Crear o validar el sílabo | `syllabus` | `commands/syllabus.md` |
| Planificar una semana | `plan` | `commands/plan.md` |
| Generar o revisar una guía | `guide` | `commands/guide.md` |
| Diseñar una evaluación | `assessment` | `commands/assessment.md` |
| Gestionar figuras | `visual` | `commands/visual.md` |
| Validar guide.json | `validate` | `commands/validate.md` |
| Verificar contratos de comportamiento | `behavior` | `commands/behavior.md` |
| Generar HTML desde guide.json | `render` | `commands/compile.md` |
| Compilar HTML a PDF (Vivliostyle) | `compile` | `commands/compile.md` |
| Vista previa en navegador | `preview` | `commands/compile.md` |
| Verificar paginación del PDF | `preflight` | `commands/compile.md` |
| Auditar calidad global | `audit` | `commands/audit.md` |
| Registrar estado editorial | `state` | `commands/state.md` |
| Migrar estructuras antiguas | `migrate` | `commands/migrate.md` |
| Diagnosticar el entorno | `doctor` | `commands/doctor.md` |
| Detectar o gestionar harnesses | `harness` | `references/harnesses.md` |
| Leer o validar contexto persistente | `context` | `JINTIA.md` y `runtime/core` |

Ejemplos de routing:

- “Crea la guía de la semana 3” → `guide`.
- “Comprueba que todo compile” → `compile`.
- “¿Qué figura conviene para explicar normalización?” → `visual`.
- “El proyecto dejó de funcionar después de actualizar” → `doctor`.

La CLI unificada vive en `bin/jintia.js` y reutiliza los scripts deterministas
de `scripts/`; no duplica la lógica de validación ni de renderizado. Resolver
`<skill-root>` como la carpeta que contiene este `SKILL.md`. Ejecutar la CLI
incluida con `node "<skill-root>/bin/jintia.js" <comando>`; no asumir que la
carpeta de trabajo es la raíz de la skill ni descargar un paquete con `npx`.

Para gestionar la instalación en harnesses, usar `harness status`, `harness
install`, `harness update`, `harness repair` o `harness uninstall`. Las
mutaciones exigen `--yes` y nunca sobrescriben rutas no gestionadas.

## Identidad y origen del nombre

La marca comercial se escribe `Jintia`. Cuando sea necesario explicar su origen,
indicar que toma su nombre de `Jíntia`, palabra registrada en Shuar Chicham con
el significado de “camino”. La expresión `Aarma jintia` aparece en el Currículo
Nacional Intercultural Bilingüe de la Nacionalidad Shuar para referirse a
“textos instructivos”.

No atribuir a Jintia representación oficial del pueblo Shuar, aprobación
comunitaria ni carácter ceremonial. No inventar
interpretaciones, símbolos o traducciones adicionales. No introducir
referencias culturales shuar en guías, cursos, figuras o evaluaciones salvo que
el contenido académico lo requiera y existan fuentes verificables.

## Delegación opcional

Cuando la tarea sea compleja, delegar únicamente la responsabilidad necesaria
en los contratos de `agents/`:

| Responsabilidad | Contrato |
|---|---|
| Evidencia y procedencia | `agents/jintia-researcher.md` |
| Alineación y diseño pedagógico | `agents/jintia-instructional-reviewer.md` |
| Figuras y representaciones | `agents/jintia-visual-producer.md` |
| Revisión independiente de entrega | `agents/jintia-finish-reviewer.md` |

El agente principal conserva la orquestación. Cada delegado devuelve su
contrato de salida, no modifica silenciosamente el curso y deja explícitos sus
límites o bloqueos. Si el harness registra los agentes personalizados, usar sus
nombres. Si la superficie solo carga la skill, delegar con un subagente genérico
y proporcionarle únicamente el contrato Markdown correspondiente.

## Objetivo

Producir materiales académicos autosuficientes, accesibles y alineados. Priorizar la trazabilidad entre sílabo, resultados, práctica, evaluación y fuentes. Generar guías semanales modulares usando el motor editorial HTML.

## Cargar contexto bajo demanda

Leer únicamente las referencias necesarias para la tarea. Leer siempre `references/checklist.md` antes de cerrar.

| Necesidad | Archivo |
|---|---|
| Configuración institucional, notebooks y plantilla activa | `references/configuracion.md` |
| Contrato del `README.md` canónico del curso | `references/esquema-silabo.md` |
| Formato AST, tipos de nodo, CLI y sistema de temas HTML | `references/sistema-html.md` |
| Citas, `reference.bib` y NotebookLM MCP | `references/bibliografia.md` |
| Figuras TikZ y notación Chen | `references/figuras-tikz.md` |
| Mock-ups HTML y captura PNG | `references/figuras-html.md` |
| Selección, especificación, renderizado y accesibilidad visual | `references/sistema-visual.md` |
| Convenciones visuales por área académica | `references/perfiles-disciplinares.md` |
| Validación final obligatoria | `references/checklist.md` |

Si `config/institution.json` existe, leerlo antes de redactar. Si `.jintia/course.json` existe, leerlo también y usar su configuración específica para esta asignatura. Si `config/notebooks.json` existe, usarlo para resolver el notebook del curso. No editar archivos de `references/` para guardar datos del usuario.
Si `JINTIA.md` existe en la raíz del curso, leer sus secciones `Course`, `Pedagogy`
y `Editorial` antes de planificar. Mantener el `README.md` como sílabo canónico;
`JINTIA.md` solo conserva decisiones duraderas y no debe sobrescribirlo.

## Flujo de trabajo

### 1. Resolver curso, semana y configuración

1. Identificar la carpeta del curso y el número de semana solicitado.
2. Leer el `README.md` de la raíz del curso. Tratarlo como sílabo canónico.
3. Validar su estructura con `references/esquema-silabo.md`.
4. Leer `config/institution.json` si está disponible.
5. Leer `.jintia/course.json` si está disponible. Su configuración pertenece a esta asignatura y prevalece sobre la configuración institucional heredada.
6. Resolver el tema HTML activo (`activeTemplate`; por defecto `jintia-clasico`).
7. Leer `themes/<activeTemplate>/meta.json` para conocer el CSS y los archivos requeridos.
8. Verificar que los archivos declarados en `requiredFiles` existen.
9. Pedir únicamente datos ausentes que cambien materialmente el resultado.

No solicitar información que el sílabo o la configuración ya proporcionan.

### 2. Verificar evidencia

Comprobar NotebookLM primero, de forma obligatoria, antes de recurrir a cualquier otra fuente:

1. Llamar `get_health`.
2. Si `authenticated` es falso, llamar `setup_auth` y volver a verificar. La autenticación puede abrir Chrome y permanecer disponible hasta 10 minutos.
3. Si la sesión guardada es inválida, usar `re_auth` y volver a verificar.
4. Resolver el notebook desde `config/notebooks.json`. Usar `select_notebook`, `search_notebooks` o `list_notebooks`.
5. Antes de `add_notebook`, solicitar confirmación explícita al usuario.
6. Si el curso tiene un notebook configurado y disponible, consultar con `ask_question` y `source_format: "footnotes"`; reutilizar el `session_id` en consultas relacionadas y conservar la procedencia devuelta por el servidor para verificar las citas.

Solo si NotebookLM no está disponible (sin autenticación posible, sin notebook configurado para el curso, o el servidor no responde), recurrir en este orden a las fuentes locales:

1. `README.md` del curso.
2. Recortes en `bibliografia/recortes_por_semana/semana-XX/`.
3. Fuentes locales verificables en `bibliografia/`.

Antes de redactar, comprobar si existe *alguna* evidencia disponible: NotebookLM con contenido relevante, o al menos una de las tres fuentes locales. Si NotebookLM no está disponible y el sílabo no cita fuentes, no hay recortes ni bibliografía local, detener la operación por completo antes de escribir cualquier sección: informar al usuario que no hay evidencia verificable para esta semana y pedir explícitamente una fuente (bibliografía, notebook o material de referencia) antes de continuar. No generar una guía completa apoyada solo en explicaciones genéricas cuando la promesa de la skill es evidencia verificable.

Si existe evidencia por al menos una vía, continuar normalmente. Si durante la redacción surge una afirmación puntual sin respaldo en ninguna de las fuentes ya verificadas, detener únicamente el párrafo afectado y pedir la fuente o una respuesta manual de NotebookLM. Nunca inventar autores, años, páginas, citas o resultados.

### 3. Extraer el contrato semanal

Mapear los campos canónicos:

| Campo del sílabo | Uso |
|---|---|
| `**Asignatura:**` | Metadatos y apertura editorial |
| `**Periodo académico ordinario:**` | Fecha del documento |
| `### Semana XX — ...` | Semana y tema |
| `**Unidad:**` | `metadata.unit` en guide.json |
| `**Tema / contenido semanal:**` | Una sección teórica por viñeta principal |
| `**Resultado de aprendizaje:**` | Orientación, práctica y alineación |
| `**Herramienta de aprendizaje:**` | Fuentes y recursos |
| `**Horas:**` | Tiempo estimado |
| `**Actividades calificadas:**` | Alineación evaluativa |

No copiar los resultados como una lista decorativa. Usarlos para decidir evidencia, práctica y evaluación.

### 4. Proponer el plan antes de escribir

Mostrar:

- semana y tema;
- archivos planeados;
- resultado de aprendizaje;
- evidencia identificada;
- plantilla activa;
- dependencias o datos faltantes.

Esperar confirmación explícita del usuario antes de crear cualquier archivo.

Después de presentar el plan, persistirlo:

```bash
node "<skill-root>/bin/jintia.js" plan save <curso> <semana>
```

La operación `guide` verifica que el plan esté aprobado antes de crear archivos:

```bash
node "<skill-root>/bin/jintia.js" plan check <curso> <semana>
```

Si el resultado es `approved: false`, mostrar el estado y detener. No generar
`guide.json` sin plan aprobado. Consultar `commands/plan.md` y `commands/guide.md`
para los estados posibles (`pending`, `blocked`, `approved`, `generated`) y el
flujo de recuperación ante NotebookLM no disponible.

### 5. Crear o reutilizar la estructura

Usar:

```text
semanas/semana-XX/
├── guide.json
├── reference.bib
└── figure/
```

Si existe una semana compilada reciente del mismo curso, reutilizar sus convenciones compatibles. No sobrescribir contenido existente sin copia recuperable. Para una reestructuración completa, usar `scripts/legacy-manager.js`.

La secuencia de nodos en `guide.json` sigue este orden canónico:

1. `orientation` (obligatorio)
2. `theory`, `concept`, `practice` (iterativos)
3. `scenario` (aplicación)
4. `assessment` (evaluación)
5. `bibliography` (siempre al final)

Mantener flujo secuencial. Colocar el escenario después de toda la teoría y la bibliografía al final.

### 6. Redactar con alineación

Aplicar Backward Design:

1. Precisar qué desempeño demuestra el resultado.
2. Determinar evidencia observable.
3. Diseñar práctica guiada y recuperación.
4. Redactar teoría suficiente para ejecutar esa práctica.

La guía incluye recuperación y transferencia no calificadas. Incluir actividades calificadas solo cuando `.jintia/course.json` tenga `includeGradedActivities: true`; para cursos antiguos sin ese archivo, aceptar también `options.includeGradedActivities: true`; o cuando el usuario lo solicite explícitamente. En ese caso, conservar código, nombre y ponderación del sílabo.

Aplicar UDL 3.0:

- ofrecer representación textual y visual cuando aporte comprensión;
- explicar el propósito y el criterio de éxito;
- reducir barreras de lenguaje y navegación;
- permitir alternativas de acción o expresión cuando el formato lo admita.

Aplicar Quality Matters:

- hacer visibles instrucciones, materiales y criterios;
- mantener alineación entre resultado, actividad y evaluación;
- evitar recursos sin función pedagógica.

### 7. Diseñar representaciones visuales

No añadir una figura por decoración. Cuando una representación ayude a
demostrar el resultado de aprendizaje:

1. Identificar la operación cognitiva y el tipo de información.
2. Leer `references/sistema-visual.md`.
   Leer también `references/perfiles-disciplinares.md` si la notación del área
   condiciona la representación.
3. Elegir gráfico, mapa, tabla, diagrama, imagen o interfaz antes de elegir el
   motor.
4. Crear una especificación en `figure/specs/`.
5. Ejecutar `node "<skill-root>/scripts/visual-pipeline.js" --spec <spec> --template <activeTemplate> --guide <guide.json>`. El pipeline debe renderizar, crear la previsualización, inspeccionar, ejecutar el linter y actualizar el manifiesto.
6. Conservar fuente, datos, salida y procedencia en `figure/manifest.json`.
7. Adaptar la colocación a las capacidades declaradas por la plantilla activa (ej. no colocar en `margin` si el tema no lo soporta).

No inventar una imagen real cuando su apariencia sea evidencia disciplinar.
No fingir un renderizado. Registrar el fallback cuando el motor preferido no
esté disponible.

## Reglas editoriales

- Escribir en registro académico directo, causal y autoinstruccional.
- Evitar “Querido estudiante”, “A continuación veremos”, “Es importante destacar”, “Recuerda que”, “La regla de oro” y “En resumen”.
- Evitar metáforas no técnicas y los incisos entre rayas.
- Preferir oraciones de hasta 20 palabras. Dividir las que superen 35.
- Usar un término técnico canónico de forma consistente.
- Marcar solo su primera aparición con la sintaxis `{{keyterm:término}}` en el campo `content`. El renderer la convierte en `<span class="jintia-keyterm">término</span>` de forma segura.
- Conectar el primer párrafo de cada sección con la necesidad creada por la anterior.
- Usar por defecto una representación principal por sección. Añadir otra solo
  cuando responda a una operación cognitiva distinta y la combinación sea
  necesaria para lograr el resultado.
- Mencionar cada figura con el ID (ej. `[fig-ejemplo]`) en el párrafo previo.
- Usar los bloques del esquema AST; no sustituirlos por HTML crudo genérico.
- Insertar las figuras usando el fragmento HTML provisto por el pipeline visual.
- Insertar tablas usando el nodo `table` del `guide.schema.json`.
- Si la plantilla declara `marginNotes`, usar el margen solo para información
  complementaria. Mantener instrucciones, resultados y criterios esenciales
  en el flujo principal.

## Bibliografía

Usar `reference.bib` como única fuente bibliográfica local.

**Sintaxis de citas inline** (única forma reconocida por el renderer):

```
La normalización reduce anomalías {{cite:date2004}}.
Según {{cite:date2004|narrative}}, el modelo relacional...
```

- `{{cite:clave}}` → cita parentética: *(Apellido, año)*
- `{{cite:clave|narrative}}` → cita narrativa: *Apellido (año)*
- Proveer una entrada `.bib` por cada clave citada.
- Usar un nodo `bibliography` al final de la guía para generar la lista de referencias.
- El nodo independiente `citation` está deprecado; usar exclusivamente la sintaxis inline.

## Integraciones opcionales

Tratar logos, socios, módulos internacionales y ecosistemas institucionales como opcionales. Incluirlos solo si la configuración los define. No exigir ASU, Banco de Loja ni otra institución específica en una instalación genérica.

## Cierre obligatorio

1. Ejecutar `jintia validate <guide.json>`.
2. Si existen figuras, verificar que cada una pasó el pipeline visual
   (`node "<skill-root>/scripts/visual-pipeline.js" --spec figure/specs/fig-id.json --template jintia-clasico`);
   ejecutar además `node "<skill-root>/scripts/visual-linter.js" <guide.json>` como comprobación global de accesibilidad y manifiesto.
3. Generar y revisar el HTML: `jintia render <guide.json>` y luego `node "<skill-root>/scripts/html-linter.js" <guide.html>`.
4. Compilar a PDF con `jintia compile <guide.json>` y comprobar `jintia preflight <guide.html>`.
5. Verificar `reference.bib`, recortes, figuras y referencias cruzadas.
6. Ejecutar `references/checklist.md` punto por punto.
7. Informar archivos creados, validaciones ejecutadas y limitaciones reales.
# Motor visual editorial

Las representaciones genéricas pequeñas pueden usar `editorial-svg`, el motor SVG interno y determinista de Jintia. La selección evalúa primero la notación formal y la función cognitiva; química, electrónica, señales, UML/C4 y gráficos cuantitativos conservan sus motores especializados. `diagram-design` es únicamente procedencia de diseño documentada, no una Skill invocada durante runtime.
