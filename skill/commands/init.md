# Operación `init`

| Entorno | Invocación |
|---|---|
| Claude Code | `/jintia-skill` |
| Codex / OpenAI | `$jintia-skill` |
| CLI directa | `jintia init` |

Prepara la estructura de carpetas de un curso nuevo. No crea planificación académica.

## Cuándo usar este playbook

Cuando el usuario pide inicializar un curso: `/jintia-skill inicializa este curso` (Claude Code) o `$jintia-skill inicializa este curso` (Codex).

## Lo que hace `init`

1. Crea las carpetas `semanas/`, `bibliografia/` y `config/`.
2. Crea un `README.md` mínimo si no existe (conserva el existente sin sobrescribir).
3. Informa al usuario qué se creó.
4. Indica el siguiente paso: proporcionar el sílabo oficial.

## Lo que `init` NO debe hacer

- NO pedir institución, créditos, periodo ni cualquier dato académico.
- NO crear secciones de semana (Semana 01, Semana 02…).
- NO diseñar unidades ni resultados de aprendizaje.
- NO añadir actividades calificadas ni bibliografía.
- NO generar ninguna guía semanal.
- NO pedir más información de la mínima (código y nombre).

Si el usuario proporciona solo descripción general del curso sin planificación
semanal, responder que el sílabo vendrá después de `init`.

## Información mínima requerida

Si el usuario no proporciona código ni nombre, solicitar exclusivamente:

```
No existe una estructura Jintia en esta carpeta.

Necesito:
- Código de la asignatura (ej. CC05A_IFT200)
- Nombre de la asignatura
```

## Uso determinista (CLI)

```bash
node "<skill-root>/bin/jintia.js" init ./mi-curso \
  --code CC05A_IFT200 \
  --name "Estructura, modelado y almacenamiento de bases de datos"
```

## Salida esperada

```
✓ README.md creado
✓ semanas/ creada
✓ bibliografia/ creada
✓ config/ creada

Siguiente operación: proporciona el sílabo oficial con la operación `syllabus` (`/jintia-skill` en Claude Code, `$jintia-skill` en Codex, o `jintia syllabus` en CLI).
```

## Siguiente paso obligatorio

Después de `init`, el usuario debe proporcionar el sílabo oficial.
No avanzar hacia `plan` ni `guide` sin un sílabo validado.

Consulta `commands/syllabus.md` para la operación siguiente.
