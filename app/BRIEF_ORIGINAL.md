OTRORAYO VR CONTROL SYSTEM

Objetivo

Desarrollar un sistema propio de OTRORAYO para controlar simultáneamente una sala de hasta 10 Meta Quest 3S desde una computadora central.

El operador deberá manejar toda la experiencia desde una interfaz simple y visual, sin necesidad de manipular individualmente cada visor durante el evento.

El sistema estará compuesto por:

* Aplicación OTRORAYO instalada en cada Meta Quest.
* Servidor/controlador local ejecutándose en la computadora.
* Interfaz web de operación.
* Sistema de sincronización entre dispositivos.
* Motor independiente para audio y contenidos externos.

Todo el sistema debe poder funcionar dentro de una red local dedicada, sin depender de Internet durante el evento.

⸻

1. CONCEPTO GENERAL

El sistema debe manejar una experiencia como un show.

Una experiencia puede contener tres canales independientes pero sincronizados:

VR
Video inmersivo reproducido dentro de los Meta Quest.

ROOM / SCREEN
Video o visual opcional reproducido en la computadora o enviado a una pantalla externa.

AUDIO
Archivo de audio independiente enviado desde la computadora al sistema de sonido del salón.

Los tres utilizan una misma línea de tiempo.

Ejemplo:

VR:
AMPER_VR_8K.mp4

Pantalla:
AMPER_ROOM.mp4

Audio salón:
AMPER_PA.wav

No es obligatorio utilizar los tres.

Una experiencia puede tener solamente:

VR + AUDIO.

⸻

2. APP OTRORAYO PARA QUEST

Cada Quest tendrá instalada una aplicación propia llamada provisionalmente:

OTRORAYO VR

La aplicación deberá arrancar en un entorno virtual de espera.

STANDBY / LOBBY

Mientras no hay una experiencia reproduciéndose, el usuario debe encontrarse dentro de una escena 3D.

No utilizar un video como standby.

Debe ser una escena generada en tiempo real para obtener máxima definición y aprovechar el rendering nativo del Quest.

Ejemplo:

* espacio oscuro;
* partículas suaves;
* iluminación ambiental;
* logo del evento flotando;
* logo OTRORAYO discreto;
* pequeñas animaciones;
* movimiento ambiental muy lento.

El operador podrá configurar desde el panel:

* logo;
* nombre del evento;
* imagen de fondo;
* preset visual;
* colores;
* intensidad de partículas.

Inicialmente se crearán varios presets de lobby y luego podrán incorporarse nuevos.

⸻

3. REPRODUCCIÓN VR

Los videos VR NO deberán transmitirse en tiempo real desde la computadora.

Antes de comenzar el evento, el sistema copiará y almacenará el contenido dentro de cada Quest.

El panel mostrará el estado de distribución:

Quest 01 — 100% READY
Quest 02 — 100% READY
Quest 03 — 100% READY
etc.

No se deberá habilitar el botón principal de reproducción hasta que todos los dispositivos seleccionados estén preparados.

Cada archivo deberá validarse mediante checksum para asegurar que todos los Quest poseen exactamente el mismo archivo.

⸻

4. SINCRONIZACIÓN

Todos los dispositivos compartirán un reloj maestro proporcionado por el servidor OTRORAYO.

Al presionar PLAY:

1. Los Quest reciben orden de preparar el contenido.
2. El video queda precargado.
3. Cada Quest informa READY.
4. El servidor establece un momento futuro de reproducción.
5. Todos comienzan en ese instante.

Ejemplo:

PLAY AT:
21:32:15.500

Durante la reproducción cada Quest reportará periódicamente:

* posición actual;
* estado;
* posibles errores;
* diferencia respecto del master.

El panel deberá mostrar el desfase de cada dispositivo.

Ejemplo:

Q1 +8 ms
Q2 -14 ms
Q3 +4 ms
Q4 +61 ms

El sistema intentará corregir automáticamente pequeñas desviaciones.

⸻

5. AUDIO EXTERNO

El audio del salón debe poder ser diferente al contenido de audio de los Quest.

La computadora ejecutará un motor de audio sincronizado con la misma línea de tiempo del video VR.

Debe poder seleccionarse una interfaz de audio externa como salida.

Ejemplo:

USB Audio Interface → Mixer → PA / Subwoofer.

Una experiencia puede contener:

* audio VR;
* audio PA;
* ambos;
* VR completamente muteado.

En una segunda instancia debería contemplarse reproducción por stems:

MASTER
SUB / LFE
FX
AMBIENCE

Cada stem podría asignarse a una salida distinta de una interfaz de audio multicanal.

⸻

6. PANTALLA EXTERNA

El sistema debe permitir opcionalmente reproducir un contenido diferente en la computadora o pantalla externa.

Esto permitiría que las personas que están fuera de los Quest vean una pieza visual relacionada con la experiencia.

No tiene por qué ser el mismo video VR.

Ejemplo:

Quest:
viaje inmersivo 360°.

Pantalla del salón:
visual gráfica AMPER + timeline + contenido complementario.

Audio:
mezcla PA independiente.

Todo sincronizado.

