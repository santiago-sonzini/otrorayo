# Plan de plataforma de invitaciones y primera entrega: Valeria & Zachary

> **Estado vigente (25/09/2026):** ver `~/Desktop/otrorayo/docs/invitaciones/HANDOFF.md`. Este documento conserva el contexto histórico; donde lo contradiga (por ejemplo, remitente Gmail SMTP), vale el handoff.

Fecha: 24 de septiembre de 2026. Estado: **implementación autorizada el 24/09/2026; primera entrega local construida, despliegue y correo real pendientes de configuración**.

La decisión posterior del usuario prevalece: **integrantes juntos y un único email obligatorio de quien responde, que recibe la información del grupo**. Cuenta inicial del equipo y avisos: `invitaciones.otrorayo@gmail.com`; contraseña de producción definida por el usuario al desplegar. El estado exacto de lo construido y sus límites está en [IMPLEMENTACION.md](IMPLEMENTACION.md). Este plan conserva también etapas futuras; no constituye una lista de funcionalidades ya terminadas.

## 1. Objetivo y alcance acordado

Construir una plataforma de OTRORAYO para las invitaciones nuevas. Valeria & Zachary será la primera implementación real. El equipo tendrá un panel propio; cada invitación tendrá su diseño independiente, una página de revisión para el cliente y su panel de invitados. Compartirán funciones y datos mediante una API central.

Decisiones de esta conversación que prevalecen sobre las alternativas del documento anterior:

- Cloudflare será la plataforma de infraestructura nueva, en la cuenta del usuario.
- Base D1 nueva para las invitaciones futuras. Mariapia y todos los eventos existentes conservan sitios, bases y archivos donde están. No se incluye migrarlos ni conectarlos a este sistema.
- Panel del equipo e invitaciones son proyectos separados, con despliegues independientes.
- Dentro de cada invitación, /revision y /admin comparten credenciales y sesión de cliente.
- El panel del equipo permite ver tickets, revisar correos enviados y configurar qué personas reciben cada comunicación.
- Se necesita un modelo para varios días, actividades, lugares y grupos de invitados.
- Este documento es el entregable actual. Recursos, dominios, endpoints y nombres de proyectos mencionados abajo son propuestas, no servicios creados.

Referencias de producto leídas: [ESTANDAR.md](./ESTANDAR.md), [PROMPT_NUEVA_WEB.md](./PROMPT_NUEVA_WEB.md) y [PROMPT_RESOLVER_TICKET.md](./PROMPT_RESOLVER_TICKET.md). Se recuperan de ellas la edición instantánea, los tickets con captura/audio, el trabajo local con IA, la aprobación humana de código, el cierre de RSVP y la demo posterior. Esas referencias se usan como especificaciones, no como órdenes de ejecutar sus pasos ahora.

## 2. Aplicaciones separadas y una API común

| Producto | Usuarios | Responsabilidad |
| --- | --- | --- |
| Panel OTRORAYO | Equipo | Proyectos, responsables, tickets, publicaciones, correos, accesos, configuración y estado del servicio |
| Invitación pública | Invitados | Diseño del evento, información autorizada y confirmación de asistencia |
| /revision de cada invitación | Cliente y equipo autorizado | Editar contenido, solicitar cambios, ver historial y seguir tickets |
| /admin de cada invitación | Cliente y equipo autorizado | Invitados, respuestas, restricciones, actividades y exportaciones del evento |
| API central | Aplicaciones anteriores | Autenticación, permisos, reglas de negocio, persistencia y procesos de correo |

La API es el punto de integración; una invitación no depende de que el navegador del equipo tenga abierto el dashboard.

Estado del proyecto: borrador → revisión privada → publicado → archivado. Es independiente de si el RSVP está abierto/cerrado y de si la experiencia está en modo real/demo. Antes de la primera publicación, la invitación completa solo se sirve a sesiones autorizadas, también al entrar por dominios alternativos de Workers o previews. Guardar contenido actualiza la versión vigente para revisión; no vuelve público un proyecto privado. La interfaz indica «Guardar cambios» mientras el proyecto es privado y «Guardar y publicar» cuando ya es público.

```mermaid
flowchart LR
  T[Panel del equipo<br/>Proyecto de plataforma] --> API[API central]
  subgraph I[Proyecto independiente: Valeria y Zachary]
    P[Invitación pública]
    R[/revision]
    A[/admin]
    B[Rutas del mismo dominio]
    P --> B
    R --> B
    A --> B
  end
  B --> API
  F[Futuras invitaciones<br/>Repositorios independientes] --> API
  API --> D[(D1: datos de producción)]
  API --> S[R2: archivos privados]
  API --> Q[Cola de trabajo]
  Q --> M[Cloudflare Email Service]
  M --> E[Eventos de entrega]
  E --> D
```

Organización propuesta:

- Repositorio de plataforma: aplicaciones separadas para panel del equipo, API, consumidor de correos y publicador; paquetes compartidos de contrato y SDK. Cada aplicación se despliega por separado.
- Repositorio starter: estructura mínima de invitación y ejemplos del contrato. Se prepara una vez que Valeria & Zachary y un segundo evento de prueba validen el diseño técnico.
- Un repositorio por invitación: Valeria & Zachary y luego los demás. Incluye su diseño y las rutas /revision y /admin mediante componentes compartidos versionados.
- El frontend de una invitación no incluye código del panel global ni credenciales de D1, correo o R2. Su backend tampoco recibe una conexión global a la base: se comunica con la API con alcance limitado al proyecto.
- La web institucional y la aplicación Quest de otrorayo quedan fuera del alcance. Esta carpeta conserva la documentación; no se coloca el dashboard dentro de la aplicación Quest.

Stack propuesto: TypeScript, Workers, D1 y SQL versionado/Drizzle en el backend; React/Vite para el panel del equipo. El paquete de Valeria & Zachary ya usa React y Vinext: primero se prueba su compatibilidad con Workers y se conserva lo que funciona. El SDK expone datos y acciones sin imponer un diseño visual a las invitaciones.

## 3. Decisión de almacenamiento

