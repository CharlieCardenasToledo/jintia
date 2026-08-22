# Operación `syllabus`

| Entorno | Invocación |
|---|---|
| Claude Code | `/jintia-skill` |
| Codex / OpenAI | `$jintia-skill` |
| CLI directa | `jintia syllabus` |

Gestiona el sílabo canónico (`README.md`). Operaciones disponibles:

| Operación | Propósito |
|---|---|
| `syllabus validate` | Verifica el contrato mínimo del README.md |
| `syllabus check`   | Valida la semana antes de planificar |
| `syllabus import`  | Convierte un archivo externo al contrato README.md |
| `syllabus edit`    | Actualiza una semana de forma segura con respaldo |

## Reglas de edición

**Antes de modificar el README.md**, el sistema crea automáticamente una copia:

```
README.md
    ↓
README.md.bak-20260806-081500
```

Si la validación posterior falla, se restaura el respaldo y se informa el error.
El usuario debe aprobar explícitamente cualquier cambio propuesto antes de que
el agente edite el archivo.

## Flujo para recibir información del sílabo

Cuando el usuario proporcione datos del sílabo:

1. Identificar qué semanas o campos trae la información.
2. Mostrar al usuario el cambio propuesto (qué se actualizaría).
3. Esperar confirmación explícita.
4. Usar `runtime/core/syllabus-manager.js → safeUpdate()` para aplicar.
5. Verificar con `jintia syllabus validate README.md`.
6. Si la validación falla: restaurar automáticamente e informar el error.

El agente NO debe editar el README.md con sustituciones libres de texto.

## Regla antiinvención

Si el usuario solo proporciona descripción general sin planificación semanal:

```
He identificado metadatos y resultados generales.
Todavía no tengo la planificación semanal oficial.
No crearé semanas por inferencia.
Puedes proporcionar la tabla semanal o pedirme una propuesta no canónica separada.
```

Una propuesta generada por el agente tiene estado `proposed` y no modifica
el README.md hasta que el usuario la apruebe explícitamente.

## Uso determinista (CLI)

```bash
# Validar sílabo existente
node "<skill-root>/bin/jintia.js" syllabus validate ./curso/README.md

# Verificar que la semana 01 está lista para planificar
node "<skill-root>/bin/jintia.js" syllabus check ./curso 01

# Importar desde Excel/CSV (requiere script de conversión)
node "<skill-root>/bin/jintia.js" syllabus import ./curso planificacion.xlsx
```

## Validaciones mínimas del contrato

- Un solo encabezado principal (`# Nombre`)
- Un solo campo `**Asignatura:**`
- Un solo periodo académico
- Una sola sección por número de semana (`### Semana NN`)
- Una sola línea `**Horas:**` por semana
- Un solo bloque `**Resultado de aprendizaje:**` por semana
- `Ninguna` no puede coexistir con actividades calificadas en la misma semana
- Semanas con dos dígitos (`Semana 01`, no `Semana 1`)
- Separadores `---` entre semanas
- Todos los campos canónicos presentes

## Siguiente paso

Después de validar el sílabo, procede con `commands/plan.md`.
