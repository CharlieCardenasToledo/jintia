# Jintia Universal Plugin

Este módulo contiene la envoltura (*wrapper*) y los manifiestos necesarios para distribuir Jintia como un Plugin Universal compatible con el ecosistema de **ChatGPT** y **Codex**. 

Durante la compilación de distribución, la herramienta de construcción integra dinámicamente el núcleo de la *skill* (desde el directorio `/skill`) dentro de `skills/jintia-skill/` para generar un paquete unificado y autónomo.

## Instalación local y distribución privada

La vía canónica desde el paquete Jintia es:

```bash
jintia plugin status --json
jintia plugin install --yes --json
```

Esto instala localmente el plugin y lo registra en el marketplace personal para pruebas o distribución privada. No publica Jintia en el Plugin Directory de OpenAI.

## Instalación Local (Desarrollo)

La instalación local de este componente realiza las siguientes operaciones:

1. Despliega los archivos del plugin en el directorio de usuario (`~/.codex/plugins/jintia`).
2. Registra a Jintia en el catálogo local (`~/.agents/plugins/marketplace.json`).
3. Conserva y sincroniza la configuración institucional y los enlaces a *notebooks* locales.
4. Requiere reiniciar el agente (ChatGPT o Codex) y activar explícitamente a Jintia desde el panel de Plugins.

## Distribución y Publicación

* **Empaquetado:** El script de exportación produce el archivo `jintia-openai-plugin-<versión>.zip` listo para su carga paralela (*sideloading*).
* **Publicación Pública:** La subida al directorio público oficial de OpenAI no es automática. Requiere una cuenta de desarrollador elegible, auditoría de metadatos de seguridad, pruebas de integración exhaustivas en las superficies admitidas y un proceso de revisión manual por parte de OpenAI.
