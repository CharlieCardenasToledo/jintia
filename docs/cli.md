# Referencia CLI

Todos los comandos se invocan con `npx @charlie.act7/jintia <comando>` o, si
tienes la skill instalada localmente, con `node skill/bin/jintia.js <comando>`.

> La fuente de verdad de la sintaxis exacta es siempre `jintia` sin argumentos
> (la función `usage()` de `skill/bin/jintia.js`). Esta página organiza y
> explica esos mismos comandos; si divergen, `usage()` gana.

## Instalación y mantenimiento

### `install` / `update` / `status` / `repair` / `uninstall`

```bash
npx @charlie.act7/jintia install [--providers=claude,codex] [--scope=project|global] [--yes]
npx @charlie.act7/jintia update  [--providers=claude,codex] [--scope=project|global] [--yes] [--verify-contract]
npx @charlie.act7/jintia status  [--providers=claude,codex] [--json]
npx @charlie.act7/jintia repair|uninstall [--providers=claude,codex] [--scope=project|global] [--yes]
```

Instala/actualiza/repara la skill para los harnesses detectados (Claude Code,
Codex, Cursor). `--yes` confirma todas las preguntas sin interacción.

### `doctor`

```bash
npx @charlie.act7/jintia doctor [--json]
```

Verifica Node.js `>=22.13.0`, Vivliostyle CLI, Python, temas instalados y
`config/institution.json`. No gestiona autenticación de NotebookLM — eso vive
en las herramientas MCP del harness (ver [`docs/notebooklm.md`](notebooklm.md)).

### `plugin`

```bash
jintia plugin status --json
jintia plugin install --yes --json
```

Gestiona el plugin local de Jintia para ChatGPT/Codex desde los bytes del
paquete npm. Instalación local para pruebas o distribución privada; no
publica Jintia en el Plugin Directory de OpenAI.

### `init`

```bash
npx @charlie.act7/jintia init <curso> [--code CODIGO] [--name NOMBRE]
```

Crea la estructura mínima de un curso nuevo: `semanas/`, `bibliografia/`,
`config/` y un `README.md` de sílabo con los campos canónicos vacíos. No crea
`JINTIA.md`, `reference.bib` ni `figures/` — esos artefactos se generan por
semana, dentro de `semanas/semana-XX/`, al ejecutar `guide create`.

## Sílabo

```bash
jintia syllabus validate <README.md>
jintia syllabus check    <curso> [semana] [--json]
jintia syllabus edit     <curso> <semana> --field <campo> <valor>
jintia syllabus import   <curso> <archivo> [--json]
```

Valida y edita el sílabo canónico (`README.md`) de forma segura (con backup
automático) en vez de tratarlo como texto libre.

## Plan semanal

```bash
jintia plan save    <curso> <semana> --file plan.json [--json]
jintia plan approve <curso> <semana> [--json]
jintia plan check   <curso> <semana> [--json]
jintia plan status  <curso> <semana> [--json]
```

`plan save` persiste el plan (`targets`, `alignmentMatrix`, `workloadBudget`,
`assessmentContract`). `plan approve` bloquea si ese contrato está incompleto
— salvo que el plan declare `"legacy": true` explícitamente. Ver
[`skill/commands/plan.md`](../skill/commands/plan.md).

## Compuerta de evidencia

```bash
jintia evidence check <curso> <semana> [--notebook-available] [--json]
```

Aplica la jerarquía NotebookLM → fuente local → `ai-fallback`. Ver
[`docs/notebooklm.md`](notebooklm.md).

## Guía semanal

```bash
jintia guide create   <curso> <semana> --input draft.json [--json]
jintia guide finalize <curso> <semana> [--json]
```

`guide create` exige plan aprobado y evidencia permitida antes de escribir
`guide.json`. `guide finalize` valida y marca el plan como `generated`. Ver
[`skill/commands/guide.md`](../skill/commands/guide.md).

## Motor editorial HTML

