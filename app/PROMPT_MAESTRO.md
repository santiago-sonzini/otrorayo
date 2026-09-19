# PROMPT MAESTRO — OTRORAYO VR CONTROL

Quiero desarrollar en la carpeta `app` de este proyecto un sistema propio de OTRORAYO para operar simultáneamente hasta 10 Meta Quest 3S durante eventos. Actuá como arquitecto e ingeniero de software, empezando por la base técnica y avanzando por hitos verificables. Este prompt es la especificación maestra; si encontrás ambigüedades, tomá decisiones razonables, documentalas y consultame solo si la elección cambia materialmente el producto o implica compras. No afirmes que una capacidad está lograda sin probarla en hardware real.

## Objetivo y principio operativo

Un operador debe manejar toda la experiencia desde un dashboard web local, simple, visual y apto para un show en vivo, sin manipular cada visor individualmente. El sistema debe funcionar completamente sin Internet durante el evento. Los archivos VR se almacenan y reproducen localmente en cada Quest; la red se usa para distribución previa, control, estado y sincronización, no para transmitir el video en vivo.

Cada experiencia puede tener hasta tres canales independientes pero sincronizados sobre una línea de tiempo común:

1. **VR:** video inmersivo reproducido en los Quest.
2. **ROOM / SCREEN:** video o visual opcional en la Mac o pantalla externa.
3. **AUDIO PA:** audio independiente de los Quest, reproducido por la Mac hacia una interfaz de audio y el sistema de sonido del salón.

Los canales son opcionales: una experiencia puede ser VR + AUDIO, solo VR u otra combinación válida. Ejemplo: `AMPER_VR_8K.mp4`, `AMPER_ROOM.mp4` y `AMPER_PA.wav`.

## Arquitectura acordada

- **App nativa OTRORAYO VR en cada Quest 3S:** lobby 3D en tiempo real, reproducción de archivos locales, conexión persistente con el servidor, ejecución de comandos, telemetría, recuperación tras desconexiones e identificación física del visor. Proponer tecnología adecuada para Quest/Android (por ejemplo Unity), justificarla y verificar en hardware la reproducción del formato y resolución elegidos. No usar una página web como reproductor VR principal.
- **Mac operador:** servicio/controlador local que mantiene el estado central autorizado, administra experiencias y archivos, coordina relojes y comandos, y reproduce AUDIO PA y ROOM / SCREEN. Su funcionamiento no debe depender del navegador ni de servicios en la nube.
- **Dashboard web local:** interfaz de operación servida por el controlador de la Mac y abierta en su navegador. Puede abrirse en otro dispositivo autorizado de la misma red más adelante. No es necesario empaquetar como app macOS en el primer prototipo; dejar abierta esa opción para simplificar instalación, arranque y permisos.
- **Red dedicada offline:** router con DHCP local, Mac conectada por Ethernet y Quest por Wi-Fi. No depender de la red del venue ni de Internet. Si se necesitan más puntos de acceso, preferir conexión cableada al router/switch, no extensores inalámbricos. Starlink puede ser un enlace opcional para descargas o soporte, pero nunca parte crítica del show. Considerar alimentación protegida para Mac, red y audio.

## Estado compartido y sincronización

La Mac es la fuente de verdad para el estado deseado de la experiencia (evento activo, experiencia, selección de visores, comandos y tiempo objetivo). Cada Quest informa su estado observado (online, batería, contenido, reproducción, posición, error y desfase). El dashboard muestra ambos de forma clara y se actualiza en tiempo real mediante una conexión local persistente, por ejemplo WebSocket.

Diseñar mensajes versionados con identificadores de comando, confirmaciones y operaciones idempotentes para evitar ejecuciones duplicadas. Al conectarse o reconectarse, un Quest recibe un snapshot del estado vigente y reporta su situación real. Heartbeats permiten marcarlo offline sin detener a los demás. Los estados no deben quedar falsamente en READY o PLAYING por falta de telemetría; mostrar también cuándo se recibió la última actualización.

Para PLAY: los Quest seleccionados reciben PREPARE, precargan el archivo y responden READY. Solo cuando se cumplen las condiciones de pre-flight, el servidor anuncia un instante futuro de inicio según un reloj compartido. Todos comienzan localmente en ese instante; no se intenta sincronizar enviando PLAY instantáneo. Medir offset de reloj y drift real, mostrarlo por visor y corregir desviaciones pequeñas sin saltos perceptibles cuando sea posible. Documentar límites, estrategia de resync y criterios de tolerancia. No prometer precisión en milisegundos sin medirla en dispositivos reales.

Si un Quest pierde Wi-Fi durante la reproducción, continúa con su archivo local. Al reconectarse, compara su posición con el estado maestro y se recupera o resincroniza sin afectar a los demás. Si falla la Mac, los Quest que ya reproducen deben poder continuar localmente, pero se reconoce que se pierden temporalmente el control central, las correcciones y el AUDIO PA/ROOM que salgan de ella. Diseñar configuración portable y recuperación sencilla; una segunda Mac preparada puede ser respaldo en una fase posterior, sin exigir failover automático en el MVP.

