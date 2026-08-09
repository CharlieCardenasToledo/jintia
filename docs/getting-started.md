# Primeros pasos

Jíntia convierte sílabos y fuentes del curso en guías didácticas semanales exportadas como HTML y PDF A4. Funciona en **Claude Code**, **ChatGPT** (como plugin OpenAI) y **Cursor**.

## Requisitos

| Requisito | Versión mínima | Notas |
|---|---|---|
| Node.js | 22.12.0 | Requerido para la CLI y el pipeline HTML |
| [Claude Code](https://claude.ai/code) | Cualquier versión reciente | Si usas Claude Code |
| ChatGPT Plus o Team | — | Si usas la integración OpenAI |
| Cuenta de Google | — | Para NotebookLM (opcional pero recomendado) |

PDF local requiere además [Vivliostyle CLI](https://vivliostyle.org/):

```bash
npm install -g @vivliostyle/cli
```

> **Sin terminal:** descarga el instalador desde [vivliostyle.org/download](https://vivliostyle.org/) y sigue el asistente gráfico.

---

## Instalación en Claude Code

### Opción A — Terminal

```bash
npx @charlie.act7/jintia install
```

El instalador:

1. Copia la skill en `~/.claude/skills/jintia-skill`
2. Registra los comandos en Claude Code
3. Configura el servidor MCP de NotebookLM si hay credenciales disponibles

### Opción B — Sin terminal (explorador de archivos)

1. Descarga el repositorio: `https://github.com/CharlieCardenasToledo/jintia`
2. Abre tu explorador de archivos y ve a tu carpeta de inicio (`C:\Users\TuNombre` en Windows, `/Users/tunombre` en Mac)
3. Crea la carpeta `.claude/skills/` si no existe
4. Copia la carpeta `skill/` del repositorio descargado dentro de `.claude/skills/` y renómbrala `jintia-skill`
5. Abre Claude Code — la skill estará disponible automáticamente

---

## Instalación en ChatGPT (plugin OpenAI)

1. En ChatGPT, ve a **Explorar GPTs → Mis GPTs → Crear**
2. En **Configurar**, sección **Acciones**, haz clic en **Importar desde URL**
3. Ingresa la URL del plugin:
   ```
   https://CharlieCardenasToledo.github.io/jintia/openai-plugin
   ```
4. Guarda el GPT con el nombre **Jíntia**
5. Para usar la skill, envía el prompt:
   ```
   Actúa como Jíntia. Genera la guía semanal 1 para el curso adjunto.
   ```

---

## Instalación en Cursor

```bash
npx @charlie.act7/jintia install --harness cursor
```

La skill se registra como comando slash en el panel de Cursor.

---

## Actualización

```bash
npx @charlie.act7/jintia update
```

---

## Verificar la instalación

```bash
npx @charlie.act7/jintia doctor
```

La salida muestra el estado de Node.js, Vivliostyle CLI y los temas instalados. Si algún elemento falta, el doctor indica cómo resolverlo.

---

## Primer uso

### Claude Code

Abre Claude Code en la carpeta de tu proyecto y escribe:

```
/jintia guía semana 1
```

### ChatGPT

En el chat con tu GPT Jíntia, adjunta el sílabo del curso y escribe:

```
Genera la guía didáctica para la semana 1 del curso adjunto.
Sigue el formato Jíntia con secciones: orientación, teoría, práctica, evaluación.
```

### Cursor

En el panel de Cursor abre la paleta de comandos (`Ctrl+Shift+P`) y escribe:

```
/jintia guía semana 1
```

---

En todos los casos, Jíntia pedirá el sílabo y las fuentes bibliográficas antes de generar la guía.
