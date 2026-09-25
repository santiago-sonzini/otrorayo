# OTRORAYO VR CONTROL · hito técnico 0.2

Este repositorio contiene el **controlador local, dashboard, dos visores simulados y el código fuente de la app Unity para Quest**. La app nativa está en [`quest/`](quest/README.md), con lobby 3D, descarga local, reproducción VR y herramientas de compilación/instalación USB. El núcleo de transporte C# está probado contra el controlador; generar el APK y verificar reproducción en Quest siguen pendientes de Unity/Android y hardware. El panel conserva **LISTO PARA PRUEBA**.

La arquitectura y las decisiones pendientes están en [ARQUITECTURA.md](ARQUITECTURA.md). El contrato de mensajes está en [PROTOCOLO.md](PROTOCOLO.md). Los requisitos originales permanecen en `BRIEF_ORIGINAL.md`, `DECISION_TECNICA_INICIAL.md` y `PROMPT_MAESTRO.md`.

## Requisitos

- Mac con Node.js 22 o posterior. No se requiere `npm install` ni Internet.
- Para la demo, dos terminales adicionales. Para hardware: dos Quest 3S, router con DHCP, Mac por Ethernet, APK de la app nativa Quest (ver [compilación e instalación](quest/README.md)) y permisos de desarrollo.

## Ejecutar la demo local

Desde `app/`:

```sh
npm start
```

Abrir `http://localhost:8787` **en la Mac**. El dashboard no se sirve a otros equipos todavía. El servicio escucha en la red local para que los Quest puedan conectarse; no necesita Internet.

En otra terminal, obtener el token local para los simuladores:

```sh
cat data/device-token.txt
```

Iniciar dos simuladores, cada uno en su terminal, reemplazando `TOKEN` por el contenido del archivo:

```sh
node src/simulator.js --id=Q01 --token=TOKEN
node src/simulator.js --id=Q02 --token=TOKEN
```

Para simular una pérdida de Wi-Fi de Q01 mientras sigue reproduciendo, reiniciar Q01 con:

```sh
node src/simulator.js --id=Q01 --token=TOKEN --outage-after-ms=15000 --outage-duration-ms=8000
```

Copiar un `.mp4` de prueba a `app/data/content/`, pulsar **Actualizar archivos**, completar evento y experiencia, y pulsar **Guardar experiencia**. El controlador calcula SHA-256. Luego usar **Distribuir → Preparar → PLAY**. El sistema selecciona Q01 y Q02 por defecto. Los simuladores guardan sus copias en `app/data/sim/Q01/` y `Q02/`.

El botón **PLAY** queda bloqueado hasta que ambos dispositivos confirmen archivo validado, READY, batería ≥20 %, reloj reciente y conexión reciente. El servidor programa el inicio cuatro segundos en el futuro. El estado `PLAYING`, el timecode y el drift que se ven aquí son **simulados**: no miden latencia de decodificador, pantalla ni audio.

Los controles de emergencia requieren mantener el botón aproximadamente un segundo. `MUTE PA` está deshabilitado porque todavía no existe el canal PA. `PAUSE` y `RESUME` son controles técnicos simulados.

## Pruebas automatizadas

```sh
npm test
```

La prueba integrada abre un servidor local temporal, genera un archivo de 1 MiB, lanza Q01 y Q02 con relojes sesgados, comprueba descarga y SHA-256, READY, inicio futuro, caída/reconexión de Q01 y continuidad de Q02. No usa Internet ni hardware Quest.

## Recuperación y operación

- **Dashboard cerrado o recargado:** el controlador y los simuladores continúan. Volver a abrir `http://localhost:8787` carga un snapshot nuevo.
- **Wi-Fi de un visor interrumpido:** el simulador continúa su línea de tiempo local; el panel lo muestra offline y oculta telemetría vieja. Al reconectar recibe estado deseado y reporta su posición. El comportamiento real debe probarse en Quest.
- **Controlador reiniciado:** `data/state.json` preserva evento, experiencia, selección y línea de tiempo. Los visores que ya reproducen deben continuar localmente; al reconectar, el controlador vuelve a mostrar su estado. No hay respaldo automático.
- **Archivo equivocado:** detener; copiar el archivo correcto a `data/content/`; registrar de nuevo, distribuir y preparar. El checksum evita marcar READY una copia diferente.
- **Token comprometido:** detener el servicio, reemplazar `data/device-token.txt` por una cadena aleatoria larga y reprovisionar los visores. El token viaja por URL en este prototipo y la red debe ser dedicada y de confianza. Antes de usarlo en un evento, sustituirlo por aprovisionamiento seguro por visor y TLS local o aislamiento equivalente.
- **Cambio de Mac:** copiar `data/` a la nueva Mac, mantener el mismo puerto y dirección de servidor configurada en los Quest, y revalidar red y dispositivos. Esto no constituye failover automático.

No registrar una nueva experiencia ni cambiar selección durante reproducción. Preparar y distribuir contenidos con horas de anticipación. Llevar una copia del contenido y configuración en un medio local de respaldo.

## Estado de implementación

| Función | Estado |
| --- | --- |
| Servicio Mac, dashboard, estado deseado/observado y heartbeat | Implementado y probado localmente |
| Descarga con progreso, reanudación parcial y SHA-256 | Implementado en simulador y probado localmente |
| READY, inicio futuro, ACK y reintentos de comando | Implementado en simulador y probado localmente |
| Corte y reconexión simulados de un visor | Probado localmente |
| App nativa, lobby 3D, reproducción VR, instalador USB | Código implementado en `quest/`; APK y pruebas Unity/Quest pendientes |
| Cliente C# ↔ controlador Node, descarga y reconexión | Compilado y probado sin Unity; ver `quest/README.md` |
| Sincronía visual/audio real | Pendiente de medición en Quest 3S |
| AUDIO PA, ROOM / SCREEN, interfaz externa | Fase posterior |
| Diez Quest físicos, red de evento, tolerancias reales | Pendiente de medición presencial |
