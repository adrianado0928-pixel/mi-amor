# 🌍 Eres mi mundo michica

Este proyecto es una galería de fotos 3D interactiva y romántica, diseñada para atesorar momentos especiales. Presenta un planeta personalizado rodeado de estrellas y fotos que flotan sobre su superficie.

## ✨ Características principales

- **Planeta 3D Interactivo:** Un mundo suave y detallado que puedes rotar y explorar.
- **Galería de Fotos:** Las fotos se distribuyen automáticamente por la superficie del planeta sin solaparse.
- **Visor Detallado:** Al hacer clic en una foto, se abre un visor que permite "voltear" la imagen para leer una descripción y ver la fecha.
- **Ambiente Romántico:**
  - **Sol Corazón:** Un sol en forma de corazón con un halo pulsante que ilumina el mundo.
  - **Cielo Estrellado:** Miles de estrellas en tonos rosados que rodean el planeta.
  - **Texto 3D:** Un mensaje flotante ("Eres mi mundo michica") que siempre mira hacia ti.
- **Navegación Suave:** Controles de cámara optimizados con zoom suave e inercia.

## 📸 Cómo añadir nuevas fotos

¡Añadir momentos nuevos es muy fácil!

1. **Sube la foto:** Simplemente coloca tus archivos de imagen (`.jpg`, `.png`, `.webp`, etc.) en la carpeta `fotos/`.
2. **Automatización:** El sistema detectará las fotos nuevas automáticamente gracias a un script de GitHub Actions.
3. **Espera un momento:** En unos minutos, la web se actualizará sola con las fotos nuevas colocadas en posiciones aleatorias del planeta.

## ✍️ Cómo editar títulos y descripciones

Si quieres cambiar el nombre de una foto o añadirle un mensaje especial:

1. Abre el archivo `data.json`.
2. Busca la foto que quieras editar por su ruta (`ruta`).
3. Modifica los campos:
   - `"titulo"`: El nombre que aparece arriba en el visor.
   - `"descripcion"`: El mensaje que aparece al "voltear" la foto.
   - `"fecha"`: La fecha del recuerdo (ej: "15 de noviembre, 2025").
4. Guarda los cambios y súbelos al repositorio. La web se actualizará automáticamente.

## 🛠️ Detalles Técnicos

- **Motor 3D:** Desarrollado con [Three.js](https://threejs.org/).
- **Automatización:** Usa **Node.js** (`generar-data.js`) para gestionar los metadatos de las fotos.
- **Despliegue:** Configurado con **GitHub Actions** para actualizaciones y despliegue automático en **GitHub Pages**.

## 🚀 Configuración del Repositorio

Para que el despliegue automático funcione, asegúrate de que en la configuración de tu repositorio (**Settings > Pages**), la opción **Source** esté establecida en **"GitHub Actions"**.

## 📄 Licencia

Este proyecto utiliza la **AD Non-Commercial Attribution License v1.0**.

- **Permitido:** Uso personal, educativo y no comercial.
- **Obligatorio:** Atribución al autor (**Adrián Lavado Munuera**) y enlace al repositorio original.
- **Prohibido:** Uso comercial, sublicenciamiento y entrenamiento de modelos de IA sin permiso explícito.

Para más detalles, consulta el archivo [LICENSE](LICENSE).

---
Con amor, para mi chica. ❤️
