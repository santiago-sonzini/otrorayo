# OTRORAYO · Revisión de bienvenida

**Revisión anterior archivada.** El usuario luego autorizó una secuencia nueva e instalación directa en Quest: negro → líneas cortas → logo → BIENVENIDO grande de vidrio y frente blanco → fundido a v2. Ver [implementación nativa actual](../../app/quest/README.md).

Fase 1 original: Animatic de 27 segundos: 3 segundos ilustrativos de lobby y 24 segundos de bienvenida. En la experiencia, el lobby espera el inicio manual del operador.

## Entregables

- [Animatic 1080p, 60 FPS y audio estéreo](exports/otrorayo-bienvenida-1080p.mp4)
- [Storyboard de cuatro cuadros en 4K](exports/storyboard-4k.png)
- [Logo final en 4K](exports/logo-final-4k.png)
- [Detalle oblicuo del vidrio en 4K](exports/vidrio-detalle-4k.png)
- [Revisión espacial interactiva](review.html): inicio manual, pausa, recorrido temporal, vista frontal, detalle y estéreo lado a lado.
- [Túnel estéreo](exports/tunel-estereo-sbs.png) y [logo estéreo](exports/logo-estereo-sbs.png). Son imágenes con dos vistas paralelas separadas 64 mm; no son video 360 ni una validación en visor.

La revisión está servida en http://127.0.0.1:4186/review.html. Para reiniciarla, ejecutar desde esta carpeta `python3 -m http.server 4186 --bind 127.0.0.1`.

## Diseño y verificación

La silueta proviene del logo auténtico de la landing. El ajuste geométrico limpio conserva el círculo interrumpido y las dos hojas diagonales desplazadas, con coincidencia binaria aproximada del 97,88 % contra la fuente. Tipografía Space Grotesk y cinco colores originales. El render y la vista interactiva comparten geometría, material y coreografía en `scene.js`.

El vidrio utiliza biseles geométricos y una aproximación óptica para tiempo real. No es refracción física completa. Se verificaron determinismo al buscar tiempos fuera de orden, controles, ausencia de errores de navegador y adaptación a pantalla de 390 px. El chequeo de HyperFrames pasó sin errores ni advertencias. La revisión visual incluye cuadros extraídos del MP4 final; formato comprobado: H.264, 1920 × 1080, 60 FPS, AAC estéreo 48 kHz, duración 27 s. Ver `exports/verification.json` y `exports/check-final.json`.

No se implementó todavía en Unity ni se generó un APK. Rendimiento a 72 FPS, comodidad, audio y sincronización entre visores requieren pruebas físicas después de la aprobación visual.

## Video principal cargado en el dashboard

`~/Downloads/v2.mp4` fue copiado a `../../app/data/content/v2.mp4` y registrado como **Video principal · v2** en el dashboard existente: 360° mono, 7680 × 3840, 3:29, audio activado, 1,07 GB. El archivo original se conserva. Ver `exports/video-loaded.json`.

Panel disponible en http://localhost:8787, en espera. Cero visores conectados al verificar: el video todavía no está precargado en ningún Quest. El servidor actual escucha únicamente en localhost; la distribución por LAN corresponde a la conexión posterior.

Requisito para la fase nativa: **descarga completa, hash verificado y reproductor preparado antes de habilitar la bienvenida**. Mantener el video preparado durante la secuencia para la transición posterior. Esta condición aún requiere implementación y validación en la app.

## Reproducir el render

Se utilizó HyperFrames 0.8.59, Three.js 0.181.2 y GSAP 3.14.2. Las dependencias visuales están copiadas en `vendor/` para funcionar localmente.

```sh
export HYPERFRAMES_BROWSER_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
hyperframes check --json
hyperframes preview --background
hyperframes preview --status
hyperframes render --output exports/otrorayo-bienvenida-1080p.mp4 --fps 60
```

Los scripts npm fijan la misma versión de HyperFrames. `scripts/prepare-assets.py` reconstruye la extracción raster y el audio; ejecutar después `scripts/clean-logo.py` para obtener el ajuste limpio. Requieren Python con Pillow, NumPy y Shapely. Los scripts de comprobación usan el runtime Playwright de esta máquina y Chrome instalado; adaptar sus rutas al mover el proyecto.

Siguiente paso: aprobar composición, colores, material, velocidad y duración antes de comenzar la integración con Quest.
