# Hooks locales

Los hooks son opt-in y no modifican archivos automáticamente. Se pueden
invocar desde un editor, CI o una integración de agente:

Para instalar el hook `pre-commit` en un curso que ya sea un repositorio Git:

```bash
node "<skill-root>/bin/jintia.js" hook install ./mi-curso
```

La instalación es explícita. Configura `core.hooksPath` dentro del repositorio y
ejecuta el análisis de los archivos staged; no instala hooks en el repositorio
del proyecto de Jintia ni modifica archivos del curso.

```bash
node "<skill-root>/bin/jintia.js" hook post-edit --changed curso/README.md
node "<skill-root>/bin/jintia.js" hook pre-compile curso/README.md
```

`post-edit` revisa los archivos compatibles entre los que cambiaron (sílabos
`README.md`) y `pre-compile` aplica las mismas reglas en modo estricto sobre
el primer archivo recibido, antes de iniciar una compilación. Ambos corren
`rules-runner.js` (`JIN-SYL-*`) — no validan `guide.json` (para eso, usa
`jintia validate`).
