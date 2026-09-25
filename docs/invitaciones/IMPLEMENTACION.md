# Entrega local · 24 de septiembre de 2026

> **Estado vigente (25/09/2026):** ver `~/Desktop/otrorayo/docs/invitaciones/HANDOFF.md`. Este documento conserva el contexto histórico; donde lo contradiga (por ejemplo, remitente Gmail SMTP), vale el handoff.

Se aplicó la primera implementación con dos proyectos independientes en el Desktop:

- `/Users/santiagosonzini/Desktop/otrorayo-invitaciones`: equipo + API + esquema compartido D1, archivos R2 y correo.
- `/Users/santiagosonzini/Desktop/valeria-zachary`: diseño recibido adaptado a Cloudflare, formulario, revisión y panel de respuestas.

El README de cada carpeta explica los comandos y el alcance real. El material antiguo del paquete se conserva como archivo en `valeria-zachary/docs/legacy-source.tar.gz`; el paquete original de Downloads permanece intacto. Los proyectos de eventos anteriores no fueron modificados.

## Decisiones implementadas

Un grupo es una respuesta. Integrantes juntos en un campo; email obligatorio de quien anota, antes de indicar asistencia. Recibos y comunicaciones se dirigen únicamente a ese contacto del grupo. No hay conteo automático de personas ni solicitud de mail a cada integrante.

La base nueva tiene grupos, actividades y participaciones, contenido/manifiestos e historial, sesiones/claves, tickets/adjuntos, correo/outbox/intentos/eventos y auditoría. Cada proyecto tiene su propio alcance y secreto de integración. Varias jornadas y lugares se configuran como actividades, con zona horaria, cierres y cupos de grupos. No se inventaron horarios o ceremonias de Valeria & Zachary.

`/revision` y `/admin` comparten la clave del proyecto. El editor permite revisar textos ES/EN, ver diferencias, guardar con control de versión, restaurar historial y crear tickets con contexto/archivos/audio. La prueba de RSVP de revisión nunca escribe invitados reales. El panel del equipo está separado y gestiona proyectos, actividades, tickets, contactos de correo, lotes, historial y accesos.

## Estado de entrega

Construido y probado localmente. El email inicial del equipo, Reply-To y destinatario de avisos es `invitaciones.otrorayo@gmail.com`. La contraseña personal de producción no se definió: se pide sin mostrarla al ejecutar `npm run deploy:setup`, como indicó el usuario.

No se hizo deploy remoto ni se modificaron DNS/bases de eventos anteriores. Las URLs productivas del README son destinos previstos, no sitios ya publicados. La demo y los mails funcionan con captura local. El remitente confirmado es Gmail mediante SMTP; su contraseña de aplicación y la prueba de entrega real quedan pendientes para el deploy. Cloudflare Email Service con dominio propio queda como alternativa futura.

## Límites frente al plan completo

La primera entrega no incorpora padrón/importación/enlaces nominativos, autoservicio del invitado, permisos por integrante, pagos/mesas/transporte/alojamiento, transcripción, política automática de retención o particionado de D1. El panel registra/aprueba versiones y puede verificar el marcador del sitio; el publicador aislado con integración Git y aprobación obligatoria antes del deploy aún requiere su integración específica. No se presenta una aprobación como si fuera una publicación real.

El plan permanece como hoja de ruta. Sus criterios que dependen de servicios o módulos todavía no configurados no se declaran aprobados por haber pasado pruebas locales del núcleo.

## Corrección posterior: correo de prueba en revisión

A pedido del usuario, `/revision` ahora prepara e intenta enviar un correo de prueba con los estilos de la invitación, datos del evento y respuesta del grupo. Tiene vista previa HTML y texto, destinatario y estado comprobado. No crea invitados reales ni avisos al organizador; conserva únicamente el registro del correo de prueba. Usa el borrador visible con versión validada. El entorno local sigue en captura hasta cargar la contraseña de aplicación del remitente Gmail confirmado.

Remitente confirmado: invitaciones.otrorayo@gmail.com. Transporte Gmail SMTP con TLS desde Cloudflare, contraseña de aplicación pendiente para el deploy. No requiere dominio propio. Captura sigue activa localmente; no hay entrega real verificada ni seguimiento automático de rebotes Gmail.

Validación de correo de revisión/Gmail: 58 pruebas aprobadas, builds y TypeScript de ambos proyectos; revisión verificada en navegador con captura y consulta del historial del equipo. No se hizo envío externo ni deploy remoto.

## Dominio propio y remitente (24/09/2026)

`otrorayo.com` pasó a Cloudflare (plan Free; nameservers `sid`/`zelda.ns.cloudflare.com` cargados en DonWeb). Los registros de Vercel (`@` A y `www` CNAME) quedaron en DNS only. Email Sending activo en el dominio raíz (SPF/DKIM/DMARC y rebotes en `cf-bounce`). Email Routing habilitado: `invitaciones@otrorayo.com` reenvía a `invitaciones.otrorayo@gmail.com` una vez verificado ese destino.

El Worker `otrorayo-invitaciones-api` envía con `MAIL_TRANSPORT=cloudflare` (binding `EMAIL`) desde `invitaciones@otrorayo.com` y se sirve en `https://dashboard.otrorayo.com` (dominio personalizado; workers.dev sigue habilitado). El transporte Gmail SMTP queda como alternativa en el código.

## Panel del equipo v2 (25/09/2026)

- **Interfaz**: shadcn/ui + Tailwind v4 con la marca OTRORAYO (fondo #050505, Space Grotesk, colores rayo). Sidebar con grupos Evento / Comunicación / Operación, selector de proyecto y breadcrumb. Proyectos en lista (por defecto) o tarjetas.
- **Vista general**: clave del cliente visible (cada lectura queda auditada), links de la invitación (general, grupos, individual, panel de respuestas) con copiar/abrir individual y «Copiar todo» con texto listo para el cliente.
- **Human / Machine**: píldora abajo al centro. Machine convierte la página a texto plano para agentes y, dentro de un proyecto, agrega la ficha completa (`GET /api/v1/projects/:id/agent`): proyecto, links, clave, respuestas, correo, equipo, actividades, tickets abiertos, textos y las instrucciones del agente. Copiar o descargar `.md`. `?view=machine` la fuerza.
- **Instrucciones para el agente** (system prompt por proyecto): se generan al crear el proyecto con el brief ingresado (carpetas, reglas, deploy) y se editan en Configuración. Columna `projects.agent_brief`.
- **Personas y avisos**: `team_users.role` (admin/member) y `active`; tabla `project_members` con tags `tickets`, `respuestas`, `correo`, `errores`. Los miembros solo ven sus proyectos (API y listas globales filtradas). Avisos: ticket nuevo → tickets; RSVP → respuestas; correo fallido/rebotado → correo; error 500 de la API (máx. 1 por ruta y hora) → errores.
- **Correos y tickets**: del más reciente al más antiguo (cursor `created_at~id`). Correos con pestañas por estado y conteos (enviados / pendientes / con problemas), tipo, búsqueda por destinatario o asunto, rango de fechas y proyecto.
- Migración `0003_members_agent.sql` aplicada en producción. Respaldo previo del código: `.setup-private/backups/otrorayo-invitaciones-antes-shadcn.tgz`.
