# PROMPT MAESTRO — EXPERIENCIA DE BIENVENIDA OTRORAYO PARA META QUEST

Quiero diseñar y desarrollar una experiencia de bienvenida cinematográfica en realidad virtual para **OTRORAYO**, destinada a Meta Quest 3 y Quest 3S. La experiencia debe sentirse como la versión definitiva, espacial y tridimensional del lenguaje visual ya creado en la carpeta `/landing`. No quiero una conversión literal del sitio web: quiero conservar su identidad y elevarla a una pieza premium de motion design 3D en tiempo real.

## Fuente visual obligatoria

Antes de diseñar, estudiar estos archivos de la landing:

- Logo auténtico: `/landing/assets/images/otrorayo-instagram.jpg`.
- Tipografía principal: `/landing/assets/fonts/space-grotesk-latin.woff2`.
- Formación, material y movimiento del logo: `/landing/cosmic-scene.js`.
- Líneas, túnel y escultura lumínica: `/landing/cosmic-scene.js` y `/landing/event-scene.js`.
- Paleta y tratamiento de vidrio: `/landing/glass.css` y `/landing/neon.css`.

La paleta cromática de marca es:

- rojo `#ee3825`
- naranja `#ff6b0b`
- amarillo `#fec306`
- verde `#77bd20`
- azul `#188ad9`
- fondo negro profundo, con blancos fríos y reflejos espectrales controlados

El símbolo es un círculo blanco incompleto atravesado por una diagonal o rayo. Debe reconstruirse como geometría 3D limpia a partir del logo auténtico, manteniendo sus proporciones reconocibles.

## Objetivo de la experiencia

Cuando se abre la app, el usuario entra en un espacio negro, elegante y silencioso. Frente a él aparece el mensaje de bienvenida con la identidad de OTRORAYO. La escena permanece serena y lista, sin iniciar la animación principal por sí sola.

Desde el panel de control, el operador pulsa **INICIAR EXPERIENCIA**. Ese comando inicia simultáneamente la secuencia visual en los visores seleccionados:

1. El texto de bienvenida se desvanece con precisión.
2. El espacio se abre y nace un túnel de líneas de luz inspirado en la landing.
3. El usuario avanza visualmente por ese túnel, con una sensación real de profundidad, escala y velocidad.
4. Las cinco familias cromáticas se separan, fluyen por las paredes y rodean al espectador sin cruzar incómodamente cerca de sus ojos.
5. Las líneas convergen progresivamente delante del usuario.
6. La energía se comprime y forma el símbolo de OTRORAYO en 3D.
7. El logo queda completamente construido, legible y monumental, con material de vidrio óptico, volumen real, refracción sutil, dispersión cromática, bordes iluminados y reflejos animados.
8. La secuencia termina en el estado definido para la experiencia: **[DECIDIR: logo en espera / transición al contenido VR / reinicio al lobby]**.

## Escena inicial

- Fondo negro profundo, sin horizonte visible y sin una habitación genérica.
- Texto principal: **[DECIDIR COPY: “BIENVENIDO A OTRORAYO” / “BIENVENIDO”]**.
- Usar Space Grotesk, mayúsculas, blanco limpio, kerning cuidado y peso visual elegante.
- El logo puede aparecer como firma secundaria, pequeño y nítido, sin competir con el mensaje.
- El texto debe ser cómodo de leer en VR: centrado aproximadamente a 2,5–3 metros, dentro de la zona de confort, sin obligar al usuario a mover el cuello.
- Puede existir una respiración lumínica mínima para indicar que la experiencia está activa, pero no debe comenzar el túnel hasta recibir el comando del panel.

## Dirección del túnel

El túnel debe tomar como referencia conceptual las corrientes de `/landing/cosmic-scene.js`: filamentos finos de cinco colores que nacen separados, describen curvas orgánicas y convergen. Debe sentirse como una escultura de luz espacial, no como un salvapantallas, un warp genérico de ciencia ficción ni una grilla de videojuego retro.

- Crear geometría y curvas tridimensionales reales, con profundidad estereoscópica.
- Combinar filamentos muy finos, núcleos luminosos, halos volumétricos contenidos y partículas escasas.
- Conservar negro real entre las líneas. Evitar llenar toda la pantalla de bloom.
- Las líneas deben tener variación de grosor, velocidad, curvatura y desfase, pero responder a una coreografía clara.
- Usar movimiento hacia adelante con aceleración progresiva y desaceleración antes de formar el logo.
- Mantener el horizonte estable y evitar rotación de cámara, sacudidas o aceleraciones laterales que puedan producir mareo.
- El usuario permanece físicamente quieto; la sensación de avance debe construirse con el flujo del entorno y referencias visuales seguras.
- Los elementos no deben atravesar la cabeza, aparecer pegados al plano ocular ni generar disparidad incómoda.
- El sonido debe acompañar la profundidad: un tono grave contenido, energía ascendente por capas, pasos cromáticos sutiles y un impacto limpio al ensamblarse el logo. Sin música épica genérica de tráiler.

## Logo 3D y material

