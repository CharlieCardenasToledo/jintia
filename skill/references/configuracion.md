# Configuración del usuario

Leer esta referencia cuando una tarea dependa de identidad institucional, branding, ecosistema digital, notebooks o tema HTML activo.

## Archivos

- `config/institution.json`: identidad, marca, integraciones y opciones.
- `config/notebooks.json`: asociación entre cursos y notebooks.
- `config/*.example.json`: ejemplos distribuibles; no contienen datos reales.
- `config/*.schema.json`: contratos para validar ambos archivos.

La aplicación de escritorio crea los archivos reales. Una actualización debe preservarlos. No guardar datos del usuario en `SKILL.md`, `references/` ni `templates/`.

## Configuración institucional

Campos principales:

```json
{
  "schemaVersion": 1,
  "institution": {
    "name": "Universidad Ejemplo",
    "website": "https://www.ejemplo.edu/",
    "faculty": "Facultad de Ingeniería",
    "career": "Ingeniería de Software",
    "author": "Ana López",
    "degree": "Mgtr."
  },
  "branding": {
    "primaryColor": "#00796B",
    "logoPath": ""
  },
  "digitalEcosystem": ["Canvas LMS", "Sistema académico"],
  "integrations": {
    "partnerName": "",
    "partnerModule": "",
    "partnerLogoPath": ""
  },
  "activeTemplate": "jintia-clasico",
  "options": {
    "evidenceMode": "notebooklm-preferred"
  }
}
```

`branding.primaryColor` se usa como variable CSS en los temas HTML (`--jintia-primary`). Si no existe logo, el tema omite el elemento de imagen de marca. No inventar integraciones.

## Configuración de la asignatura

Si existe `.jintia/course.json` dentro de la carpeta del curso, leerlo antes de
redactar. Su campo `includeGradedActivities` controla únicamente esa
asignatura y tiene prioridad sobre cualquier valor heredado de configuraciones
anteriores. Si no existe el archivo, puede usarse `options.includeGradedActivities`
de `institution.json` como compatibilidad con proyectos antiguos.

## Registro de notebooks

```json
{
  "schemaVersion": 1,
  "courses": [
    {
      "courseCode": "IFT200",
      "courseName": "Interacción Persona Computador",
      "rootPath": "01 IFT200",
      "notebookId": "",
      "notebookUrl": "https://notebooklm.google.com/notebook/..."
    }
  ]
}
```

Los ids pertenecen a la biblioteca del servidor `@charlie.act7/gemini-notebook-mcp` en la versión fijada en `release/release-config.json` (fuente canónica; no repetir el número aquí). Si un id deja de existir, buscar por nombre. Antes de registrar una URL con `add_notebook`, pedir confirmación.

## Tema HTML activo

Leer `themes/<activeTemplate>/meta.json`. Si el id no corresponde a un tema instalado, usar `jintia-clasico` e informar la corrección.

El tema define la gramática visual y los archivos CSS. Las reglas pedagógicas y de evidencia siguen siendo las de `SKILL.md`.

Verificar los archivos declarados en `requiredFiles` y comprobar que son accesibles desde la carpeta de la guía. Los temas distribuidos son `jintia-clasico`, `jintia-tecnico` y `jintia-cuaderno`.
