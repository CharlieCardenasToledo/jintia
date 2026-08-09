# Usar Jintia con Claude

Esta guía separa las cuatro superficies de Claude que pueden intervenir en el
flujo. No son equivalentes y la forma de instalar la skill cambia en cada una.

## Elegir la modalidad

| Modalidad | Instalación | Uso recomendado |
|---|---|---|
| Claude Code | Carpeta local en `~/.claude/skills/` | Crear y compilar archivos dentro de un curso local |
| Claude Skills | Subir un ZIP en `Customize → Skills` | Usar el método pedagógico en chats compatibles |
| Claude Projects | Agregar instrucciones y conocimiento al proyecto | Mantener contexto estable; no sustituye la instalación de la skill |
| Cowork | Usar una skill cargada y una carpeta autorizada | Tareas de archivos desde la aplicación de escritorio, sujeto a sus límites actuales |

Consulta la documentación oficial de
[Skills](https://support.claude.com/en/articles/12512180-use-skills-in-claude),
[Projects](https://support.claude.com/en/articles/9517075-what-are-projects),
[Claude Code](https://code.claude.com/docs/en/slash-commands) y
[Cowork](https://support.claude.com/en/articles/14116274-organize-your-tasks-with-projects-in-claude-cowork)
para confirmar disponibilidad según tu plan y plataforma.

## Antes de instalar

La generación completa de guías requiere:

- Node.js compatible con la aplicación;
- Python;
- un compilador LaTeX;
- NotebookLM MCP cuando se necesite consultar bibliografía remota.

La aplicación comprueba estos requisitos. En Windows puede iniciar
instalaciones con `winget` después de pedir confirmación. En macOS y Linux
muestra los comandos que deben ejecutarse manualmente.

## Opción 1: Claude Code

Es la modalidad recomendada para trabajar directamente con las carpetas del
curso, ejecutar validadores y compilar LaTeX.

### Instalación desde la aplicación

1. Completa el onboarding.
2. Configura la institución y NotebookLM.
3. Abre la sección de activación.
4. Selecciona la instalación local para Claude Code.
5. Reinicia Claude Code si ya estaba abierto.

La app instala el payload en:

```text
Windows: %USERPROFILE%\.claude\skills\jintia-skill
macOS:   ~/.claude/skills/jintia-skill
Linux:   ~/.claude/skills/jintia-skill
```

### Instalación manual

Clona el repositorio y copia **el contenido de `skill/`**, no la raíz del
monorepo, a la ruta anterior. `SKILL.md` debe quedar directamente dentro de
`jintia-skill/`.

La estructura mínima es:

```text
jintia-skill/
├── SKILL.md
├── config/
├── references/
├── scripts/
└── templates/
```

Claude Code puede activar la skill por contexto o mediante:

```text
/jintia-skill
```

Abre Claude Code en la carpeta de la asignatura y pide, por ejemplo:

```text
Crea la guía de la semana 03 usando el README del curso como sílabo canónico.
```

## Opción 2: Claude Skills mediante ZIP

1. En la app, selecciona **Exportar skill**.
2. Elige una carpeta de destino.
3. En Claude, abre `Customize → Skills`.
4. Sube el ZIP generado.
5. Activa la skill en un chat compatible.

No descargues un supuesto ZIP de la GitHub Release: las releases actuales
publican los instaladores de escritorio. El ZIP de la skill se genera desde la
app con tu configuración.

> El ZIP puede contener `institution.json` y `notebooks.json` reales. Revísalo
> antes de compartirlo o subirlo a una cuenta distinta.

## Opción 3: Claude Projects

Projects sirve para conservar instrucciones, archivos de conocimiento y
conversaciones relacionadas. No convierte automáticamente el contenido pegado
en una skill ni registra `/jintia-skill`.

Úsalo para:

- adjuntar el sílabo o documentación institucional;
- mantener instrucciones específicas de una asignatura;
- conservar contexto entre conversaciones.

Para ejecutar el flujo completo con archivos locales y scripts, utiliza Claude
Code o una modalidad de Cowork que permita autorizar la carpeta necesaria.

## Opción 4: Cowork

Cowork puede trabajar con carpetas autorizadas y skills disponibles en Claude,
pero su arquitectura y capacidades cambian con rapidez. Actualmente sus
proyectos son locales a la aplicación y no admiten compartir el proyecto con
otras personas.

No asumas que Cowork:

- descubre automáticamente `~/.claude/skills`;
- puede acceder a WSL;
- comparte un proyecto entre miembros de un equipo;
- compila LaTeX con las dependencias del equipo local.

Autoriza únicamente la carpeta del curso y verifica el resultado antes de
sobrescribir archivos existentes. La
[arquitectura oficial de Cowork](https://support.claude.com/en/articles/14479288-claude-cowork-architecture-overview)
describe el modelo de ejecución vigente.

## Configurar NotebookLM MCP

La aplicación preserva otros servidores MCP y agrega `notebooklm` con la
versión que este proyecto ha verificado:

```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "npx",
      "args": ["-y", "@charlie.act7/gemini-notebook-mcp@2.3.3"]
    }
  }
}
```

La autenticación puede abrir un navegador. Las consultas salen del equipo y
se procesan mediante los servicios de Google/NotebookLM.

## Actualizaciones

La app preserva `institution.json` y `notebooks.json` al actualizar una
instalación local. Aun así, conserva una copia de seguridad antes de realizar
cambios importantes. Cuando exportes otro ZIP, vuelve a revisar los datos que
incluye.

## Solución de problemas

### Claude Code no detecta la skill

- Confirma que `SKILL.md` está directamente dentro de la carpeta de la skill.
- Confirma que la carpeta se llama `jintia-skill`.
- Si conservas una instalación anterior en `jintia`,
  vuelve a instalar desde Jintia Desktop para migrar la configuración.
- Reinicia Claude Code.

### NotebookLM no autentica

- Comprueba Node.js y `npx`.
- Ejecuta la autenticación desde la app.
- Si la sesión guardada caducó, usa la opción de reautenticación.

### La guía no compila

- Ejecuta primero `node scripts/latex-linter.js <guia.tex>`.
- Revisa los requisitos de `skill/references/compilacion.md`.
- En Windows, el validador completo de la skill requiere WSL 2 y TeX Live.
- En macOS y Linux utiliza `pdflatex` y `biber` nativos.

## Alcance de privacidad

Los archivos y la compilación son locales. Requieren red:

- autenticación y consultas de NotebookLM;
- extracción de una paleta desde un sitio institucional;
- instalación o descarga de dependencias;
- subida de una skill a Claude.