El resultado debe superar claramente la versión 2D de la landing:

- Geometría limpia, biseles físicos pequeños y grosor visible.
- Vidrio óptico oscuro o cristal claro con absorción leve, bordes luminosos y refracción estable.
- Separación espectral controlada usando los cinco colores de marca.
- Reflejos que recorren el círculo y la diagonal para revelar la forma.
- Capas internas o planos de color suspendidos dentro del volumen, inspirados en los cinco planos cromáticos de la landing.
- Profundidad real y silueta legible desde ambos ojos.
- El vidrio nunca debe volver ilegible el símbolo. La forma blanca debe conservar contraste sobre negro.
- Evitar plástico transparente, cromado genérico, exceso de aberración cromática, ruido, glitches, lens flares permanentes o bloom lavado.

## Calidad visual

La referencia es una pieza de apertura para una marca internacional de diseño de experiencias: precisa, oscura, elegante, eléctrica y sorprendente. Debe transmitir tecnología y autoría, no una plantilla de VR.

Priorizar:

- composición limpia
- timing cinematográfico
- contraste alto y negros preservados
- movimiento suave y con intención
- materiales físicos sofisticados
- escala monumental
- lectura perfecta del logo
- comodidad visual en headset

No agregar planetas, galaxias, portales circulares genéricos, interfaces futuristas, textos técnicos, HUD, controles visibles, chispas excesivas ni elementos que no existan en la identidad de OTRORAYO.

## Flujo de trabajo obligatorio: primero render, después implementación

### Fase 1 — Diseño y aprobación visual

No modificar todavía la app de Quest ni generar un APK.

1. Crear un storyboard con cuatro cuadros: bienvenida, entrada al túnel, convergencia de líneas y logo final.
2. Crear un render o animatic desde el punto de vista exacto del usuario, mostrando la secuencia completa con el timing propuesto.
3. Entregar una versión de revisión en video 16:9 para verla rápidamente en computadora y una previsualización compatible con visión inmersiva si aporta información espacial.
4. Incluir un cuadro final en alta resolución del logo 3D y un acercamiento del material de vidrio.
5. Esperar aprobación explícita de composición, color, material, velocidad y duración antes de implementar.

El render debe representar de forma honesta algo realizable en tiempo real en Quest. No aprobar una imagen imposible de sostener en el hardware.

### Fase 2 — Prototipo en tiempo real

Después de aprobar el render:

1. Reproducir la escena en Unity 6000/OpenXR dentro de `/app/quest`.
2. Probarla primero en el editor y capturar una previsualización comparable con el render aprobado.
3. Implementar un estado de lobby, un estado programado y la secuencia principal determinista.
4. Conectar el comando **INICIAR EXPERIENCIA** del panel con la acción de red correspondiente.
5. Asegurar que varios Quest comiencen con el mismo reloj sincronizado, usando el protocolo existente.
6. Permitir volver al lobby, detener y resincronizar desde el panel.

### Fase 3 — Optimización y validación en Quest

- Objetivo estable: 72 FPS en Quest 3S y Quest 3.
- Usar OpenGL ES 3 y ARM64, compatibles con el proyecto actual.
- Preferir shaders propios, geometría instanciada, curvas o mallas eficientes y texturas pequeñas.
- Controlar overdraw, transparencias, bloom y partículas; el negro debe mantenerse limpio.
- Usar renderizado estereoscópico Single Pass Instanced.
- Validar físicamente escala, convergencia, comodidad, legibilidad, latencia y sincronización.
- Sólo después de estas pruebas generar el APK final e instalarlo en los visores.

## Integración con el panel

El panel debe mostrar una acción clara llamada **INICIAR EXPERIENCIA** para los Quest seleccionados. Al ejecutarla:

- debe requerir que los visores estén online y sincronizados;
- debe programar el comienzo con una breve anticipación común;
- todos los visores deben usar la misma marca de tiempo;
- el panel debe reflejar los estados `LOBBY`, `SCHEDULED`, `PLAYING` y `COMPLETED`;
- debe existir una acción para detener y volver al lobby;
- una reconexión no debe iniciar la secuencia accidentalmente desde la mitad.

## Criterios de aprobación

La propuesta se considera aprobable cuando:

- el mensaje de bienvenida se lee inmediatamente y respeta la identidad;
- el túnel se reconoce como una evolución directa de las líneas de la landing;
- el movimiento produce profundidad sin mareo;
- los cinco colores están presentes y conservan separación;
- el logo auténtico se forma claramente y no se deforma;
- el material se siente como vidrio 3D de alta calidad;
- la escena es viable a 72 FPS en Quest 3S;
- el render y la versión en tiempo real comparten composición, timing y material;
- el panel puede iniciar, detener y resincronizar la secuencia en varios visores.

## Decisiones que deben cerrarse antes del render

1. Copy exacto de bienvenida.
2. Duración deseada de la secuencia principal.
3. Estado posterior a la formación del logo.
4. Presencia y estilo del audio.
5. Si el primer render de aprobación será video plano, video inmersivo o ambos.

