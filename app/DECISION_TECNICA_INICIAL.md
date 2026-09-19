# Decisión técnica inicial — OTRORAYO VR CONTROL

El brief original está en `BRIEF_ORIGINAL.md`. Este documento es una propuesta inicial, no reemplaza los requisitos.

## Qué desarrollar

- **Quest 3S:** aplicación nativa instalada en cada visor (por ejemplo, Unity/Android) para lobby 3D, reproducción de archivos locales, telemetría y comandos. Una página web en el visor no es la base adecuada para este alcance.
- **Mac operador:** servicio local que administra los contenidos, coordina el reloj y los comandos, y reproduce audio de sala y video externo. Interfaz de control **web local** abierta en el navegador del Mac. El navegador es solo la interfaz: el servicio local continúa funcionando sin Internet.
- **Más adelante:** empaquetar servicio e interfaz como aplicación macOS si simplifica instalación, arranque, permisos, audio y operación. No hace falta comprometerse a una app de escritorio para el primer prototipo.

## Red de evento

- Router/red Wi-Fi dedicada, con DHCP local y sin dependencia de Internet; Mac conectado **por Ethernet**. Quest conectados a esa red. Si se necesitan más puntos de acceso, conectarlos por cable al router/switch, no mediante repetidores inalámbricos.
- Starlink solo como enlace opcional para descargas, soporte remoto o servicios online. No debe participar en la ruta crítica del show.
- Preparar contenido y validar checksums antes de abrir puertas; probar cobertura, interferencia y reproducción con diez visores en el lugar. Mantener el video reproduciéndose localmente si cae el Wi-Fi.
- Prever energía protegida para Mac, router/AP e interfaz de audio. La red local reduce la dependencia externa, pero ningún router garantiza ausencia total de cortes.

## Primer hito técnico sugerido

Probar con 2 Quest y un Mac: conexión local offline, distribución/verificación de un archivo, READY, inicio programado, heartbeat, pérdida/reconexión de red y medición real de desfase. Después escalar a 10 y sumar audio/salida de pantalla. La precisión de sincronía se debe medir en hardware real antes de prometer un valor en milisegundos.
