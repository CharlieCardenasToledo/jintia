# Operación `transcript`

| Entorno | Invocación |
|---|---|
| Claude Code | `/jintia-skill` |
| Codex / OpenAI | `$jintia-skill` |
| CLI directa | `jintia transcript export` |

Exporta la traza editorial persistida de una sesión de trabajo con Jintia.

## Distinción fundamental

Este comando exporta el **estado editorial persistido** del curso:

- Planes semanales (`.jintia-plan.json`)
- Guías generadas (`guide.json`)
- Estado de validaciones por semana
- Validez del sílabo

**No exporta** los mensajes literales de la conversación.

Los mensajes del chat pertenecen al harness (Claude Code, Codex) y solo ellos
pueden exportarlos:

| Harness | Exportación del chat |
|---|---|
| Claude Code | `/export` o historial de conversación |
| Codex | `$export-session` |
| CLI directo | El archivo de sesión en `~/.claude/projects/` |

El error **JIN-TRN-001** se emite cuando se solicita `--mode verbatim`.

## Subcomandos

| Subcomando | Descripción |
|---|---|
| `export <curso>` | Genera informe de sesión editorial |

## Modos de exportación

| Modo | Contenido |
|---|---|
| `editorial` | Estado de planes, guías y sílabo *(por defecto)* |
| `technical` | Editorial + errores de validación + estado del harness |
| `summary`   | Tabla resumen de progreso del curso |
| `verbatim`  | **No disponible** — responsabilidad del harness |

## Opciones

| Opción | Descripción |
|---|---|
| `--mode editorial\|technical\|summary` | Modo de exportación |
| `--output <archivo>` | Guarda en archivo en lugar de stdout |
| `--redact=email,path,token` | Redacta campos sensibles del informe |
| `--json` | Salida JSON estructurada para integración |

## Ejemplos

```bash
# Informe editorial al stdout
jintia transcript export ./mi-curso

# Resumen guardado en archivo
jintia transcript export ./mi-curso --mode summary --output progreso.md

# Técnico con redacción de rutas sensibles
jintia transcript export ./mi-curso --mode technical --redact=path,email

# JSON para integración
jintia transcript export ./mi-curso --json
```

## Cuándo usar `transcript export`

- Para documentar el estado de avance de un curso al cierre de una sesión
- Para transferir contexto editorial entre sesiones sin revisar el chat
- Para generar informes de progreso para revisión institucional
- Para depurar el estado de planes bloqueados o guías incompletas

## Cuándo NO usar `transcript export`

- Para reproducir la conversación literalmente: usa el historial del harness
- Para auditar cambios en archivos: usa `git log` o `jintia state update`
- Para validar el sílabo: usa `jintia syllabus check`
- Para ver el estado de un plan específico: usa `jintia plan status`
