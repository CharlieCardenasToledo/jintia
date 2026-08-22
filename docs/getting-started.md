# Primeros pasos

Jíntia convierte sílabos y fuentes del curso en guías didácticas semanales
exportadas como HTML y PDF. Funciona en **Claude Code**, **Codex/ChatGPT**
(como plugin universal) y **Cursor**.

## Superficies de invocación

| Entorno | Cómo se invoca |
|---|---|
| Claude Code | `/jintia-skill` (⚠️ `/jintia` no es el comando registrado) |
| Codex / ChatGPT | `$jintia-skill` |
| CLI directa | `jintia <comando>` |

## Requisitos

| Requisito | Versión mínima | Notas |
|---|---|---|
| Node.js | `>=22.13.0` | Requerido para la CLI y el pipeline HTML (ver `engines` en `package.json`) |
| [Claude Code](https://claude.ai/code) | Cualquier versión reciente | Si usas Claude Code |
| Codex o ChatGPT | — | Si usas la integración vía plugin universal |
| Cuenta de Google | — | Para NotebookLM: es la fuente **primaria** de evidencia (no opcional por diseño), aunque el sistema sigue funcionando sin ella mediante fallback local o `ai-fallback` — ver [`docs/notebooklm.md`](notebooklm.md) |

PDF local requiere además [Vivliostyle CLI](https://vivliostyle.org/) (único
motor de compilación soportado):

```bash
npm install -g @vivliostyle/cli
```

> **Sin terminal:** descarga el instalador desde [vivliostyle.org/download](https://vivliostyle.org/) y sigue el asistente gráfico.

---

## Instalación en Claude Code

```bash
npx @charlie.act7/jintia install --providers=claude --yes
```

El instalador copia la skill en `~/.claude/skills/jintia-skill` (o en el
proyecto actual con `--scope=project`) y la registra para Claude Code.

---

## Instalación en Codex / ChatGPT (plugin universal)

La vía canónica es el propio CLI de Jintia, no una importación manual de GPT
Actions:

```bash
jintia plugin status --json
jintia plugin install --yes --json
```

Esto despliega el plugin en `~/.codex/plugins/jintia`, lo registra en el
marketplace local (`~/.agents/plugins/marketplace.json`) y sincroniza la
configuración institucional. Reinicia el agente (Codex o ChatGPT) y activa
Jintia desde el panel de Plugins. Es una instalación local para pruebas o
distribución privada — no publica Jintia en el Plugin Directory de OpenAI
(ver [`openai-plugin/README.md`](../openai-plugin/README.md)).

---

## Instalación en Cursor

```bash
npx @charlie.act7/jintia install --providers=cursor --yes
```

La skill se registra como comando en el panel de Cursor.

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

La salida muestra el estado de Node.js, Vivliostyle CLI, Python y los temas
instalados. Si algún elemento falta, el doctor indica cómo resolverlo. No
gestiona la autenticación de NotebookLM: eso ocurre a través de las
herramientas MCP del harness (`setup_auth`, `get_health`), no del CLI de
Jintia.

---

## Primer uso

El flujo real no es "pide una guía y ya" — hay un plan pedagógico que se
aprueba explícitamente antes de redactar (ver
[`docs/generate-weekly-guide.md`](generate-weekly-guide.md) para el detalle
completo paso a paso). Para arrancar:

### Claude Code

```
/jintia-skill planifica la semana 1
```

### Codex / ChatGPT

```
$jintia-skill planifica la semana 1
```

### Cursor

En el panel de Cursor abre la paleta de comandos (`Ctrl+Shift+P`) e invoca
Jintia igual que en Claude Code (`/jintia-skill planifica la semana 1`).

---

En todos los casos, Jíntia primero lee el sílabo (`README.md`) y presenta un
plan (resultado descompuesto en `targets`, matriz de alineación, evidencia
disponible) para tu aprobación explícita **antes** de escribir cualquier
`guide.json`.
