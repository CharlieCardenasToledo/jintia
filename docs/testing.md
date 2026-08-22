# Pruebas

```bash
npm ci
npm --prefix skill ci
npm run docs:check
npm run skill:check
npm run release:check
```

El segundo paso (`npm --prefix skill ci`) es obligatorio: `skill/` no es un
workspace de npm, así que sus propias dependencias (Citation.js, etc.) no se
instalan con el `npm ci` de la raíz. Omitirlo hace que los pasos de
bibliografía fallen en silencio por falta de Citation.js — este fue
precisamente el bug que rompió `publish-npm.yml`/`release-skill.yml` antes
de corregirse (ver `CHANGELOG.md`, 12.4.0/12.4.1).

Para comprobar el artefacto exacto que se publicará:

```bash
npm run release:skill
npm run release:skill:check
```

La matriz `visual-engine-matrix.yml` ejecuta motores reales en Ubuntu, macOS y
Windows. La aplicación Desktop mantiene sus propias pruebas en su repositorio.
