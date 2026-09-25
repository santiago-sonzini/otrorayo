# Prompt maestro para una invitación nueva

> **Estado vigente (25/09/2026):** ver `~/Desktop/otrorayo/docs/invitaciones/HANDOFF.md`. Este documento conserva el contexto histórico; donde lo contradiga (por ejemplo, remitente Gmail SMTP), vale el handoff.

Actualizado el 24 de septiembre de 2026 para la primera implementación local. El alcance comprobado y lo pendiente se detallan en [IMPLEMENTACION.md](./IMPLEMENTACION.md); el plan completo sigue siendo una hoja de ruta. Los marcadores deben completarse con recursos reales. Una carpeta local, un build o una aprobación registrada no equivalen a un deploy remoto.

Hay dos proyectos independientes: `/Users/santiagosonzini/Desktop/otrorayo-invitaciones` contiene el panel del equipo y la API central; `/Users/santiagosonzini/Desktop/valeria-zachary` contiene la primera invitación, `/revision` y `/admin`. Leé el README, `docs/API_CONTRACT.md` y `docs/OPERACION.md` de la plataforma antes de reutilizarla. La API usa el prefijo `/api/v1`. No se presupone que exista un starter o SDK publicado por separado.

---

Creá una invitación web nueva con diseño original y conectala a nuestra plataforma compartida de invitaciones. Trabajá hasta entregar una preview revisable y el proyecto listo para publicar. Usá el código y contrato reales disponibles; no inventes endpoints ni simules una integración como si funcionara.

## Datos de este encargo

- Brief y dirección visual: `[BRIEF]`.
- Referencias opcionales de diseño: `[URLS / ARCHIVOS]`.
- Nombre del proyecto: `[NOMBRE]`.
- Contenido y jornadas del evento: `[DATOS, HORARIOS, LUGARES, INICIOS Y FINES]`.
- Cierre de confirmación: `[FECHA/HORA, POR PROYECTO O JORNADA]`.
- Zona horaria: `America/Argentina/Cordoba`, salvo indicación diferente.
- Campos y enlaces que el cliente podrá editar: `[LISTA INICIAL]`.
- Base de reutilización o starter disponible y versión: `[CARPETA / REPO + VERSION REAL]`.
- Contrato de API v1 y componentes compartidos disponibles: `[RECURSOS REALES]`.
- Repositorio de esta invitación: `[REPO]`.
- Identidad asignada por la plataforma: `[PROJECT_ID O MECANISMO DOCUMENTADO DE ALTA]`.
- Destino Cloudflare registrado, si ya existe: `[CUENTA + WORKER/PROYECTO + DOMINIO]`.
- Responsable de notificaciones: `[USUARIO DEL EQUIPO]`.
- Política de demo y leads: `[CONFIGURACION APROBADA DE LA PLATAFORMA]`.

Las credenciales se proporcionan por los mecanismos privados del entorno. No las escribas en este prompt, en el código, en logs, en commits ni en documentación.

## Antes de implementar

1. Leé las instrucciones del repositorio, la implementación de referencia y el contrato versionado. Revisá el estado de Git y conservá cambios de otras personas.
2. Comprobá qué recursos existen y qué acceso tenés. Si falta acceso a la plataforma o una función del contrato, continuá con el diseño y componentes independientes, marcá la integración pendiente y pedí el dato mínimo faltante. La ausencia de un starter separado no implica que la API existente deba reinventarse. No improvises una base nueva ni afirmes haber publicado.
3. Usá una rama de trabajo. El destino de producción se obtiene del registro del proyecto; nunca lo deduzcas solo de un dominio, nombre o carpeta.
4. Creá cada nueva invitación como proyecto independiente del panel del equipo. La infraestructura compartida nueva usa Cloudflare Workers, D1 y R2; Mariapia y los demás eventos anteriores permanecen en sus sistemas actuales, sin migraciones ni conexiones nuevas desde este encargo.

## Diseño con contenido editable

