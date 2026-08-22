# Tu primer curso

Esta guía crea un curso desde cero y produce la primera guía semanal
siguiendo el flujo real de Jintia 12.4: `init` → sílabo → plan aprobado →
`guide.json` → `jintia ready`. No es un atajo directo de "pide una guía y
sale un PDF" — el plan pedagógico se aprueba explícitamente antes de
redactar cualquier contenido.

---

## 1. Instalar Jintia

```bash
npx @charlie.act7/jintia install --providers=claude --yes
```

Ver [`docs/getting-started.md`](getting-started.md) para Codex/ChatGPT y Cursor.

## 2. Crear la carpeta del curso

```bash
mkdir mi-curso
cd mi-curso
npx @charlie.act7/jintia init . --code IFT200 --name "Fundamentos de Bases de Datos"
```

`init` crea exactamente:

```text
mi-curso/
├── README.md       ← sílabo canónico, con la cabecera del curso ya escrita
├── semanas/         ← vacía; cada semana vive en semanas/semana-XX/
├── bibliografia/    ← fuentes locales (PDF, recortes, .bib generales)
└── config/          ← vacía; para configuración específica del curso, si aplica
```

`init` **no** crea `JINTIA.md`, `reference.bib` ni `figures/` — esos
artefactos, cuando existen, viven dentro de `semanas/semana-XX/` y se generan
junto con cada guía, no de antemano.

## 3. Completar el sílabo

Abre `README.md` y completa, por cada semana, los campos canónicos: Unidad,
Tema/contenido semanal, Resultado de aprendizaje, Herramienta de aprendizaje,
Horas, Actividades calificadas. Valida el formato:

```bash
npx @charlie.act7/jintia syllabus validate README.md
```

`syllabus validate` es más estricto que el antiguo `audit`: comprueba
duplicados, campos faltantes por semana y coherencia estructural completa
(`JIN-SYL-*`).

## 4. Configurar la institución (opcional) y NotebookLM

### Institución

`config/institution.json` es una configuración **a nivel de skill**, no del
curso — vive en `<skill-root>/config/institution.json` (por ejemplo
`~/.claude/skills/jintia-skill/config/institution.json`). Cópiala desde la
plantilla de ejemplo del mismo directorio:

```bash
cp <skill-root>/config/institution.example.json <skill-root>/config/institution.json
```

y edita nombre, facultad, autor y colores de marca. `jintia doctor` confirma
si el archivo existe.

### NotebookLM

NotebookLM es la fuente **primaria** de evidencia (no un extra opcional): la
jerarquía es NotebookLM → fuente local verificable → conocimiento del modelo
(`ai-fallback`, último recurso, nunca fabrica bibliografía). Configurar un
notebook implica autenticarte una vez con las herramientas MCP del harness
(`setup_auth`, luego `add_notebook` con la URL del notebook) — no es un paso
del CLI de Jintia. Ver [`docs/notebooklm.md`](notebooklm.md) para el detalle
completo de la política de 3 intentos y los fallbacks.

## 5. Generar la semana 1

A partir de aquí, la semana 1 sigue exactamente el mismo flujo que cualquier
otra semana del curso: plan aprobado → `guide.json` + `evidence.json` →
`jintia ready`. Ese flujo completo, con ejemplos de cada artefacto, vive en
[`docs/generate-weekly-guide.md`](generate-weekly-guide.md) — es el
documento canónico para esta parte y no se duplica aquí.

El resultado final de la semana 1 queda en `semanas/semana-01/guide.pdf`.
