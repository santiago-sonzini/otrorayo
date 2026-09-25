# OTRORAYO · Bienvenida espacial

Estado: tratamiento inicial archivado; el usuario pidió posteriormente cambiar el orden e instalar directamente en Quest. Secuencia vigente: negro → líneas cortas → logo → letras grandes de vidrio con frente blanco → fundido de 2 s a v2. La implementación y validación actuales están en app/quest/README.md.

Referencia de la fase 1 anterior: renderizada y revisada técnicamente. Las cinco decisiones fueron confirmadas por el usuario. Entregables y verificaciones en [README de revisión](../../videos/quest-welcome/README.md). Pendiente de aprobación visual explícita antes de implementar en Unity.

## Alcance autorizado y orden de entrega

Primero, diseñar y entregar cuatro cuadros de storyboard, animatic completo en 16:9 desde los ojos del usuario, cuadro final de alta resolución y detalle del vidrio. La vista 3D navegable entregada permite inspeccionar profundidad y separación entre capas.

Después de aprobar explícitamente composición, color, material, velocidad y duración se podrá implementar la escena en Unity. No modificar la app de Quest ni generar un APK durante esta fase. Posteriormente el usuario autorizó registrar v2.mp4 en el panel existente; la carga está completada sin cambios en su código.

## Decisiones confirmadas

| Decisión | Propuesta |
| --- | --- |
| Copy | BIENVENIDO A OTRORAYO |
| Duración principal | 24 segundos a partir del comando del operador |
| Estado final | Logo construido en espera; nuevo comando para salir |
| Audio | Diseño abstracto contenido, sin música ni voz; silencio en lobby |
| Revisión | Video 16:9 y vista 3D navegable; esta última no equivale por sí sola a una validación en visor |

La espera inicial es indefinida. Para mostrarla en el animatic se incluyen 3 segundos de preámbulo, separados de los 24 segundos principales: video de revisión de 27 segundos. El inicio simulado en ese video no autoriza inicio automático en la app.

## Dirección

Cinco corrientes espaciales recuperan la energía de la landing y la comprimen en un único objeto: el signo auténtico, con masa, bisel y luz interna. El negro es espacio activo; no se agregan habitación, horizonte, estrellas, grillas, portales, HUD ni textos técnicos.

Fuente visual estudiada:

- `../../landing/assets/images/otrorayo-instagram.jpg`: fuente auténtica de la silueta. La diagonal está partida cerca del centro y existen dos interrupciones del círculo junto a sus cruces. No sustituir por un círculo cerrado con una barra continua.
- `../../landing/assets/fonts/space-grotesk-latin.woff2`: tipografía suministrada para toda la bienvenida.
- `../../landing/cosmic-scene.js`: máscara extraída del logo, bisel derivado del contorno, cara blanca y capa dieléctrica posterior, barrido de reflejos, dos corrientes de cinco filamentos que convergen hacia la diagonal.
- `../../landing/event-scene.js`: profundidad de las curvas, ondulación de baja amplitud, núcleo fino y halo de baja intensidad. Recuperar estas propiedades, sin importar escenario, suelo, arcos ni grilla.
- `../../landing/glass.css` y `../../landing/neon.css`: fondo oscuro, blancos legibles, vidrio contenido y separación de las cinco familias de color.

Paleta invariable: rojo `#ee3825`, naranja `#ff6b0b`, amarillo `#fec306`, verde `#77bd20`, azul `#188ad9`. Fondo negro. Reflejos blancos fríos; sin teñir de arcoíris la totalidad de la cara frontal.

## Tratamiento de los cuatro cuadros

Los tiempos corresponden a la duración principal confirmada de 24 segundos. `t=0` es la marca de tiempo común del comando del operador.

| Cuadro | Tiempo | Composición desde los ojos del usuario | Movimiento y audio propuestos |
| --- | --- | --- | --- |
| 01 · Bienvenida | Lobby indefinido; salida t=0–1,5 s | Texto centrado a 2,8 m, alineado a la altura de mirada al iniciar la sesión. Space Grotesk en mayúsculas, blanco frío y firma pequeña. Negro alrededor. | Respiración mínima de la firma. Sin viaje ni sonido en espera. El texto desaparece con una curva suave al recibir el comando. |
| 02 · Entrada al túnel | t=1,5–10,5 s | Dos corrientes laterales se abren en profundidad, cada una con cinco familias cromáticas separadas. El centro permanece despejado. Curvas 3D longitudinales; sin anillos repetidos. | La fase luminosa avanza desde el fondo hacia el entorno lateral. Aceleración progresiva; cabeza y horizonte no reciben movimiento artificial. Tono grave suave y capas de aire con progresión contenida. |
| 03 · Convergencia | t=10,5–18,5 s | Las líneas cambian de dirección delante del usuario y se ordenan en los contornos del signo. El círculo y ambas mitades de la diagonal se vuelven legibles antes de cerrar el material. | Desaceleración entre 10,5 y 15 s. Las cinco familias conservan espacio hasta entrar en el volumen. Impacto breve y controlado al consolidarse la forma; sin flash a pantalla completa. |
| 04 · Logo final | t=18,5–24 s; después espera | Signo monumental centrado aproximadamente a 4,5 m, con diámetro inicial propuesto de 2,4 m. Proporciones frontales fieles. Pequeña inclinación del objeto para revelar profundidad, nunca de la cámara. | Reflejo lento por el bisel, cinco planos cromáticos internos discretos. El sonido decae y el signo permanece estable hasta la siguiente acción del operador. |