- El diseño es libre: composición, tipografía, imágenes, animación y estructura responden al brief. Reutilizá las funciones comunes disponibles sin copiar nombres, IDs, credenciales o configuración de otro evento.
- Declarar campos en el manifiesto con ID estable, etiqueta, tipo, validación y permiso de edición. Admitir campos opcionales, enlaces, teléfono y colecciones de jornadas con IDs estables.
- Obtener los valores desde la plataforma. Solo enviar valores iniciales al alta mediante el mecanismo idempotente documentado. Nunca reemplazar ediciones del cliente durante build, deploy o reinicio.
- No fijar nombres, textos de botones, lugares, enlaces, fechas o teléfonos operativos en componentes si deben editarse.
- Para texto en canvas/WebGL, usar datos y texturas regenerables; lo que deba editarse no puede quedar incrustado definitivamente en una imagen.
- Incluir identificadores estables de revisión para secciones y elementos. En escenas canvas, exponer hotspots o secciones seleccionables mediante el contrato del editor.
- Cuidar lectura móvil, navegación por teclado, movimiento reducido, tiempos de carga y contenido utilizable si una animación no carga.

## Conexión segura a la plataforma

- Usar exclusivamente API v1 y versiones documentadas. Solo la plataforma central accede a D1, R2 privado y correo. El navegador de la invitación nunca recibe esas credenciales.
- Las rutas `/api/v1` del mismo dominio de la invitación pasan por su Worker intermediario: fija el proyecto desde configuración del servidor y usa un secreto de integración limitado a ese proyecto. No habilitar rutas globales del equipo ni confiar en un `projectId` o encabezado de identidad enviado por el navegador. Registrar una integración nueva no genera automáticamente el diseño ni despliega el Worker.
- No crear tablas, alterar el esquema compartido ni ejecutar `db push`, resets o migraciones contra la base compartida desde esta invitación. Si falta una función del contrato, documentar el cambio central necesario.
- Un `projectId` público no es una autorización. Usar las sesiones y permisos documentados en revisión, admin y adjuntos. `/revision` y `/admin` comparten la clave y sesión del cliente; las cuentas personales del equipo pertenecen al panel separado.
- Separar contenido público de invitados, tickets y otros datos privados. No incluirlos en HTML, assets o respuestas públicas.
- El proyecto comienza privado, en borrador o revisión. La publicación pública del proyecto y el estado del RSVP son controles diferentes.
- Las previews usan recursos de prueba. En `/revision`, guardar contenido modifica la revisión real autorizada del proyecto; probar el formulario usa `POST /api/v1/projects/:id/rsvp/test` con sesión válida y nunca escribe respuestas ni envía mails reales. No simular este aislamiento con un parámetro confiado al navegador o con el formulario público dentro de un iframe.

## Modelo obligatorio de respuesta grupal

- Una respuesta corresponde a un grupo. Los nombres de todos los integrantes se escriben juntos en `names`; no dividirlos en personas ni deducir una cantidad a partir del texto.
- Pedir **un email obligatorio de contacto antes de elegir la asistencia**. Ese contacto recibe toda la información de su grupo. El email sigue siendo obligatorio si la respuesta es «no» o «tal vez»; no pedir un mail por integrante.
- Guardar y mostrar «sí», «no» o «tal vez» para el grupo y, cuando corresponda, respuestas del mismo grupo por actividad. Un «no» general no puede conservar actividades confirmadas ni necesidades de asistencia como si el grupo fuera a concurrir.
- Métricas, filtros, exportaciones y cupos cuentan grupos/respuestas, nunca personas inferidas. Sin padrón no mostrar un total de pendientes inventado. El padrón, enlaces nominativos y permisos por integrante son ampliaciones pendientes, no funciones disponibles por defecto.
- El servidor valida email, cierre y cupos. Los reintentos conservan su clave de idempotencia y no crean otra respuesta ni otro correo. Guardar el RSVP y enviar el correo son resultados distintos: informar el estado real de cada uno.

## Funciones obligatorias

