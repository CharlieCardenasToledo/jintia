# Temas HTML

Jíntia incluye tres temas HTML. Cada tema es un sistema CSS completo con
design tokens, componentes pedagógicos y control de paginación para
impresión. El tamaño de página es propio de cada tema — declarado en su
`meta.json` (`pageSize`) — no un estándar único: `jintia-clasico` y
`jintia-tecnico` son A4; `jintia-cuaderno` es **A5**.

## Elegir un tema

El tema se declara en `guide.json`:

```json
{
  "metadata": {
    "theme": "jintia-clasico"
  }
}
```

O como predeterminado para todos los cursos en `skill/config/institution.json`:

```json
{
  "activeTemplate": "jintia-clasico"
}
```

## Jíntia Clásico

**Slug:** `jintia-clasico`  
**Ideal para:** humanidades, ciencias sociales, educación general.

Guía académica de una columna. Bloques con color de fondo diferenciado por tipo
pedagógico. Tipografía académica legible en pantalla e impresión.

Capacidades:

| Capacidad | Disponible |
|---|---|
| Notas marginales | No |
| Figuras a ancho completo | Sí |
| Notas al pie | Sí |
| Bloques divisibles | Sí |

## Jíntia Técnico

**Slug:** `jintia-tecnico`  
**Ideal para:** programación, bases de datos, redes, ingeniería.

Optimizado para contenido técnico con bloques de código resaltados con Prism.
Paleta más oscura en los bloques de código. Figuras a resolución equivalente a
300 DPI.

Capacidades adicionales:

| Capacidad | Disponible |
|---|---|
| Bloques de código con resaltado | Sí |
| Diagramas técnicos | Sí |

## Jíntia Cuaderno

**Slug:** `jintia-cuaderno`  
**Ideal para:** actividades prácticas, talleres, laboratorios.

Optimizado para impresión con espacios de respuesta y listas de verificación.
Disposición más aireada para escritura a mano. Componente `jintia-answer-space`
con líneas de escritura.

Capacidades adicionales:

| Capacidad | Disponible |
|---|---|
| Espacios de respuesta | Sí |
| Listas de verificación | Sí |

## Estructura de un tema

```
skill/themes/<nombre>/
├── meta.json              ← contrato del tema (id, motor, capacidades)
├── tokens.css             ← design tokens (colores, tipografía, espaciado)
├── components.css         ← bloques pedagógicos (.jintia-theory, etc.)
├── print.css              ← @page, break-*, orphans, widows
├── theme.css              ← importa todo lo anterior
└── vivliostyle.config.js  ← configuración para Vivliostyle CLI
```

## Crear un tema personalizado

1. Copia el directorio `skill/themes/jintia-clasico/` con un nuevo nombre.
2. Edita `meta.json` con el nuevo `id`.
3. Ajusta `tokens.css` con los colores y tipografía de tu institución.
4. Declara el nuevo tema en `skill/config/institution.json`.

Los tokens de diseño usan variables CSS estándar con el prefijo `--jintia-`:

```css
:root {
  --jintia-brand:       #0f766e;
  --jintia-surface:     #f8fafc;
  --jintia-text:        #111827;
  --jintia-font-body:   "Inter", system-ui, sans-serif;
  --jintia-font-mono:   "Cascadia Code", monospace;
}
```