## Contenido y distribución

Antes del evento, el operador crea una experiencia con nombre, archivo VR, ROOM opcional, AUDIO PA opcional, lobby/preset, logo y parámetros visuales. Distribuir el video VR a los Quest seleccionados antes del show; mostrar progreso individual y validar cada archivo con checksum. No habilitar PLAY si los dispositivos seleccionados no tienen el contenido validado y READY. Prever reintentos, espacio libre y versiones del contenido. La distribución de archivos grandes a diez visores debe probarse y planificarse con anticipación; no depender de copiar los archivos minutos antes de abrir puertas.

## Lobby nativo del Quest

Cuando no se reproduce una experiencia, cada usuario permanece en una escena 3D generada en tiempo real, no en un video. Estética inicial: espacio oscuro, partículas sutiles, iluminación ambiental, logo del evento flotando, marca OTRORAYO discreta y movimiento lento. El operador configura logo, nombre, imagen de fondo, preset visual, colores e intensidad de partículas. Crear algunos presets iniciales y permitir agregar otros luego.

## Dashboard de operación

Diseño dark UI de show control profesional: lectura rápida a distancia y en ambientes oscuros, estados inequívocos, controles grandes, pocas acciones propensas a error. Vista principal: evento y experiencia activos, estado general (`10 / 10 QUEST ONLINE`), tiempo y progreso, y tarjeta para cada Quest con:

- Identificador Q01–Q10; online/offline y última conexión.
- Batería y cargando/no cargando. Alertas: 80–100 % OK, 40–79 % OK, 20–39 % WARNING, menos de 20 % CRITICAL.
- Contenido READY/LOADING/error y progreso de distribución.
- PLAYING/STANDBY/PAUSED/error, timecode y drift.
- Versión de app, IP o identificador y estado de red.

Controles maestros: PREPARE, PLAY, PAUSE, RESUME, STOP, RETURN TO LOBBY y RESYNC. Countdown opcional 3–2–1–GO. Permitir selección ALL o visores individuales, por ejemplo RELOAD o RESYNC solo Q07 sin afectar a los demás. `IDENTIFY QUEST` muestra temporalmente `QUEST 04` dentro del visor para identificarlo físicamente.

Acciones de emergencia siempre visibles: STOP ALL, RETURN ALL TO LOBBY, MUTE PA y RESYNC ALL. Las acciones críticas requieren confirmación o mantener pulsado aproximadamente un segundo, sin dificultar una parada de emergencia real.

## Audio y pantalla externa

El AUDIO PA es independiente del audio VR. Poder elegir una interfaz de audio externa como salida: Mac → interfaz USB → mixer → PA/subwoofer. Cada experiencia admite audio VR, AUDIO PA, ambos o VR muteado. En una fase posterior, considerar stems MASTER, SUB/LFE, FX y AMBIENCE con asignación a salidas de una interfaz multicanal. ROOM / SCREEN reproduce opcionalmente un archivo diferente en la Mac o pantalla externa, sincronizado con la misma línea de tiempo. Prever qué sucede si falta un canal opcional y cómo informar fallas de audio o pantalla al operador.

## Pre-flight y resiliencia

Antes de habilitar el show, una pantalla PRE-FLIGHT debe permitir evaluar en menos de diez segundos: servidor, router/red, interfaz de audio, archivos VR y PA, Quest conectados, checksums, baterías y sincronización de reloj. Mostrar READY FOR SHOW solo cuando las condiciones requeridas para la experiencia seleccionada se cumplen. Distinguir bloqueos de advertencias y permitir comprender inmediatamente el problema.

Probar explícitamente: pérdida de Wi-Fi de un visor durante PLAY, reconexión, falla de un visor, reinicio de dashboard, falla del controlador Mac, router sin Internet, error de archivo, batería baja y desfase. Ninguna falla individual debe detener automáticamente la reproducción local de los otros nueve visores.

## Forma de trabajo y primer hito

Primero inspeccioná la carpeta `app` y el brief original si está disponible; preservá lo existente. Proponé una arquitectura concreta y un plan de implementación por fases, con componentes, protocolo, estados, riesgos y criterios de aceptación. Después empezá por un prototipo técnico **offline con 2 Quest y 1 Mac**: conexión local, dashboard de estado, distribución y checksum de un archivo, READY, inicio programado, heartbeat, pérdida/reconexión de Wi-Fi y medición real de sincronía. Si no hay hardware o herramientas disponibles, implementá y verificá las partes simulables sin presentarlas como pruebas reales en Quest. Escalá a 10 Quest y agregá AUDIO PA/ROOM tras validar el núcleo. Documentá cómo instalar, ejecutar, probar y recuperar el sistema.

La arquitectura debe permitir crecer luego a más de 10 Quest, OSC, Art-Net/DMX, iluminación, pantallas LED, TouchDesigner, Resolume, cues temporizados, haptics, escenas interactivas, multiusuario, tablet y múltiples salas, sin convertir esas expansiones en requisitos del primer hito.

El resultado buscado es una herramienta propia de OTRORAYO para operar experiencias inmersivas con claridad y confiabilidad en eventos reales.
