# Solución de problemas

Jintia 12.4 no compila LaTeX en ningún punto del pipeline activo — el motor
editorial es HTML + Vivliostyle CLI. Si un mensaje de error menciona
herramientas de una distribución LaTeX o un compilador de bibliografía
LaTeX, viene de una versión anterior o de un entorno que no corresponde a
esta skill.

## `jintia plan approve` falla con `JIN-PLN-001..004`

El plan no cumple el contrato pedagógico obligatorio:

| Código | Causa | Solución |
|---|---|---|
| `JIN-PLN-001` | El plan no declara `targets` | Descompón el resultado de aprendizaje en `targets` (verbo + descripción), o declara `"legacy": true` si el curso deliberadamente no adopta el contrato |
| `JIN-PLN-002` | La matriz de alineación está incompleta | Completa las cinco columnas (`teaching`, `practice`, `feedback`, `assessment`, `evidence`) para cada target |
| `JIN-PLN-003` | Falta `workloadBudget` o está fuera de 70-130% | Declara `{ declaredMinutes, plannedMinutes }` y ajusta `plannedMinutes` a la carga horaria real |
| `JIN-PLN-004` | `assessmentContract` no cubre las actividades calificadas del sílabo, o sus `points` no coinciden | Añade una entrada por cada código del sílabo con el mismo puntaje |

Ver [`skill/commands/plan.md`](../skill/commands/plan.md) para el esquema completo.

## NotebookLM no autentica / `re_auth` en bucle

- `get_health` solo informa si existe un respaldo de autenticación legible —
  **no** prueba la sesión contra Google. `authenticated: null` no es un
  fallo; no llames `re_auth` solo por eso.
- Llama `re_auth` únicamente cuando una operación real confirme que Google
  redirigió a inicio de sesión.
- Primera instalación sin respaldo: usa `setup_auth` (el navegador puede
  quedar abierto hasta 10 minutos).
- Si la sesión se pierde a mitad de un intento, recréala con
  `reset_session` antes de recurrir a `re_auth`.

Ver [`docs/notebooklm.md`](notebooklm.md) para la política completa de 3 intentos.

## `local-fallback` emite `JIN-EVD-028`

`evidence-gate.js` detectó que se usó una fuente local con NotebookLM
configurado, pero sin declarar `notebookLM.attempts` (o con menos de 3
intentos). No bloquea, pero indica que el fallback no quedó demostrado.
Declara los intentos:

```json
{ "attempts": [{ "attempt": 1, "result": "session-error" }, { "attempt": 2, "result": "session-error" }, { "attempt": 3, "result": "auth-failure", "reAuth": true }] }
```

## `Academic provenance: DEGRADED` o `WEAK`

- `DEGRADED` (`JIN-EVD-015`): `aiFallback > 10%`, o algún keyClaim tiene
  `extractionStatus: "partial"`. Revisa esos keyClaims y reintenta la
  consulta a NotebookLM si es posible.
- `WEAK`: `aiFallback > 30%`, o hay `claimIds` de `guide.json` sin entrada
  en `evidence.json`. Añade las entradas faltantes o eleva la procedencia
  de los claims en `ai-fallback`.
- `BLOCKED` (`JIN-EVD-016`): hay keyClaims sin `sourceMode`, con
  `bibliographyKey` inexistente, con bibliografía fabricada en
  `ai-fallback`, o (en publish) con `targetId` inválido. Corrige cada
  keyClaim señalado — esto bloquea, no solo advierte.

## Citation.js ausente / bloqueos `JIN-BIB-*`

`Citation.js` es una dependencia normal de `skill/` (no opcional). Si
`jintia compile --publish` o `jintia ready` fallan con `JIN-BIB-001`:

```bash
npm --prefix skill ci
```

`skill/` no es un workspace de npm — su `npm ci` es un paso separado del de
la raíz. Otros códigos `JIN-BIB-*`: `002` `reference.bib` ausente o no
declarado, `003` clave citada sin entrada en `reference.bib`, `004` BibTeX
no parseable, `005`/`006` degradación detectada en el HTML ya renderizado
(defensa en profundidad, después de `003`/`004`), `007` `citationStyle`
distinto de `"apa"`.

## Vivliostyle CLI ausente

```bash
npm install --global @vivliostyle/cli
```

Con `jintia ready` y sin `--skip-pdf`, Vivliostyle ausente bloquea
(`DETERMINISTIC DECISION: BLOCKED`) — pediste el cierre completo y no se
pudo alcanzar. Usa `--skip-pdf` si solo necesitas un precheck sin PDF (ver
siguiente entrada).

## `jintia ready` termina en `PRECHECK_READY`, no `READY`

Es el comportamiento esperado con `--skip-pdf`: todos los pasos
deterministas previos al PDF están en orden, pero el PDF no se generó.
`PRECHECK_READY` no es un cierre completo — vuelve a correr `jintia ready`
sin `--skip-pdf` (con Vivliostyle instalado) antes de compartir el material.

## `jintia preflight` bloquea la paginación

Revisa el reporte: encabezados huérfanos, figuras separadas de su
`figcaption`, o tablas que desbordan el margen. `preflight` recibe el HTML
renderizado (`guide.html`), no el PDF — si le pasaste un `.pdf`, es un error
de uso, no un fallo real.

## `jintia guide finalize` falla

Corre `content-linter.js` sobre `guide.json` antes de marcar el plan como
`generated`. Si falla, corrige los errores reportados (revisa primero con
`jintia validate guide.json`) — `guide finalize` no ignora errores de
validación silenciosamente.

## `jintia-selfstudy-reviewer` devuelve `NEEDS_CHANGES`

Es una decisión de juicio pedagógico, no un script determinista: significa
que la guía pasa los gates automáticos pero un estudiante sin docente
presente tendría dificultad real en algún punto. Lee el detalle del agente
y ajusta el contenido señalado — no se puede "forzar" `PASS` sin corregir lo
que reporta.

## Un hook bloquea la ejecución

Lee el código `JIN-*` reportado y corrige el archivo señalado. Ejecuta con
`--json` para conservar el reporte en CI.

## Windows falla en CI antes de probar la skill

Comprueba primero si el paso que falló instala dependencias del sistema
(Graphviz, PlantUML, fuentes) — esos errores pertenecen al entorno del
runner. Un fallo dentro de `npm run skill:check` o `npm test` sí corresponde
al código de la skill.
