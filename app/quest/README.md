# OTRORAYO VR · app nativa para Meta Quest

Proyecto Unity para instalar en cada Quest 3/3S y operarlo desde el controlador local de `app/`. Incluye lobby 3D procedural, video equirectangular 180°/360°, mono o estéreo, descarga previa con SHA-256, preparación del decodificador, inicio futuro, pausa/reanudación, identificación y reconexión.

**Revisión visual 0.3.2:** corrientes continuas de cinco colores → trazado de la silueta auténtica → logo blanco con volumen → fragmentos compactos que se reúnen en BIENVENIDO → fundido de 2 s al video. La revisión se prepara en la Mac. Por indicación del usuario, **no abrir automáticamente la app ni iniciar reproducción en el Quest**. El video continúa comenzando a los 19 s de la función; el fundido termina a los 21 s. El lobby permanece negro hasta PLAY.

La vista previa de esta revisión está en `Builds/welcome-review/revision-02/otrorayo-bienvenida-revision-02.mp4`, renderizada desde los mismos scripts y shaders de Unity (19 s, 30 FPS, 1280 × 720). Se capturaron también diez cuadros 1920 × 1080 y se verificó que un mismo instante produce una imagen idéntica después de un seek. Esto valida el render del editor; esta revisión todavía no se evaluó dentro del visor.

La versión 0.3.0 se compiló, instaló y probó en el Quest 3S Q01 conectado: archivo v2 completo con SHA-256 correcto, cuadro 0 decodificado antes de READY, bienvenida y transición a video 7680 × 3840 confirmadas mediante capturas y registros. 0.3.1 agrega el audio abstracto y corrige el material para conservar el frente blanco con cualquier orientación. La validación se registra en `Builds/welcome-review/VALIDACION.md`. El Quest se desconectó antes de instalar 0.3.1: el dispositivo conserva 0.3.0, con la secuencia y el fundido ya probados; falta instalar el ajuste final de material y audio.

No se ha acreditado todavía un presupuesto sostenido de 72 FPS ni sincronía física entre varios visores. Las capturas del editor y del Quest no sustituyen la evaluación personal de comodidad y legibilidad.

## Instalación, en palabras simples

Una sola vez por visor:

1. Habilitar una cuenta de desarrollador de Meta y **modo desarrollador** para el dispositivo desde la app Meta Horizon. Meta puede pedir verificar la cuenta/asociarla a una organización de desarrollo.
2. Conectar el Quest a la Mac con un **cable USB que transmita datos**; aceptar la depuración USB dentro del visor.
3. Iniciar el controlador de la Mac (`cd app && npm start`).
4. Abrir **`Instalar Quest.command`** con doble clic. Elegir Q01, Q02, etc. y la dirección de la Mac en la red que compartirán los Quest. El instalador coloca el APK, guarda ID/servidor/token y abre la app.
5. Confirmar el visor ONLINE en el panel. Repetir con los demás, siempre con identificadores distintos.