Las dimensiones y distancias son parámetros iniciales de diseño, sujetos a revisión estereoscópica. No constituyen una validación de comodidad en Quest.

## Geometría y material

Reconstruir una malla a partir del contorno real del JPG, preservando sus interrupciones, terminales y grosor relativo. La diagonal consta de dos hojas paralelas desplazadas, no de una única barra recortada. Contrastar una proyección frontal de la malla con la máscara fuente antes de aprobar la forma. Emplear bisel físico pequeño y profundidad visible, sin ensanchar el dibujo para simular volumen.

Medición de referencia sobre la imagen de 640 × 640 px, con umbral de luminancia 128: límites blancos aproximadamente `x/y=145…494`, centro `(319,5; 319,5)`, radio exterior aproximado `175,25 px` e interior `161,5 px`. Son ayudas para controlar escala; la extracción del contorno fuente gobierna la silueta final. La landing recorta la región `(128,128,384,384)` y usa luminancia como alfa, descartando valores menores que 8.

Propuesta de material realizable: cara frontal blanca con contraste estable; volumen dieléctrico y biseles con Fresnel; reflejos de entorno precomputados; barrido de luz determinista; planos internos de color muy contenidos. La refracción y la separación espectral se resolverán como aproximaciones limitadas para tiempo real. El render de aprobación debe usar el mismo enfoque, no prometer caústicas trazadas por rayos o refracción compleja ausentes en la implementación.

Geometría real para los filamentos, con núcleo fino y halo estrecho. Agrupar mallas y materiales por color. Reducir superficies transparentes superpuestas y conservar negro entre trazos. La cámara de revisión permanece fija; el avance se expresa mediante el flujo del entorno.

## Qué debe comprobar la revisión visual

- Lobby legible y estático hasta el disparo.
- Identidad reconocible en el túnel y en el signo, incluido el corte de la diagonal.
- Cinco colores diferenciados en ambos ojos.
- Trayectorias alejadas de la cabeza y del plano ocular, sin desplazamiento artificial lateral ni rotación de cámara.
- Construcción progresiva del signo, con lectura clara antes del impacto final.
- Material legible también en los instantes con pocos reflejos.
- Comparación frontal y detalle oblicuo del bisel obtenidos de la misma geometría y material que el animatic.

## Base técnica encontrada para la fase posterior

La app actual dispone de un lobby procedural y reproductor de video equirectangular; todavía no contiene esta secuencia nativa. `PLAY_AT` programa reproducción con una fecha compartida, pero está ligado al contenido de video preparado.

La implementación futura debe añadir un recorrido propio de experiencia: `LOBBY → SCHEDULED → PLAYING → COMPLETED`. El servidor usa actualmente `IDLE` para la espera y no acepta todavía `COMPLETED` como fase de telemetría. La reconciliación existente puede recuperar una reproducción en curso tras reconectar; para esta apertura habrá que impedir que una instantánea antigua o una reconexión disparen la secuencia desde la mitad.

La sincronización debe gobernar el tiempo de la coreografía mediante la marca de tiempo común, no mediante acumulación local de fotogramas. Detener, volver al lobby y resincronizar requieren acciones explícitas y deben invalidar el disparo anterior.

72 FPS es un objetivo, todavía no una medición. Su presupuesto total es aproximadamente 13,89 ms por fotograma. Configurar `Application.targetFrameRate = 72` no prueba esa frecuencia en XR: la frecuencia del visor la controla el subsistema XR, según la [documentación de Unity 6](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Application-targetFrameRate.html). La geometría, el coste de fragmentos, el estéreo, la latencia y la comodidad deberán medirse físicamente en Quest 3S y Quest 3 tras aprobar el render.

## Entrega de fase 1

Completados: storyboard de cuatro cuadros, animatic de 27 s a 1080p/60 FPS con audio, revisión 3D con inicio manual y controles de cámara, logo final y detalle de vidrio en 4K. El animatic incluye 3 s ilustrativos de lobby y 24 s de secuencia principal. Falta la aprobación visual del usuario antes de implementar en Unity.

## Video principal y precarga antes de la bienvenida

Por instrucción posterior del usuario, `~/Downloads/v2.mp4` se copió a `app/data/content/v2.mp4` y se registró en el dashboard como **Video principal · v2**: 360° mono, 7680 × 3840, 208,909 s, audio activado y 1.071.373.336 bytes. SHA-256: `46a1a9fe7b54f6c4e62335e62f35f965551770f77e1323aa22f38ff6e447d211`.

Estado verificado: panel en `IDLE`, ningún visor conectado, archivo todavía NO precargado en los Quest. El servidor de revisión escucha solamente en localhost:8787; la distribución a visores por LAN queda para la conexión posterior.

Requisito de la integración nativa: descargar por completo el video, verificar tamaño y hash, y preparar el reproductor antes de habilitar el inicio manual de la bienvenida. Conservar esa preparación durante toda la secuencia, para que el paso al video no espere una descarga o preparación al terminar. Un visor sin contenido preparado debe bloquearse como no listo. Este requisito está registrado para la fase Unity; aún no está implementado ni comprobado físicamente.
