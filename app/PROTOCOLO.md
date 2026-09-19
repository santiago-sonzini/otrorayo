# Protocolo local v1

Todos los mensajes WebSocket son JSON UTF-8 con `v: 1` y `type`. El cliente se conecta a `/ws/device?token=...` y envía `HELLO` con ID `Q01`–`Q10`. El dashboard se conecta a `/ws/dashboard` solo desde la Mac. Los comandos llevan UUID `commandId` y `generation`; el cliente conserva los últimos IDs ejecutados y devuelve el mismo ACK a duplicados. El controlador reintenta el mismo ID hasta dos veces si falta ACK. **ACK confirma recepción/ejecución de la acción, no confirma que el contenido se esté reproduciendo bien**; eso requiere telemetría observada.

```json
{"v":1,"type":"HELLO","id":"Q01"}
{"v":1,"type":"SNAPSHOT","serverTime":1780000000000,"desired":{"phase":"IDLE","selected":["Q01","Q02"],"experience":null}}
{"v":1,"type":"CLOCK_PROBE","clientSentAt":1780000000100}
{"v":1,"type":"CLOCK_REPLY","clientSentAt":1780000000100,"serverReceivedAt":1780000000110,"serverSentAt":1780000000110}
{"v":1,"type":"COMMAND","commandId":"uuid","generation":1,"action":"DISTRIBUTE","content":{"file":"show.mp4","size":123456,"sha256":"hex"}}
{"v":1,"type":"ACK","commandId":"uuid","status":"OK","detail":""}
{"v":1,"type":"HEARTBEAT","observed":{"appVersion":"0.1","battery":85,"charging":false,"freeBytes":1000000000,"contentSha256":"hex","contentStatus":"READY","transferPercent":100,"playback":"READY","positionMs":0,"error":null},"clock":{"offsetMs":-12,"rttMs":8}}
```

`PLAY_AT` lleva `startAt` como milisegundos Unix del reloj de Mac. `RESUME` lleva `scheduledAt` para el instante futuro y `startAt` como origen de la línea de tiempo (`scheduledAt − posición pausada`). En un cliente real, convertir ambos a reloj monotónico local mediante la estimación del offset. `DISTRIBUTE` descarga `/device/content?sha256=...&token=...`, admite `Range: bytes=N-`, escribe en archivo parcial y solo publica READY tras hash completo. `PREPARE` reserva reproductor y publica playback READY; `IDENTIFY` muestra ID durante unos segundos. `RESYNC` usa la posición maestra indicada y debe respetar los límites medidos del reproductor.

Un reconectado recibe siempre `SNAPSHOT` y reporta `HEARTBEAT` inmediato. El cliente no debe reiniciar una reproducción local por el mero hecho de perder red. Si el snapshot muestra `IDLE` tras un STOP recibido solo por el servidor durante el corte, el cliente vuelve al lobby al reconectar. Un comando viejo con `generation` inferior a la experiencia vigente se debe rechazar en la app real.

En v1 se asume LAN de laboratorio y token compartido. Para producción: credenciales individuales, rotación, transporte protegido o segmentación equivalente, límite de tasa y auditoría de acciones del operador.
