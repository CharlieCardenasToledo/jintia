# Contribuir

Este repositorio contiene Jintia Skill. Los cambios de la aplicación deben
proponerse en [`jintia-desktop`](https://github.com/CharlieCardenasToledo/jintia-desktop).

## Preparación

```bash
git clone https://github.com/CharlieCardenasToledo/jintia.git
cd jintia
npm ci
npm run skill:check
```

Se requiere Node.js 22.13 o superior. No agregues configuraciones
institucionales, credenciales, ids de notebooks ni documentos reales.

## Validación

```bash
npm run docs:check
npm run skill:check
npm run release:check
npm run package:check
npm run release:skill
npm run release:skill:check
```

Describe en el pull request el problema, la solución y las pruebas ejecutadas.
Los cambios de `SKILL.md`, plantillas o contratos deben incluir pruebas de la
conducta modificada.

## Publicación npm

El paquete público es `@charlie.act7/jintia`; no publicar `skill/` ni los
paquetes internos `@jintia/*` por separado. La primera publicación que reserva el nombre requiere
una sesión npm con 2FA:

```bash
npm publish --access public
```

Después de esa primera publicación, configurar en npm el trusted publisher de
GitHub Actions con estos valores:

- usuario u organización: `CharlieCardenasToledo`;
- repositorio: `jintia`;
- workflow: `publish-npm.yml`;
- acción permitida: `npm publish`.

Las siguientes versiones se publican ejecutando manualmente el workflow
`Publish Jintia to npm`. No almacenar `NPM_TOKEN`: el workflow usa OIDC y
procedencia automática de npm.