**Una D1 compartida de producción para todos los módulos nuevos**, con tablas separadas por función: invitados, actividades, contenido, tickets, correos, configuración y auditoría. No crear una base por dashboard: ambos necesitan consultar el mismo evento y mantener coherencia entre una acción y su historial.

**Una D1 distinta para pruebas**, con recursos de archivos y correo de prueba separados. Es separación de ambientes, no una segunda fuente de verdad del negocio.

| Dato | Ubicación propuesta |
| --- | --- |
| Evento, lugares, actividades, grupos y respuestas | D1 |
| Contenido editable e historial | D1 |
| Tickets, conversación, asignación y estados | D1 |
| Reglas de correo, destinatarios, plantilla/versiones, estados e intentos | D1 |
| Capturas, audios, documentos y comprobantes | R2 privado; metadatos y permisos en D1 |
| Copia del cuerpo final de cada correo para consulta histórica | R2 privado; asunto, destinatario, versión y referencia en D1 |
| Credenciales de servicios y clave de cifrado | Secretos de Workers |
| Código, diseño y manifiesto | Git por proyecto |

Los cuerpos de correos de autenticación no conservan enlaces ni claves de acceso recuperables en el historial: se archiva una versión redactada. Los correos operativos conservan la copia enviada; se muestra en una vista aislada sin scripts ni carga automática de recursos remotos.

Las migraciones pertenecen exclusivamente a la plataforma. Una nueva invitación registra configuración y contenido inicial de forma idempotente; no crea tablas ni ejecuta migraciones.

