# `/jintia compile`

Renderiza una guía a HTML y genera PDF usando Vivliostyle CLI.
Vivliostyle se invoca como **proceso externo e independiente** (no importado),
lo que preserva la licencia MIT de Jintia.

Acepta tanto `guide.json` (flujo completo: render → PDF) como `guide.html` (solo
compila a PDF). Con `guide.json` el CLI genera automáticamente `guide.html`
antes de invocar el motor PDF.

## Requisitos

- Node.js ≥22.12.0
- Vivliostyle CLI instalado: `npm install --global @vivliostyle/cli`

## Ejemplos

```bash
# Compilar desde guide.json (genera guide.html y luego guide.pdf)
node "<skill-root>/bin/jintia.js" compile semanas/semana-03/guide.json

# Especificar PDF de salida
node "<skill-root>/bin/jintia.js" compile semanas/semana-03/guide.json --output semanas/semana-03/guia-semana-03.pdf

# Compilar directamente desde HTML (si ya existe)
node "<skill-root>/bin/jintia.js" compile semanas/semana-03/guide.html

# Compilar en modo publicación (bibliografía sin degradación, ver más abajo)
node "<skill-root>/bin/jintia.js" compile semanas/semana-03/guide.json --publish
```

## Draft vs. publish

`jintia compile` tiene dos modos frente a la bibliografía:

- **draft** (por defecto): tolera Citation.js ausente, `reference.bib` incompleto
  o claves sin resolver. Las citas se muestran como marcadores (`[cita
  pendiente]`, `[referencia no formateada]`) para poder revisar el resto del
  documento sin bloquear el trabajo en curso.
- **publish** (`--publish`): antes de generar el PDF, corre
  `bibliography-manager.assertPublishReady()` sobre `guide.json`; después de
  renderizar, corre `assertRenderedPublishReady()` sobre el HTML final como
  defensa en profundidad. Bloquea la compilación (código de salida 1) si
  encuentra cualquiera de estas condiciones y reporta el código `JIN-BIB-*`
  correspondiente:

  | Código | Condición | Cuándo se verifica |
  |---|---|---|
  | `JIN-BIB-001` | Citation.js no está instalado | antes de renderizar |
  | `JIN-BIB-002` | `metadata.bibliography` ausente o el archivo `.bib` declarado no existe | antes de renderizar |
  | `JIN-BIB-003` | Una o más claves citadas no tienen entrada en `reference.bib` | antes de renderizar |
  | `JIN-BIB-004` | `reference.bib` no pudo parsearse como BibTeX válido | antes de renderizar |
  | `JIN-BIB-005` | Queda una clave cruda (`{{cite:...}}`) sin resolver en el HTML final | después de renderizar |
  | `JIN-BIB-006` | Aparece bibliografía o cita degradada (marcador `jintia-degraded`) en el HTML final | después de renderizar |
  | `JIN-BIB-007` | `metadata.citationStyle` distinto de `"apa"` | antes de renderizar |

  Ningún material académico final debe publicarse con bibliografía
  degradada. Usar `--publish` en el paso final antes de compartir el PDF.

## Flujo completo recomendado

```bash
jintia validate  guide.json            # linter pedagógico + validación de esquema
jintia render    guide.json            # genera guide.html (draft)
jintia compile   guide.json            # genera guide.pdf en draft (render implícito si se pasa .json)
jintia preflight guide.html            # verifica paginación sobre el HTML renderizado
jintia compile   guide.json --publish  # paso final: bloquea si la bibliografía está degradada
```
