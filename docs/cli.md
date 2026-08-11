# Referencia CLI

Todos los comandos se invocan con `npx @charlie.act7/jintia <comando>` o, si
tienes la skill instalada localmente, con `node skill/bin/jintia.js <comando>`.

## Comandos principales

### `install`

```bash
npx @charlie.act7/jintia install
```

Instala la skill en `~/.claude/skills/jintia-skill` y configura los harnesses
detectados (Claude Code, Codex, Cursor).

Opciones:

| Opción | Descripción |
|---|---|
| `--providers=claude,codex` | Limita la instalación a harnesses concretos |
| `--scope=project` | Instala solo en el proyecto actual |
| `--yes` | Confirma todas las preguntas sin interacción |

### `update`

```bash
npx @charlie.act7/jintia update
```

Actualiza la skill conservando la configuración institucional y los cursos.

### `doctor`

```bash
npx @charlie.act7/jintia doctor
npx @charlie.act7/jintia doctor --json
```

### `plugin`

Gestiona el plugin local de Jintia para ChatGPT/Codex desde los bytes del paquete npm.

```bash
jintia plugin status --json
jintia plugin install --yes --json
```

Esta instalación es local para pruebas o distribución privada; no publica Jintia en el Plugin Directory de OpenAI.

Verifica Node.js ≥ 22.12, Vivliostyle CLI, temas instalados y configuración
MCP. Con `--json` devuelve el resultado como objeto estructurado.

### `validate`

```bash
npx @charlie.act7/jintia validate semanas/semana-03/guide.json
npx @charlie.act7/jintia validate semanas/semana-03/guide.json --strict --json
```

Valida la estructura pedagógica del `guide.json` contra el esquema canónico y
las reglas `JIN-CNT-*`. Con `--strict` convierte advertencias en errores.

### `render`

```bash
npx @charlie.act7/jintia render semanas/semana-03/guide.json
npx @charlie.act7/jintia render semanas/semana-03/guide.json --theme jintia-tecnico --output dist/
```

Convierte `guide.json` en HTML semántico listo para impresión.

### `compile`

```bash
npx @charlie.act7/jintia compile semanas/semana-03/guide.json
npx @charlie.act7/jintia compile semanas/semana-03/guide.json --engine pagedjs --output dist/
```

Renderiza el HTML y lo convierte a PDF A4 con Vivliostyle CLI (por defecto) o
Paged.js. Requiere Vivliostyle CLI instalado globalmente para el motor por defecto.

### `preflight`

```bash
npx @charlie.act7/jintia preflight semanas/semana-03/guide.pdf
```

Analiza el PDF con Playwright y detecta problemas de paginación: encabezados
huérfanos, figuras separadas de su caption, tablas desbordadas.

### `audit`

```bash
npx @charlie.act7/jintia audit README.md
npx @charlie.act7/jintia audit README.md --json --strict
```

Valida el sílabo del curso contra las reglas `JIN-SYL-*` de Quality Matters.

### `harness`

```bash
npx @charlie.act7/jintia harness status --project ./mi-curso
npx @charlie.act7/jintia harness install --project ./mi-curso --providers=claude,codex
```

Gestiona la integración de Jíntia con los harnesses de IA disponibles en el
proyecto.

## Salida JSON

Todos los comandos admiten `--json` y devuelven el contrato estándar:

```json
{
  "command": "validate",
  "target": "semanas/semana-03/guide.json",
  "status": "ok",
  "exitCode": 0,
  "checks": [],
  "artifacts": [],
  "warnings": [],
  "errors": []
}
```

## Códigos de salida

| Código | Significado |
|---|---|
| `0` | Éxito |
| `1` | Error de validación o compilación |
| `2` | Archivo no encontrado |
| `3` | Dependencia faltante (Vivliostyle, Node.js) |