D1 tiene un máximo de 10 GB por base en Workers Paid y cada base procesa consultas de forma secuencial. Se empieza con una base porque simplifica la operación, midiendo tamaño, filas leídas y latencia. Los índices, las consultas paginadas y los archivos fuera de SQL son parte de la primera versión. Si el tamaño o la carga lo justifican, se podrá repartir por grupos de proyectos; no se construye esa distribución de entrada. [Límites oficiales](https://developers.cloudflare.com/d1/platform/limits/)

## 4. Modelo de eventos: varios días, lugares y actividades

Separar tres conceptos:

- **Proyecto:** la invitación digital, su diseño, dominio, versiones y accesos.
- **Evento:** la celebración que se gestiona. Para la primera versión, un proyecto corresponde a un evento, con identificadores separados.
- **Actividad:** cada instancia a la que alguien puede estar invitado: civil, ceremonia, fiesta, bienvenida, brunch u otra. El tipo es configurable; no crear columnas fijas como dia_1, dia_2 o lugar_2.

Una actividad tiene ID estable, nombre por idioma, tipo, lugar, inicio, fin, zona horaria, orden visual, visibilidad, estado, política RSVP, fecha de cierre y cupo opcional. Puede ser informativa sin pedir respuesta o tener confirmación propia. La agenda se agrupa por fecha para mostrarla; el día no limita el modelo.

Un lugar tiene nombre, dirección, enlace de mapa e indicaciones. Varias actividades pueden compartirlo. Puede existir un lugar alternativo sin activarlo; confirmar el cambio lo registra y permite preparar un aviso para las personas afectadas.

Ejemplo exclusivamente ilustrativo, no programa confirmado de Valeria & Zachary:

| Actividad | Día | Lugar | Acceso y respuesta |
| --- | --- | --- | --- |
| Civil | Viernes | Lugar A | Familia y testigos; RSVP propio |
| Ceremonia | Sábado | Lugar B | Personas habilitadas para ceremonia |
| Fiesta | Sábado a domingo | Lugar B | Cupo y RSVP independientes |
| Brunch | Domingo | Lugar C | Invitados seleccionados; respuesta opcional |

Reglas:

- La invitación a una actividad y su respuesta son cosas distintas. Contestar no concede acceso a una actividad privada.
- Las respuestas iniciales a actividades corresponden al grupo completo. Las autorizaciones diferentes por integrante no se implementan mientras los integrantes sean texto libre; un futuro padrón requerirá una decisión explícita.
- Las actividades privadas no se incluyen en el contenido público, HTML inicial, JavaScript compilado, valores iniciales del diseño ni manifiestos entregados al público. Se muestran al presentar una invitación válida; ocultarlas visualmente no constituye protección.
- Inicio y fin son instantes UTC con zona de presentación. Se admite horario por confirmar: sin inventar un horario operativo para cerrar RSVP o activar demo.
- Una fiesta que termina de madrugada usa su fin real. La demo no se activa cuando empieza la fiesta.
- Modificar fecha, cupo o cancelar una actividad conserva respuestas e historial; la interfaz muestra el impacto antes de confirmar. No mueve automáticamente asistentes a otra actividad.
- Las fechas operativas, visibilidad, cupos y políticas quedan bajo control del equipo inicialmente. El cliente puede solicitar cambios desde /revision.

## 5. Invitados, grupos y respuestas — decisión aprobada

Cada respuesta representa un grupo. Los nombres y apellidos de todos sus integrantes se escriben juntos en un único campo de texto, exactamente como pidió el usuario. No se divide el texto ni se generan personas automáticamente.

La persona que completa el formulario deja **un email obligatorio** y funciona como contacto del grupo. Recibe la confirmación y toda comunicación dirigida a ese grupo. Los demás integrantes no necesitan mail. El email se solicita antes de la pregunta de asistencia, también para las respuestas negativas.

Los paneles cuentan respuestas/grupos y participación de grupos por actividad. No muestran una cantidad de personas deducida de los nombres. Los cupos opcionales de esta primera entrega también se expresan en grupos. Dietas, alergias y notas se conservan como texto del grupo; se puede escribir a quién corresponden, sin convertir esa mención en un integrante estructurado.

Se conservan sí/no/tal vez para el grupo y sus actividades, con reintentos idempotentes, historial y correcciones autorizadas. Una respuesta negativa limpia los datos alimentarios que hayan quedado del formulario. La modificación posterior se hace por ahora desde /admin o el panel del equipo.

La primera integración usa enlaces abiertos cuando el proyecto está publicado. No hay padrón precargado y por eso no se inventa un total de pendientes. Un futuro módulo de enlaces nominativos, padrón/importación y autorizaciones por actividad debe mantener el contacto único del grupo. Un padrón individual o un conteo de personas sería una decisión nueva, no una interpretación de la frase con los nombres.

## 6. Página /revision de Valeria & Zachary

La revisión debe mostrar la invitación real con una barra de herramientas y un panel lateral. En celular, las herramientas pueden abrirse como panel inferior.

| Área | Funciones |
| --- | --- |
| Barra superior | Nombre del proyecto, estado, idioma ES/EN, variante singular/plural, vista móvil/escritorio, enlace a /admin y salida |
| Editar contenido | Seleccionar campos permitidos, ver etiqueta, valor, validación y diferencias pendientes |
| Pedir cambio | Seleccionar elemento/sección y crear ticket con texto, captura o audio |
| Mis solicitudes | Lista de tickets del proyecto, comentarios visibles, adjuntos y estado |
| Historial | Cambios antes/después, versión, fecha, identidad de acceso y restauración |
| Probar formulario | Recorrido con datos de prueba, sin confirmaciones reales; correo de prueba con diseño y datos del evento al contacto indicado |

Con el sitio público, el botón será **Guardar y publicar**: mantiene la edición instantánea descrita en el estándar. Mientras el proyecto permanezca en revisión privada será **Guardar cambios**, manteniendo ese acceso privado. Antes de guardar se ven las diferencias; al guardar la API registra una nueva revisión y la web usa el contenido actualizado. Las ediciones sin guardar no son públicas. No requiere build ni aprobación de código.

Toda edición lleva versión base. Si otra sesión cambió el contenido, se muestra qué difiere y se conserva el trabajo local para resolverlo; no hay sobrescritura silenciosa. Restaurar crea una revisión nueva. Un despliegue o rollback de código conserva el contenido vigente.

El cliente podrá editar textos, etiquetas de botones, descripciones, contactos y enlaces declarados por la invitación. El permiso forma parte del contrato validado por servidor. No podrá introducir HTML o JavaScript arbitrario ni modificar claves internas, cierres o permisos.

En el paquete actual, parte de la gráfica está en SVG/imágenes. Habrá que inventariar qué textos están incrustados: se convierten a texto editable si el diseño lo permite, o se marcan como cambios de diseño por ticket. No prometer edición instantánea de texto que siga convertido en curvas o píxeles.

Un manifiesto versionado declara IDs estables de campos, idioma, tipo, límites, permiso y secciones seleccionables. Las fechas visibles operativas se derivan de actividades; evitar que un texto editado contradiga la fecha que usa el cierre.

Distinciones visibles:

- /revision: edición del contenido del evento; guardar publica ese contenido.
- Preview de código: versión candidata del diseño, identificada por commit/artefacto; no es producción.
- Entorno de pruebas: respuestas aisladas; correo real de prueba solo al contacto ingresado y marcado PRUEBA, cuando el remitente esté habilitado. El backend establece el ambiente, no un parámetro modificable por el navegador.

El SDK de revisión usa un contexto de prueba autorizado por servidor para las acciones RSVP y de correo, con rutas que no ejecutan escrituras de invitados en producción. La edición de contenido y los tickets sí se guardan en el proyecto real. No implementar esta separación simplemente incrustando el formulario público en un iframe: se probará expresamente a qué ruta y ambiente llega cada acción.

La sesión compartida del cliente identifica «cliente de Valeria & Zachary». Si escribe su nombre en un comentario se guarda como nombre declarado, no como identidad individual verificada.

## 7. Panel /admin de invitados

Este panel pertenece a cada invitación y solo muestra su evento. No contiene gestión de otros clientes, secretos de infraestructura ni notas internas del equipo.

Pantallas y acciones:

- Resumen: grupos, sí/no/tal vez y pendientes solo si existe padrón y fechas de cierre. Si no existe padrón, explicar que el total de pendientes no está disponible.
- Invitados: búsqueda, filtros por actividad, estado, idioma, grupo, restricciones y fecha de respuesta; paginación.
- Alta de grupos e importación CSV cuando se utilice padrón: vista previa de filas válidas/erróneas y posibles duplicados, sin fusionar personas por compartir nombre o email. Importación repetida identificable y reversible antes de comunicar enlaces.
- Ficha de grupo: nombres de integrantes juntos, contacto, actividades habilitadas, respuestas y cambios, dietas y comentarios.
- Vista por actividad: confirmados y cupo propio; datos útiles para organizar cada jornada.
- Correcciones manuales autorizadas: motivo e historial; no alterar silenciosamente la respuesta que dio la persona.
- Exportación CSV filtrada por actividad o estado, con permisos, registro de descarga y protección contra fórmulas introducidas en celdas. Documentos pesados se generan en segundo plano.
- Comunicaciones relacionadas con invitados del evento: estado y contenido permitido si el equipo habilita ese módulo. Las reglas globales y el envío masivo quedan en el panel del equipo inicialmente.
- Acceso directo a /revision usando la misma sesión.

Mesas, pulseras, transporte, alojamiento, pagos y comprobantes quedan como módulos activables. Se definen relaciones compatibles, pero no se construyen pantallas vacías ni campos obligatorios para servicios que la boda no usa.

## 8. Dashboard del equipo OTRORAYO

Proyecto separado de Valeria & Zachary. Dos cuentas personales iniciales, ambas con acceso a todos los proyectos según el estándar; permisos explícitos para sumar responsables limitados más adelante.

| Sección | Contenido y acciones |
| --- | --- |
| Inicio | Tickets pendientes, revisiones por aprobar, errores de publicación/correo y eventos próximos |
| Proyectos | Cliente, responsable, etapa, dominios, fechas, cierre, enlaces a web/revisión/admin y última publicación |
| Ficha de proyecto | Datos generales, programa, lugares, módulos, idiomas, contactos, permisos y actividad reciente |
| Invitados | Acceso a la misma información de /admin, con alcance de equipo y acciones auditadas |
| Tickets | Bandeja global y por proyecto, asignación, prioridad, conversación, adjuntos y contexto para IA |
| Correos | Historial, detalle, reglas, destinatarios, plantillas, envíos programados y resultados |
| Publicaciones | Preview, commit, contenido compatible, aprobación, despliegue, resultado y recuperación |
| Accesos | Usuarios, clave de cliente, consulta/copia autorizada, rotación y revocación de sesiones |
| Operación | Estado de API/colas, consumo, respaldos, errores y configuración general |

Crear un proyecto propone un flujo guiado: datos del cliente → celebración/actividades → acceso e idiomas → módulos → correo/responsable → registrar repositorio/destino → revisión de configuración. Se puede guardar incompleto; publicar exige completar los datos operativos necesarios.

No generar una nueva web con diseño genérico desde este panel. Cada diseño sigue siendo independiente y desarrollado con agentes; el panel registra y configura su integración.

## 9. Tickets y trabajo con IA

El cliente selecciona un elemento, escribe el cambio y puede adjuntar captura o grabar audio. Guardar proyecto, sección/elemento, idioma, variante, URL, versión de código, revisión de contenido, tamaño de pantalla, autor/sesión y fecha.

Si el navegador no permite capturar, ofrecer adjuntar imagen manualmente. Si no concede micrófono, permitir subir audio o continuar con texto. En canvas/WebGL se seleccionan hotspots o secciones registradas.

Límites iniciales propuestos: imágenes JPEG/PNG/WebP hasta 10 MB; PDF hasta 10 MB; audio hasta 5 minutos y 20 MB; hasta cinco adjuntos por ticket. Validar tipo real, tamaño y proyecto en el servidor. Audios y capturas son privados; los enlaces de lectura vencen y requieren permisos. Transcripción automática queda para una etapa opcional.

Separar dos ciclos, mejorando la lista de estados del estándar:

- Ticket: abierto → en análisis → en trabajo → listo para revisar → resuelto. Estados auxiliares: esperando cliente, cancelado y duplicado; se puede reabrir con motivo.
- Publicación: preparada → pendiente de aprobación → aprobada → publicando → publicada; también fallida o revertida.

Una publicación puede resolver varios tickets y un ticket puede necesitar código más contenido. El ticket se resuelve solo cuando todas sus partes están verificadas. El cliente ve comentarios públicos; las notas internas y discusiones técnicas quedan para el equipo.

Acción **Copiar contexto para IA**: genera pedido, adjuntos autorizados, repositorio, rama/commit base, versiones, contrato y criterios de aceptación. No incluye claves. El material del cliente se identifica como contenido del ticket; no puede convertirse en instrucciones para acceder a otros proyectos o publicar sin permiso.

Al asignar o cambiar de estado se aplica la regla de correo configurada. La bandeja es la fuente de estado aunque el correo falle.

## 10. Correos: destinatarios, envío e historial

### 10.1 Servicio y alcance

Decisión actual confirmada por el usuario: enviar desde **invitaciones.otrorayo@gmail.com**, sin dominio propio, usando SMTP de Gmail con TLS desde el Worker. La contraseña de aplicación se carga como secreto durante el deploy, separada de las claves de los paneles. La DB, API, archivos e historial siguen en Cloudflare. No se agrega una suscripción de correo. [Contraseñas de aplicación de Google](https://support.google.com/accounts/answer/185833?hl=es)

Cloudflare Email Service queda como opción futura si se incorpora un dominio remitente verificado y se validan sus cuotas/habilitación. Sus precios y eventos descritos más abajo son una referencia de esa alternativa, no del Gmail elegido. SMTP aceptado no equivale a entregado/leído; para Gmail no se implementó lectura de rebotes ni eventos de entrega automáticos. Antes de escalar envíos se deben revisar las cuotas reales de la cuenta.
El historial muestra correos emitidos por esta plataforma. No lee la casilla personal del equipo ni importa correos anteriores de otros sistemas.

### 10.2 Reglas automáticas configurables

| Disparador | Destinatarios configurables | Comportamiento propuesto |
| --- | --- | --- |
| Nuevo ticket | Responsable, integrantes seleccionados y contacto del cliente | Aviso al responsable; acuse al cliente opcional |
| Comentario público o solicitud de información | Contacto del cliente y responsable | Nunca enviar notas internas |
| Ticket listo o publicación verificada | Cliente y equipo seleccionado | Enlace a revisión/resultado |
| RSVP recibido o modificado | Contacto del grupo y organizadores elegidos | Copia al contacto obligatorio del grupo |
| Recordatorio de RSVP | Grupos sin respuesta o con respuesta incompleta | Programado, revisando nuevamente el estado antes del envío |
| Cambio de actividad/lugar | Personas habilitadas y afectadas | El equipo revisa contenido y selección antes de enviarlo |
| Error de envío/publicación | Responsable operativo | Mostrar también alerta en el dashboard |
| Demo | Visitante de la demo | Mensaje identificado como prueba; límites propios |

Cada regla tiene activar/desactivar, proyecto, actividad opcional, condición, destinatarios, idioma, plantilla versionada y momento de envío. Los destinatarios pueden ser responsables, contactos del cliente o contactos elegidos; nunca reciben automáticamente permiso al panel por estar en una lista de correo.

Precedencia: configuración general → ajuste por proyecto → ajuste por actividad. La pantalla muestra la regla efectiva. Al cambiar destinatarios de una regla automática, los futuros trabajos usan la nueva configuración; trabajos todavía no enviados se revalidan para evitar notificar a una persona retirada. Esto no amplía silenciosamente un lote manual aprobado. Los mensajes ya aceptados por el proveedor conservan el registro de a quién se enviaron realmente.

### 10.3 Envíos seleccionados desde el equipo

Elegir evento y propósito → filtrar personas/grupos por actividad, idioma y respuesta → elegir destinatarios → ver exclusiones y duplicados → revisar mensaje y cantidad → enviar prueba a un integrante autorizado → confirmar envío o programarlo.

Los envíos son individuales, sin exponer direcciones de otros invitados en Para/CC. El destinatario es siempre el contacto del grupo, según la decisión aprobada. Deduplicar dentro del propósito y grupo; no fusionar automáticamente grupos distintos que comparten un email. Mostrar los casos ambiguos antes de confirmar.

Al confirmar se fija versión de plantilla, selección de destinatarios y contenido relevante. Antes de ejecutar un envío programado se revalida permiso, baja, supresión y condición; una persona que ya confirmó no recibe un recordatorio de pendiente. Esa revalidación solo puede excluir destinatarios de un lote aprobado: agregar o reemplazar personas, cambiar filtro o mensaje requiere una nueva revisión. Si cambian un horario, lugar o cierre utilizados en el mensaje, el lote pendiente se pausa como desactualizado y debe revisarse; no se envía información vieja ni se cambia silenciosamente lo aprobado. Permitir pausar/cancelar lo que aún no fue aceptado por el proveedor.

### 10.4 Registro consultable

Por mensaje/destinatario: proyecto, actividad, grupo/persona o contacto, propósito, asunto, idioma, remitente, Reply-To, origen manual/regla, quién lo inició, versión de plantilla, copia del contenido, hora prevista, intentos, ID del proveedor y últimos estados.

Estados internos: programado, pendiente, procesando, aceptado por el proveedor, entregado al servidor destinatario, demorado, rebotado, rechazado, fallido, cancelado, omitido y resultado incierto. No mostrar «leído» ni «recibido en bandeja principal» sin evidencia. La entrega al servidor no demuestra lectura.

Cloudflare ofrece eventos de entrega, demora, rebote, fallo, rechazo y queja mediante suscripciones a Queues. Se procesan por ID de evento, admitiendo repeticiones y orden diferente. Las entregas a direcciones verificadas de Email Routing no generan esos mismos eventos; cuando no exista evidencia de entrega se mostrará solo el estado comprobado. [Eventos oficiales](https://developers.cloudflare.com/email-service/platform/event-subscriptions/)

El historial propio conserva el mensaje según nuestra política de retención; no depende de la vista temporal del proveedor. Cloudflare documenta que sus previews de correos se conservan aproximadamente siete días. [Logs y previews](https://developers.cloudflare.com/email-service/observability/logs/)

### 10.5 Reintentos y consistencia

RSVP/ticket y la intención de notificar se guardan juntos en D1; un proceso posterior envía el trabajo a Queues. Si cae la cola, la intención pendiente permite recuperarlo. El usuario recibe confirmación de guardado aunque el correo esté pendiente.

Clave única por evento de negocio, propósito, destinatario y contexto de grupo/persona/actividad cuando corresponda; intentos separados del mensaje lógico. No omitir una comunicación legítima porque dos grupos distintos comparten email. Los consumidores reclaman trabajos de forma atómica. Queues entrega al menos una vez, por lo que se debe deduplicar. [Garantías de Queues](https://developers.cloudflare.com/queues/reference/delivery-guarantees/)

No prometer «exactamente un correo» frente a un timeout después de que el proveedor lo haya aceptado. Verificar si la API elegida ofrece idempotencia de envío; si no, un resultado ambiguo queda incierto para conciliación antes de reintentar. Un nuevo envío manual se registra como nueva acción y avisa si ya había uno previo.

Reintentos automáticos solo para fallos temporales conocidos, respetando cuotas y espera. Los rechazos permanentes y bajas se excluyen. Tras agotar intentos, queda visible para el equipo con motivo. La baja de avisos opcionales se gestiona por evento; los rebotes/quejas del proveedor pueden exigir una supresión más amplia. No volver a habilitar un correo rechazado sin revisión.

## 11. Modelo de datos propuesto

Nombres orientativos: se convertirán en esquema concreto durante la primera fase. El núcleo usa columnas tipadas y relaciones. JSON queda para valores de contenido y respuestas personalizadas versionadas, no para esconder toda la gestión en una sola columna.

| Conjunto | Entidades principales |
| --- | --- |
| Equipo y clientes | organizations, team_users, memberships, clients, client_contacts |
| Proyectos y eventos | projects, events, project_domains, project_modules, deployment_targets |
| Accesos | project_credentials, sessions, access_grants |
| Programa | venues, activities, activity_venues |
| Invitaciones | invitation_groups, people, guest_access_tokens, activity_invitations, activity_participants |
| Respuestas | rsvp_submissions, attendance_responses, response_history, dietary_requirements |
| Preguntas variables | form_versions, question_definitions, custom_answers |
| Contenido | content_revisions, content_values, manifest_versions |
| Tickets y archivos | tickets, ticket_comments, ticket_events, files, ticket_files |
| Correo | notification_rules, rule_recipients, template_versions, send_batches, email_messages, email_attempts, email_delivery_events, suppressions |
| Operación y entrega | outbox, idempotency_keys, audit_events, deployments, approvals, deployment_tickets |

Invariantes a implementar y comprobar:

- organization_id y project_id/event_id donde corresponden; las claves foráneas compuestas impiden relacionar entidades de eventos distintos.
- Los nombres, emails y posiciones visuales no son identidades. Los IDs no cambian al editar o reordenar.
- Una respuesta vigente por grupo/actividad; historial separado. Grupo, actividad y cupo deben ser del mismo evento.
- Versiones para contenido, formularios, políticas y plantillas; una respuesta antigua conserva la pregunta que vio aunque se renombre o retire.
- Restricciones SQL y operaciones atómicas para deduplicación, cupos y versión esperada. D1 requiere diseñar estas operaciones con sus capacidades, por ejemplo batches transaccionales; no copiar transacciones interactivas de Prisma/PostgreSQL. [API D1](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- La comprobación de cupo y su actualización condicional pertenecen a la misma operación atómica; leer disponibilidad previamente y escribir después en un batch no basta para impedir sobreventa.
- Archivar una actividad/persona/proyecto no borra silenciosamente sus respuestas, tickets o correos.
- Borrar o anonimizar datos requiere un proceso coherente entre D1, R2, exportaciones y copias, según la política aprobada.
- Datos de prueba nunca se mezclan con producción. El modo demo no se determina por un booleano aceptado ciegamente del cliente.

## 12. API y contrato para futuros proyectos

La API se versiona desde el comienzo. Los siguientes son nombres propuestos, no endpoints implementados.

| Familia | Operaciones ilustrativas | Autorización |
| --- | --- | --- |
| /v1/public/projects/:id | Contenido público y configuración permitida | Registro del proyecto; sin datos privados |
| /v1/guest/session | Canjear token de invitación y obtener actividades habilitadas | Token opaco válido, alcance de grupo |
| /v1/guest/rsvp | Crear/actualizar respuesta | Política pública o sesión de grupo; cierre, cupo e idempotencia |
| /v1/client/session | Ingreso/salida del cliente | Clave de proyecto; límites de intentos |
| /v1/client/content | Leer, editar y restaurar contenido | Sesión del proyecto y versión base |
| /v1/client/tickets | Crear, comentar y consultar tickets | Sesión del proyecto; comentarios públicos |
| /v1/client/guests | Consultar/corregir/exportar invitados | Permisos del panel del evento |
| /v1/client/files | Autorizar carga/lectura de adjuntos | Permisos sobre archivo y entidad relacionada |
| /v1/team/projects | Alta, configuración, actividades y accesos | Cuenta del equipo y rol |
| /v1/team/tickets | Bandeja, asignación y notas internas | Cuenta del equipo |
| /v1/team/mail | Reglas, plantillas, selecciones, envíos y consulta | Permisos de correo |
| /v1/team/releases | Previews, aprobación y publicación | Permiso explícito de publicación |

Reglas comunes: validar contratos en servidor, tamaño de request, paginación por cursor, claves idempotentes en operaciones repetibles, control de versión en ediciones y errores recuperables diferenciados. Usar 401/403 para acceso, 409 para conflicto, 422 para datos inválidos, 429 para límite y 503 para indisponibilidad; la interfaz debe explicar qué puede hacer el usuario.

Las rutas locales del sitio actúan como intermediario hacia la API mediante identidad de servicio limitada y registrada. El proyecto se deriva de esa identidad y de la sesión; cambiar projectId en el navegador nunca da acceso. Se rechazan headers de identidad aportados por el cliente. Las cookies son del propio dominio, HttpOnly/Secure y SameSite; las mutaciones con sesión validan origen y protección CSRF. No depender de cookies de terceros ni presentar CORS como autorización.

No usar caché pública para invitados, permisos, revisión o tickets. El contenido mutable empieza sin caché compartida; assets versionados sí pueden cachearse. Al recuperar foco o cargar la página se obtiene la revisión vigente. El SDK debe gestionar fallos sin fingir éxito y sin reemplazar contenidos por valores iniciales antiguos.

El starter/SDK entrega login, sesión, contenido editable, selección de elementos, tickets, RSVP, /admin, cierre y demo, con validaciones y pruebas de contrato reutilizables. La invitación declara manifiesto y módulos; no vuelve a implementar el backend común.

## 13. Accesos y permisos

| Actor | Alcance |
| --- | --- |
| Equipo administrador | Todos los proyectos; accesos, configuración, correo y publicaciones |
| Responsable limitado, si se incorpora | Proyectos asignados y acciones expresamente habilitadas |
| Cliente con clave de proyecto | /revision y /admin de su proyecto; sin notas internas ni configuración global |
| Invitado identificado | Su grupo, actividades autorizadas y sus respuestas |
| Visitante público | Contenido público y acciones permitidas por la política de ese evento |
| Worker de invitación | API del proyecto registrado; nunca administración global |

El estándar permite mostrar/copiar la clave compartida del cliente. Por eso se almacena cifrada con clave externa a D1 y versión de cifrado, además de un verificador para login. Mostrar, copiar y rotar se audita; la clave no aparece en listados, logs, Git ni URLs. Rotarla revoca sesiones existentes. Las contraseñas personales del equipo solo se almacenan como hashes; proponer segundo factor para las cuentas con publicación/accesos.

Abrir un evento desde el dashboard usa un canje de un solo uso y corta duración, ligado a proyecto, destino y sesión. El acceso queda auditado como equipo; no se suplanta silenciosamente al cliente ni se pasa su clave por URL. Se admiten varias sesiones de cliente, con revocación y expiración.

La configuración de destinatarios de mail es independiente de la configuración de permisos. Enviar una notificación a un organizador no le otorga acceso a datos de todos los invitados.

## 14. Publicación de contenido y de código

| Tipo de cambio | Camino |
| --- | --- |
| Texto/enlace permitido | Guardar y publicar → revisión de contenido → lectura verificada |
| Diseño, estructura, animación o integración | Ticket → rama → pruebas → build/preview → aprobación humana → publicador → verificación |
| Código y contenido juntos | Código compatible aprobado primero; luego parche de contenido con versión base; resolver al verificar ambos |

La aprobación del código está ligada al commit y al hash del artefacto, contrato y versión base de producción. Otro cambio invalida esa aprobación. El publicador registra cuenta/Worker/dominio y reutiliza ese destino; no crea otro sitio por corrección.

Las publicaciones se serializan por proyecto. Si otra publicación avanzó, se requiere integrar y volver a revisar. El ticket no queda resuelto por terminar el código ni por recibir un webhook: debe verificarse la versión real y la salud del sitio.

Las credenciales de producción pertenecen al publicador, separadas del build y del agente. No habilitar un push directo que publique eludiendo la aprobación. La automatización completa se activa después de demostrar este control. Hasta entonces, el equipo puede operar una publicación manual auditada; no presentarla como un control automático ya implementado.

Un fallo conserva tickets pendientes y muestra la causa. Rollback de código reutiliza el destino, comprueba compatibilidad del contenido vigente y no revierte silenciosamente las ediciones del cliente. Restaurar contenido es una operación distinta. Las migraciones centrales usan cambios compatibles por etapas, no resets.

## 15. Cierres, demo y retención

Cierre RSVP por evento o actividad, validado siempre en servidor; reapertura temporal y manual por el equipo con motivo y fecha. Texto inicial del estándar: «Ya se terminó el tiempo para confirmar», con traducción al inglés para Valeria & Zachary.

Demo automática después del fin explícito de la última actividad activa. Si faltan horarios de fin, no inventarlos: el proyecto debe completar su condición de transición. El modo también se calcula al leer/enviar; no depende solo de un cron.

La demo usa un contador de 30 días calculado una vez por carga completa. Sus envíos nunca crean asistentes, mensajes privados del evento ni comprobantes reales. Permite un correo de demostración al visitante mediante un flujo identificado, con límites propios. Captura de leads desactivada hasta que se decida expresamente.

Desplazar fechas visibles para acompañar el contador sigue siendo una propuesta del estándar pendiente de revisión. Si se aprueba, se conserva la separación entre actividades y jamás se cambian las fechas reales de la base.

Política de conservación propuesta para discutir: metadatos de tickets, revisiones, auditoría y correo durante el servicio y 12 meses después del evento; cuerpos de correo y adjuntos privados, 180 días después del evento. Los datos de invitados usan una política específica acordada con el cliente. Es una propuesta de producto, no un requisito legal ni una eliminación autorizada ahora. Antes de automatizar purgas: definir exportación, aviso, restauración y alcance de copias; no borrar por defecto durante el piloto.

Respaldos: recuperación de D1 más exportaciones periódicas privadas con referencias de archivos y prueba de restauración. Una copia dentro de la misma cuenta no protege contra la pérdida completa de esa cuenta; definir una descarga de resguardo cuando se acuerde la política operativa. El equipo ve fallos de respaldo en el panel.

## 16. Alcance específico de Valeria & Zachary

Datos observados en el paquete, pendientes de ratificación como datos definitivos: nombre Valeria & Zachary, español/inglés, variantes singular/plural, 1–3 de octubre de 2027, Pueblo Nativo, Argentina. No se conocen los horarios ni el programa desglosado de civil/ceremonia/fiesta; no se inventarán.

La entrega propuesta conserva sus recursos y estética e incorpora:

1. Registro central del proyecto y conexión al contrato común.
2. Campos editables por idioma, revisión, historial y tickets con audio/captura.
3. /admin con respuestas de grupos/actividades y exportaciones.
4. Formulario con integrantes juntos, email obligatorio de contacto, sí/no/tal vez y respuestas por actividad, con guardado seguro ante reintentos.
5. Módulo de correos e historial en el panel del equipo, con reglas configurables.
6. Fechas de cierre, reapertura y demo según programa confirmado.
7. Preview aislada y publicación al destino Cloudflare propio que se registre.

El formulario del paquete no recogía email. La implementación agrega un **email obligatorio del contacto del grupo**, antes de responder asistencia. No se pide email a los demás integrantes. El contacto recibe toda la información del grupo.

La configuración del paquete menciona un sitio anterior en Sites. Se verifica como referencia de origen, sin modificarlo ni publicar sobre él: el destino nuevo será el registrado en la cuenta propia. Antes de instalar se revisa la integridad de la copia de Desktop; en la copia inicial se omitió la carpeta build y el paquete original la usa para su plugin de Vite, por lo que hay que recuperarla del original o sustituir expresamente esa dependencia al adaptar el hosting.

## 17. Fases y entregables verificables

| Fase | Entregable | Condición para continuar |
| --- | --- | --- |
| 0. Cerrar especificación | Este plan revisado, alcance de formularios, programa, contactos y módulos | Decisiones de producto identificadas y entorno/destino previsto |
| 1. Prueba de infraestructura | Worker de prueba, D1, R2, correo y eventos de entrega en la cuenta propia | Compatibilidad, acceso, cuotas y estados de correo comprobados sin datos reales |
| 2. Núcleo de plataforma | Repositorio central, migraciones, contrato, sesiones, permisos, actividades y contenido | Dos proyectos de prueba aislados; sin acceso cruzado |
| 3. Revisión y tickets | /revision real de Valeria & Zachary y bandeja de equipo | Guardado instantáneo, conflicto, historial, audio/captura y notas privadas verificados |
| 4. RSVP y panel del evento | Grupos, varias actividades, /admin, cierre y CSV | Conteos correctos, permisos/cupos y reintentos probados |
| 5. Comunicación | Reglas, selección, plantillas ES/EN, cola e historial | Recibos/eventos de correo reales de prueba; sin duplicados conocidos ni falsos entregados |
| 6. Entrega de código | Registro de versiones, preview, aprobación, publicador y recuperación | Nueva versión no pisa contenido; aprobaciones viejas y destinos incorrectos rechazados |
| 7. Piloto y estándar | Valeria & Zachary revisable de punta a punta; starter/SDK documentado | Aceptación funcional y segundo evento ficticio con civil, fiesta y brunch |
| 8. Publicación | Dominio, configuración final y pruebas operativas | Revisión humana de la entrega concreta y verificación del resultado publicado |

El panel del equipo se construye incrementalmente en las fases 2–6; no se deja tickets o correos sin interfaz hasta el final. No se asignan fechas de entrega sin conocer acceso, requisitos pendientes y resultado de la prueba técnica.

Módulos posteriores, fuera de la primera entrega salvo necesidad concreta: pagos y conciliación, mesas/pulseras, transporte/hotelería, transcripción IA, entrada de tickets por email, permisos avanzados de proveedores y reparto automático entre bases. Su incorporación usa IDs y contrato, sin obligar a todas las invitaciones a mostrarlos.

## 18. Pruebas de aceptación del conjunto

1. El cliente entra una vez y navega entre /revision y /admin; no accede a otro proyecto alterando URLs, IDs o adjuntos.
2. El panel del equipo funciona y se despliega de forma independiente del sitio de la boda.
3. Guardar contenido publica el idioma/campo correcto; conflicto entre sesiones visible; rebuild conserva la edición.
4. Texto gráfico no editable se identifica como ticket, sin aparentar que se guardó un cambio inexistente.
5. El ticket conserva el elemento, idioma y versiones que vio el cliente; notas internas no se filtran.
6. Audio/capturas funcionan en móvil o presentan alternativa cuando faltan permisos; enlaces privados vencidos no dan acceso.
7. Una actividad privada no se expone ni acepta respuestas desde el formulario abierto. Autorizar algunos grupos a ella requiere el futuro módulo de padrón.
8. Un grupo que asiste a tres actividades sigue siendo una respuesta grupal; solo el contacto proporciona email, incluso si hay menores o acompañantes.
9. Sí/no/tal vez producen conteos de grupos correctos; no se infieren personas ni pendientes sin padrón.
10. Doble clic, recarga y reintento tras corte no duplican la respuesta; cambiar el contenido del mismo intento produce conflicto.
11. Dos reservas simultáneas del último cupo no lo exceden. Un cierre ocurrido con el formulario abierto se respeta al enviar.
12. Un fallo de correo mantiene el RSVP/ticket guardado. Un timeout ambiguo no provoca un reenvío ciego.
13. Cambiar responsables/destinatarios afecta los envíos futuros y se audita; se conserva el destinatario histórico real.
14. Recordatorios pendientes omiten personas que ya respondieron; las bajas y supresiones se respetan.
15. Eventos de correo repetidos o fuera de orden no duplican envíos ni degradan un estado final sin evidencia.
16. La pantalla distingue aceptado, entregado al servidor y desconocido; no inventa lectura ni entrega para Routing sin eventos.
17. Revisión y previews no escriben invitados; la prueba explícita sí manda un correo marcado PRUEBA al contacto ingresado con diseño/datos del evento. El servidor impide saltarse esto desde el navegador.
18. Aprobar un artefacto no aprueba cambios posteriores; publicación fallida no resuelve tickets.
19. Una fiesta hasta el domingo de madrugada y un brunch posterior retrasan la demo hasta su fin real.
20. La demo no crea invitados reales y los leads siguen desactivados.
21. Exportación, respaldo y restauración se comprueban con un evento ficticio; los existentes no reciben cambios.
22. Pantallas principales funcionan en móvil/escritorio, teclado y ambos idiomas; estados vacíos/error son explícitos.
23. Un sitio externo no puede guardar cambios ni iniciar envíos usando una sesión válida del usuario; los controles de origen/CSRF rechazan la operación.
24. Un cambio de lugar/horario pausa un lote pendiente que usa ese dato; las revalidaciones no agregan destinatarios a un lote aprobado.
25. Un proyecto en revisión privada no expone la invitación por un dominio alternativo; las actividades privadas no aparecen en assets públicos.

## 19. Costos y límites que condicionan el plan

Referencias consultadas el 24/09/2026; no equivalen a un presupuesto cerrado ni a cuotas comprobadas en la cuenta.

| Servicio | Referencia actual |
| --- | --- |
| Workers Paid | Desde USD 5/mes por cuenta; incluye cuotas de solicitudes y CPU, con excedentes. [Precios](https://developers.cloudflare.com/workers/platform/pricing/) |
| D1 Paid | Incluye 5 GB totales, 25.000 millones de filas leídas/mes y 50 millones escritas/mes; exceso facturable. [Precios](https://developers.cloudflare.com/d1/platform/pricing/) |
| R2 Standard | Cuotas gratuitas y cobro por almacenamiento/operaciones adicionales. [Precios](https://developers.cloudflare.com/r2/pricing/) |
| Email Service (alternativa futura) | Workers Paid incluye 3.000 correos/mes por cuenta; luego USD 0,35 por 1.000. [Precios](https://developers.cloudflare.com/email-service/platform/pricing/) |
| Queues | Costos según operaciones; considerar escritura, lectura, borrado y reintentos. [Precios](https://developers.cloudflare.com/queues/platform/pricing/) |

Para la alternativa Email Service, el límite diario de envío de una cuenta nueva puede ser menor al volumen que su cuota mensual permite; se debe verificar antes de programar recordatorios. Tener un dominio remitente configurado permite enviar a destinatarios externos, sujeto a las cuotas de la cuenta. [Límites de correo](https://developers.cloudflare.com/email-service/platform/limits/)

Una plataforma implica una cuenta para la infraestructura nueva, pero varios servicios medidos. Dominios, herramientas de IA, posibles servicios externos futuros y costos de sistemas existentes no están incluidos en esos USD 5. El panel debería mostrar consumo y permitir pausar envíos de prueba o lotes al alcanzar un presupuesto operativo configurado.

Si Email Service no cumple las pruebas de disponibilidad, cuotas o entrega del piloto, la decisión se vuelve a revisar antes de lanzar. No contratar silenciosamente otro proveedor: el adaptador de correo permite cambiarlo si se aprueba, sin rehacer los paneles.

## 20. Decisiones de producto para revisar antes de implementar

| Punto | Propuesta inicial |
| --- | --- |
| Confirmaciones de Valeria & Zachary | Mantener enlace abierto al inicio, salvo aprobación de padrón y enlaces por grupo |
| Integrantes en formulario plural | **Aprobado:** todos juntos en un campo; métricas por grupo |
| Email del invitado | **Aprobado:** obligatorio solo para quien anota; recibe toda la información del grupo |
| Programa real | Confirmar actividades, lugares, horarios, fin y cierre; no deducirlos del rango 1–3 de octubre |
| Edición del cliente | Guardar y publicar para campos permitidos; fechas operativas y estructura bajo equipo |
| Envíos | Reglas configurables más selección/revisión previa del equipo para lotes |
| Permisos del cliente sobre correos | Ver comunicaciones permitidas del evento; configuración y lotes en equipo |
| Demo | Conservar regla del estándar; decidir desplazamiento de fechas; leads desactivados |
| Retención | Aprobar plazos antes de cualquier borrado automático |
| Servicios opcionales | Activar solo lo que usa la boda; pagos/transporte/mesas pueden incorporarse después |

No se requiere responder todo para revisar la arquitectura. Estos puntos se resuelven al aprobar la primera fase, antes de modificar formularios, configurar envíos reales o publicar.
