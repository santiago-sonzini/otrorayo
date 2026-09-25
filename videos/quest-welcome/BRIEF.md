---
workflow: general-video
flow: automation
storyboard: yes
message: "Cinco corrientes de luz construyen el signo auténtico de OTRORAYO en un espacio negro."
destination: desktop-review
aspect: 1920x1080
language: es
length: 27s
---

## Intent

Fase 1 del brief de bienvenida cinematográfica para Meta Quest 3/3S. El usuario confirmó BIENVENIDO A OTRORAYO, secuencia principal de 24 s, audio abstracto sin música ni voz, video 16:9 y vista 3D navegable. Tres segundos iniciales muestran el lobby indefinido antes del disparo de demostración.

## Assets

- ../../landing/assets/images/otrorayo-instagram.jpg — silueta auténtica para extracción de contornos y extrusión.
- ../../landing/assets/fonts/space-grotesk-latin.woff2 — texto de bienvenida.
- ../../landing/cosmic-scene.js y event-scene.js — curvas, núcleo fino, halos contenidos y convergencia.
- ../../landing/glass.css y neon.css — cinco colores y blancos fríos sobre negro.

## Customizations

Storyboard de cuatro cuadros, animatic completo, plano final 4K, detalle 4K del vidrio y vista 3D navegable. La entrega mantiene el logo visible al terminar. Luego el usuario pidió cargar Downloads/v2.mp4 en el dashboard para distribuirlo posteriormente y precargarlo antes de la bienvenida. El archivo ya está registrado en el panel; no hay visores conectados. La integración nativa deberá descargar, verificar el hash y preparar el reproductor antes de habilitar el disparo de bienvenida.

## Notes

La confirmación autoriza crear el render de revisión completo. El gate explícito del brief es DESPUÉS del render y ANTES de implementar en Unity; no añadir gates intermedios de la skill. No modificar Quest ni generar APK. La carga de v2.mp4 mediante el panel existente fue autorizada después; no requiere modificar su código. Ninguna medición desktop prueba 72 FPS ni comodidad en visor. Vista con cámara fija durante el animatic; revisión espacial mediante control aparte. Geometría, shaders y movimiento compartidos entre render y vista 3D.