El paso 4 requiere haber generado el APK una vez con el apartado siguiente. No hace falta publicar en la tienda para instalar builds de desarrollo. La habilitación de modo desarrollador y el permiso USB corresponden al dueño del dispositivo: el instalador no intenta automatizarlos. [Guía oficial de Meta](https://developers.meta.com/horizon/essentials/quick-start/).

Después de instalar, la aplicación se encuentra en la biblioteca del visor, en la sección de apps de desarrollo/orígenes desconocidos según la versión de Horizon OS. Se debe abrir al comenzar la jornada; esta versión no configura kiosco ni arranque automático. El USB se puede desconectar cuando terminó la instalación. El control del evento funciona por la red local y los videos quedan almacenados en cada visor.

## Generar el APK en la Mac

1. Instalar **Unity Hub** y **Unity 6000.0.65f1**, con **Android Build Support + Android SDK/NDK Tools + OpenJDK**. Abrir el editor una vez y completar la activación de licencia que corresponda. [Versión fijada del editor](https://unity.com/releases/editor/whats-new/6000.0.65f1).
2. Abrir `app/quest` como proyecto desde Unity Hub para descargar los paquetes oficiales. La primera preparación/compilación necesita Internet; el evento no.
3. Cerrar el editor y abrir **`Compilar APK.command`** con doble clic.
4. El resultado, si Unity compila correctamente, será `app/quest/Builds/OTRORAYO-Quest.apk`.

Alternativa por terminal, desde la raíz del repositorio:

```sh
node app/quest/scripts/quest.mjs doctor
node app/quest/scripts/quest.mjs build
node app/quest/scripts/quest.mjs install --id Q01 --server http://192.168.1.100:8787
```

Reemplazar la dirección del ejemplo por la IP de la Mac que muestra `doctor`. No usar `localhost`: dentro del visor significa el propio Quest. El puerto por defecto del controlador es 8787; si se cambia, actualizar la dirección al instalar.

El comando `build` configura Android/OpenXR en un proceso y compila en otro para aplicar correctamente el cambio del sistema de entrada. Guarda registros en `Builds/configure.log` y `Builds/build.log`. También existen menús **OTRORAYO → Configurar proyecto Quest / Generar APK / Abrir escena de vista previa** dentro de Unity; para compilar allí, seleccionar Android en Build Profiles y reiniciar si Unity lo solicita.

El proyecto fija OpenXR 1.16.1 y XR Management 4.5.3, IL2CPP ARM64, API mínima Android 32, OpenGL ES 3, rendering Built-in y Single Pass Instanced/Multi-view. La escena se genera desde código; no requiere arrastrar objetos o materiales en el editor. Meta Quest Support y Oculus Touch se activan en el configurador. [Documentación de OpenXR](https://docs.unity3d.com/Packages/com.unity.xr.openxr@1.16/manual/index.html).

Para rutas diferentes:

```sh
UNITY_EDITOR='/ruta/Unity.app/Contents/MacOS/Unity' node app/quest/scripts/quest.mjs build
ADB='/ruta/platform-tools/adb' node app/quest/scripts/quest.mjs install --id Q02 --server http://192.168.1.100:8787 --serial NUMERO_USB
```

Se pueden usar `--apk /ruta/app.apk` y `--token-file /ruta/device-token.txt`. El instalador no muestra el token, no lo incrusta en el APK y elimina su copia temporal de la Mac. Actualizar con `install` conserva el contenido; una firma diferente puede hacer que Android rechace la actualización. No desinstalar sin respaldar el contenido que haga falta conservar.

## Operación

1. Conectar la Mac por Ethernet al router dedicado y los Quest por Wi-Fi a esa misma LAN. Abrir la app en cada visor.
2. Copiar el archivo a `app/data/content/` y abrir `http://localhost:8787` en la Mac.
3. Guardar la experiencia con nombre, archivo, proyección 180/360, formato mono/arriba-abajo/lado-a-lado y audio activado/silenciado.
4. Configurar lobby Órbita, Aurora o Minimalista, color y partículas. Enviar **Distribuir**; esperar archivo validado en todos los seleccionados.
5. Enviar **Preparar**; `READY` significa checksum correcto, `VideoPlayer.isPrepared` y cuadro 0 decodificado en silencio. El video queda pausado y preparado durante toda la bienvenida. Recién entonces ejecutar **PLAY**, que dispara la secuencia nativa y su transición al video.
6. Usar Pausa/Reanudar, STOP/LOBBY, RESYNC o IDENTIFY según corresponda. La identificación aparece dentro del visor durante ocho segundos.

El video se almacena completo en el Quest. Los formatos admitidos son equirectangulares; no incluye fisheye ni cubemap. En estéreo arriba/abajo se espera ojo izquierdo arriba; en lado a lado, ojo izquierdo a la izquierda. Para 180°, la mitad posterior queda negra. El formato, codec, bitrate, orientación y desempeño del **archivo final** deben ensayarse completos en hardware. Primero conviene probar un MP4 corto de resolución moderada antes de pasar al material final. No se declara soporte 8K por el nombre del archivo.

La bienvenida usa mallas nativas con el logo auténtico y contornos de Space Grotesk extraídos del archivo de la landing. El lobby ahora es negro; los ajustes decorativos anteriores se conservan en el protocolo pero no se muestran en esta versión. AUDIO PA y ROOM siguen fuera de esta entrega.

## Reconexión y límites de sincronía

- La pérdida de Wi-Fi no llama a `Stop`: el decodificador continúa con su archivo local. El socket intenta reconectar; una conexión silenciosa caduca a los 15 segundos.
- El reloj usa `Stopwatch`, correlacionado con Unix de la Mac mediante cuatro tiempos. Filtra latencia y fija la conversión del inicio al programar. El panel recibe la antigüedad real de la muestra; no se rejuvenece una medición vieja con cada heartbeat.
- Al reconectar, una reproducción del mismo timeline continúa. STOP y cambio de experiencia se reconcilian. Un visor que llega tarde o se reinicia no entra automáticamente en una bienvenida empezada; requiere volver al lobby y preparar una función nueva. Para una reanudación perdida se usa RESYNC explícito. Nunca se descarga automáticamente otro video durante PLAY.
- RESYNC es explícito, mediante seek y un inicio futuro con al menos dos segundos de margen. Si el seek no termina a tiempo, se informa error y no se anuncia una resincronización exitosa. No hay corrección automática de velocidad hasta medirla en los Quest.
- ACK confirma aceptación del comando. Descargas y preparaciones se confirman por telemetría: `contentStatus=READY` y `playback=READY`. Un error de archivo/decoder mantiene bloqueado el visor.
- `first_decoded_frame` registra el callback del decodificador. **No es una medición de cuándo los fotones/audio llegan al usuario**. El tiempo real de imagen/audio, drift y tolerancia deben medirse en dos Quest antes de escalar a diez.
- Suspender la app, quitar el visor o las políticas de energía de Horizon OS pueden pausar el proceso. La continuidad garantizada por el diseño se refiere a pérdida de red, no a suspensión del sistema.

Se mantiene el token compartido y HTTP/WebSocket del prototipo en LAN de confianza; no exponer este servicio a Internet. No se pidió permiso de acceso a archivos general: el contenido vive en el directorio de la propia app. Autenticación individual/TLS, kiosco, actualizaciones administradas y limpieza de contenidos antiguos no están implementados.

## Pruebas y diagnóstico

Desde `app/`:

```sh
npm test
npm run test:quest-installer
npm run test:quest-core -- /ruta/al/ejecutable/dotnet
```

Las pruebas de C# necesitan .NET SDK 8; toman Newtonsoft.Json incluido en el SDK, sin descargar paquetes NuGet. Compilan **los mismos archivos Network** usados por Unity y levantan un controlador temporal. Verifican reloj/frescura, cancelación, falta de espacio, integridad SHA-256, reanudación Range, fragmentos UTF-8, envíos simultáneos y reconexión tanto por cierre como por conexión silenciosa. No sustituyen una compilación Unity.

Verificación realizada en esta entrega: 7 pruebas Node del controlador, 2 del instalador y 52 aserciones C# incluidas las de integración. También se revisó sintaxis C# con Roslyn y se guardó una experiencia desde el panel en navegador. Los archivos usados en pruebas de transporte son datos de prueba, no acreditan decodificación de video.

Exportar los eventos del visor conectado:

```sh
node app/quest/scripts/quest.mjs logs --serial NUMERO_USB
```

Esto descarga únicamente `quest-events.jsonl` (no el archivo de configuración). Los eventos incluyen app/red, preparación, orden de play, primer cuadro decodificado, resync y errores; rotan a 4 MiB. El archivo del visor está en `/sdcard/Android/data/com.otrorayo.quest/files/quest-events.jsonl`.

Si un Quest no aparece: comprobar la IP/puerto, que ambos estén en la misma LAN sin aislamiento entre clientes, controlador abierto, permiso de red del firewall de macOS y token vigente. Un ID repetido reemplaza la conexión del otro visor: reprovisionar con IDs únicos. Si cambió la dirección o el token, volver a ejecutar el instalador.

Antes del evento: compilar e instalar en dos Quest, reproducir el video final, medir primera imagen/audio y drift, cortar y recuperar Wi-Fi, pausar/reanudar durante el corte, reiniciar el controlador y revisar los registros. Recién después repetir con los diez visores en la red del lugar.

## Archivos de la bienvenida

`WelcomeSequence.cs` define una coreografía determinista muestreada con el reloj compartido, sin desplazar ni rotar la cámara. `WelcomeGlass.shader` mantiene la cara blanca con biseles y color limitado al volumen. `QuestApp.cs` mide posiciones de la función completa; busca el video restando los 19 s de bienvenida al pausar/reanudar/resincronizar. El panel suma esos 19 s a la duración cuando detecta un visor 0.3.x.

Los recursos están en `Assets/OTRORAYO/Resources/Welcome/`. Los scripts `generate-welcome-font.py`, `generate-welcome-meshes.mjs` y `generate-welcome-audio.py` permiten regenerarlos. La extracción de fuente usa FontTools/Brotli; el audio usa NumPy; el generador de mallas usa el Three.js local del proyecto de revisión. `WelcomeReview.Capture` exporta cuadros de los mismos shaders y mallas nativos desde el editor.