```bash
jintia validate  <guide.json> [--strict] [--json]
jintia render    <guide.json> [--theme ID] [--output guide.html]
jintia compile   <guide.json> [--output guide.pdf] [--publish]
jintia report    <guide.json> [--json] [--final]
jintia ready     <guide.json> [--json] [--skip-pdf]
jintia preview   <guide.json>
jintia preflight <guide.html>
```

- `validate`: valida `guide.json` contra `guide.schema.json` y `rules/catalog.json` (`JIN-SCH-*`, `JIN-CNT-*`, `JIN-ALN-*`, `JIN-SELF-*`, `JIN-ASM-*`, `JIN-EVD-*` según lo declarado). `--publish` (vía `compile --publish` / `report --final`) exige además `targets`, `hours` y `evidence.json`.
- `render`: convierte `guide.json` en HTML5 semántico con el tema seleccionado (`jintia-clasico`, `jintia-tecnico`, `jintia-cuaderno`).
- `compile`: renderiza y compila a PDF con **Vivliostyle CLI** (único motor soportado; requiere `npm install --global @vivliostyle/cli`). `--publish` bloquea ante degradación bibliográfica (`JIN-BIB-001..007`).
- `report --final`: lectura rápida de cierre sin renderizar.
- `ready`: el orquestador completo — encadena `validate --publish` → procedencia de evidencia → bibliografía (pre/post-render) → `render` → `html-lint` → `preflight` → `compile`. Se detiene en el primer paso bloqueante. `--skip-pdf` omite la compilación (decisión `PRECHECK_READY` en vez de `READY`). Ver [`skill/commands/ready.md`](../skill/commands/ready.md).
- `preflight`: recibe el **HTML renderizado** (`guide.html`, no el PDF) y usa Playwright para detectar viudas/huérfanas, figuras separadas de su caption y tablas desbordadas.

## Sílabo y calidad general

```bash
jintia audit README.md [--json] [--strict]
```

Valida el sílabo contra las reglas `JIN-SYL-*`.

## Otros comandos

Estos comandos existen y son estables, pero de uso menos frecuente fuera del
flujo canónico; consulta `jintia <comando>` sin argumentos o el código en
`skill/bin/jintia.js` para su sintaxis exacta:

```text
jintia contract [--json]
jintia project status <curso> [--json]
jintia week status <curso> <semana> [--json]
jintia context <init|read|validate> <curso> [--json]
jintia agents plan <operación> [--json]
jintia detect [proyecto] [--providers=claude,codex] [--json]
jintia harness <status|install|update|repair|uninstall> [...] [--json]
jintia state update <curso> <semana> <estado> [archivo-fuente]
jintia hook post-edit --changed <archivos...>
jintia migrate <curso> [--dry-run] [--quarantine] [--keep-first|--keep-last] [--json]
jintia behavior <guide.json> [--strict] [--json]
jintia behavior eval --output <guide.json|respuesta.txt> [--spec ID] [--json]
jintia behavior list [--json]
jintia visual render  <spec.json> --template ID
jintia visual inspect <manifest.json>
jintia transcript export <curso> [--mode editorial|technical|summary] [--output FILE] [--json]
jintia docs:check   [--json]
jintia legacy:check [<curso>] [--json]
```

## Flujo canónico

```text
init → syllabus validate → plan save → plan approve → guide create → guide finalize → validate → render → compile
```

o, de un solo golpe tras tener `guide.json` y `evidence.json`:

```bash
jintia ready semanas/semana-03/guide.json
```

## Salida JSON

La mayoría de comandos admiten `--json`. El formato exacto varía por comando
(consulta cada sección arriba); no existe todavía un envelope único para
todos — trátalo como JSON estructurado específico de cada comando, no como un
contrato genérico fijo.

## Códigos de salida

| Código | Significado |
|---|---|
| `0` | Éxito |
| `1` | Error de validación, compuerta bloqueada o compilación fallida |
| `2` | Uso incorrecto (argumentos faltantes) |
| `3` | Dependencia faltante (Vivliostyle, Node.js) |