- `/revision`: clave del cliente, edición instantánea de campos declarados, historial, detección de conflicto y tickets con contexto del elemento, texto, captura y audio según la implementación disponible.
- `/admin`: respuestas por grupo, nombres conjuntos, email de contacto, restricciones indicadas por el grupo y exportación según módulos habilitados. El panel del equipo ofrece enlaces al sitio; no prometer un ingreso automático entre dominios si el mecanismo todavía no está implementado.
- RSVP grupal con campos específicos del evento, cierre validado por servidor y mensaje «Ya se terminó el tiempo para confirmar». Respetar reapertura manual y reglas por actividad. Admitir varios días y lugares mediante actividades con IDs estables, inicios/fines y cupos de grupos, sin inventar horarios.
- Modo demo automático después del fin del último bloque del evento, según la configuración central.
- En demo, calcular una sola vez por carga `inicio + 30 días` y disminuir el contador. No usar una fecha pasada ni mover el objetivo cada segundo.
- Usar la política central aprobada para fechas visibles de demo. Desplazarlas junto al contador sigue siendo una decisión pendiente: no activarlo por cuenta propia ni cambiar las fechas reales del evento.
- En demo, usar el flujo dedicado: mail de demostración, ningún invitado real ni comprobante, ningún mensaje real al evento. Leads solo si la política está expresamente definida y habilitada.
- Las reglas y el historial de correos pertenecen al panel del equipo y a la misma API/base. La invitación no incorpora credenciales de envío ni configura otro proveedor por su cuenta. El modo inicial `capture` guarda una prueba y no entrega correo; los envíos reales usan el remitente Gmail central confirmado y su contraseña de aplicación guardada como secreto del Worker. No se exige dominio propio; el adaptador Cloudflare con dominio verificado queda como alternativa futura.
- Si un envío o la API falla, mostrar el estado real. «En cola», «capturado», «aceptado» y «entregado al servidor» no equivalen a «leído». No afirmar éxito ni duplicar registros al reintentar.

## Publicación

- Usar el destino Cloudflare registrado. Obtener y verificar `projectId`, repositorio, cuenta y configuración de la invitación independiente.
- Preparar build y preview. Si es un alta nueva, registrar el proyecto de forma idempotente y dejar explícitos los pasos iniciales de dominio/DNS que requieran intervención del equipo.
- La publicación de código a producción necesita aprobación de una persona del equipo sobre la versión exacta, salvo que esa aprobación específica ya conste para esa versión. No solicitar nuevamente una aprobación ya otorgada.
- La primera entrega registra y aprueba versiones exactas y permite verificar el marcador publicado; el publicador aislado y la integración Git automática siguen pendientes. Mientras no existan, preparar la entrega para publicación manual autorizada del equipo. No presentar «aprobar» como «desplegar» ni afirmar que el script inicial impone una barrera técnica que todavía no implementa.
- Cuando el publicador autorizado esté integrado, usarlo sin agregar otro camino automático de publicación que evite la aprobación.
- En una actualización, reutilizar el destino existente. No crear otro Worker/proyecto ni cambiar DNS o dominio para publicar una corrección.
- Después de publicar, verificar URL, versión y funcionamiento real. Si no se puede publicar, entregar la preview y el bloqueo concreto; nunca presentar un build local como deploy.

## Verificación y entrega

Usar las comprobaciones existentes y las necesarias para el cambio. Verificar que el contenido editado sobreviva un rebuild, que un cliente no pueda acceder a otro proyecto, que el servidor respete el cierre y que la demo no cree datos reales. Verificar el email obligatorio antes de elegir asistencia, los nombres conjuntos, los conteos y cupos de grupos y la ausencia de envíos reales en revisión/captura. Revisar al menos un viewport móvil y otro de escritorio, los enlaces y un evento con más de una actividad cuando aplique.

Entregar enlaces reales de preview/producción según disponibilidad, repositorio y revisión, accesos al panel sin revelar claves, campos editables, destino registrado y resultado de comprobaciones. Registrar lo pendiente con precisión.

### Correo de prueba de revisión — decisión vigente

El formulario en `/revision` usa `/rsvp/test`, con sesión del proyecto, para enviar al contacto ingresado un correo marcado PRUEBA/TEST con la misma plantilla visual del RSVP y los datos vigentes del evento/borrador validado. No registra invitados, participaciones ni cupos y no avisa a organizadores. La UI distingue captura, aceptación, entrega y fallo; incluye vista previa aislada. En captura no afirma envío. Reintentos idempotentes no duplican correos.