⸻

7. DASHBOARD

Pantalla principal:

OTRORAYO VR CONTROL

Evento activo:
AMPER — 50 AÑOS

Experiencia:
EXPANSIÓN

Estado general:

10 / 10 QUEST ONLINE

Después deberán mostrarse diez tarjetas.

QUEST 01

* Online / Offline
* batería 87%
* cargando / sin cargar
* contenido READY / LOADING
* reproducción PLAYING / STANDBY
* timecode
* drift
* versión de aplicación
* dirección/IP o identificador
* estado de red

Repetido para los diez dispositivos.

Los estados deben identificarse visualmente con mucha rapidez.

⸻

8. MASTER CONTROL

Área central del operador.

Controles grandes:

PREPARE

PLAY

PAUSE

RESUME

STOP

RETURN TO LOBBY

RESYNC

También:

timeline

00:01:32 / 00:03:00

y progreso visual.

Antes de ejecutar PLAY se puede utilizar opcionalmente una cuenta regresiva:

3
2
1
GO

⸻

9. CONTROLES INDIVIDUALES

Aunque normalmente los diez dispositivos funcionarán juntos, debe ser posible seleccionar:

ALL

o

Q01
Q02
Q03
…

Ejemplo:

Quest 07 tuvo un problema.

El operador puede:

seleccionar Q07
→ RELOAD
→ RESYNC

sin afectar a los otros nueve.

⸻

10. IDENTIFICACIÓN DE CASCOS

Agregar función:

IDENTIFY QUEST

Al presionarla sobre Q04, dentro del visor aparece durante unos segundos:

QUEST 04

Esto facilita enormemente la operación física de diez dispositivos iguales.

⸻

11. ESTADO DE BATERÍA

Cada aplicación deberá reportar periódicamente:

* nivel de batería;
* estado de carga;
* última conexión.

El dashboard utilizará alertas.

Ejemplo:

80–100% OK
40–79% OK
20–39% WARNING
<20% CRITICAL

El operador debe poder detectar inmediatamente qué equipo necesita cargarse.

⸻

12. NETWORK / HEARTBEAT

Cada Quest enviará constantemente un heartbeat al servidor.

Ejemplo:

Q01 ALIVE
Q02 ALIVE
Q03 ALIVE

Si un dispositivo deja de responder, debe pasar a:

OFFLINE

sin detener la experiencia del resto.

Si la conexión se pierde mientras un video está reproduciéndose, el Quest deberá continuar reproduciendo localmente.

Cuando recupere la red deberá comparar su posición con el master y volver a sincronizarse si fuera necesario.

⸻

13. CARGA DE UNA EXPERIENCIA

El operador deberá poder crear una experiencia desde el panel.

Ejemplo:

NOMBRE:
AMPER — EXPANSIÓN

VR VIDEO:
amper_vr_8k.mp4

ROOM VIDEO:
amper_room.mp4

PA AUDIO:
amper_master.wav

LOBBY:
AMPER GOLD

LOGO:
amper.png

Luego:

DISTRIBUTE TO QUESTS

El panel mostrará progreso individual.

Cuando todos estén preparados:

EXPERIENCE READY.

⸻

14. PRE-FLIGHT

Antes de habilitar el show, incluir una pantalla de chequeo.

OTRORAYO PRE-FLIGHT

✓ Server
✓ Router
✓ Audio interface
✓ VR video
✓ PA audio
✓ 10 Quest connected
✓ 10 Quest content verified
✓ Batteries OK
✓ Clock synchronized

Resultado:

READY FOR SHOW

Esto tiene que permitir que un operador sepa en menos de diez segundos si la instalación está preparada.

⸻

15. PRINCIPIO DE DISEÑO

La interfaz debe parecer una herramienta profesional de show control.

No debe sentirse como una página administrativa tradicional.

Prioridades:

1. claridad;
2. estados visibles;
3. botones grandes;
4. mínimo riesgo de error;
5. operación rápida en ambientes oscuros;
6. lectura desde cierta distancia;
7. estética tecnológica OTRORAYO.

Dark UI.

El operador debe entender instantáneamente:

* qué está conectado;
* qué está preparado;
* qué está reproduciendo;
* qué tiene un problema;
* cuánto falta para terminar.

⸻

16. ACCIONES DE EMERGENCIA

Siempre visibles:

STOP ALL

RETURN ALL TO LOBBY

MUTE PA

RESYNC ALL

Las acciones críticas deberán pedir confirmación o requerir mantener presionado el botón durante aproximadamente un segundo para evitar activaciones accidentales.

⸻

17. FUTURAS EXPANSIONES

La arquitectura debe permitir posteriormente agregar:

* más de 10 Quest;
* triggers OSC;
* Art-Net / DMX;
* iluminación sincronizada;
* pantallas LED;
* TouchDesigner;
* Resolume;
* cues temporizados;
* vibración/haptics;
* escenas interactivas;
* experiencias multiusuario;
* control desde tablet;
* múltiples salas.

El objetivo a largo plazo es que OTRORAYO VR CONTROL evolucione hacia un sistema propio de show control para experiencias inmersivas.
