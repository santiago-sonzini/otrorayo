# OTRORAYO

Landing en HTML, CSS y JavaScript nativos. Canvas 2D para la entrada, el hero y la escena conceptual del evento. Sin librerías de animación, bundler ni dependencias de frontend. El brief original permanece en `PROMPT_MAESTRO.md`.

## Ejecutar

Desde la raíz del proyecto:

```sh
python3 server/server.py
```

Abrir http://127.0.0.1:4173/. La entrada completa se reproduce en cada apertura o recarga, con o sin `?intro=1`; ya no depende del almacenamiento de sesión. Las pestañas ocultas esperan para empezar y la entrada se pausa al pasar a segundo plano. La vista previa necesita este servidor para enviar consultas; abrir HTML directamente o servirlo con `python -m http.server` sólo permite ver la interfaz.

## Entrada y escenas

- Entrada de 7,2 segundos. Dos corrientes de cinco filamentos recorren el fondo negro y convergen antes de revelar el logo blanco con placa posterior de vidrio. Se eliminaron la nube de partículas de colores, las estelas y el pulso circular. El cielo tenue del hero se conserva.
- “Experience design studio” y “Cada evento, su propio fenómeno” se presentan en blanco, con mayor tamaño y cerca de dos segundos por frase. Revelado por palabras inspirado en [Split Reveal](https://motion.dev/ui/components/split-reveal), implementado con CSS propio.
- El cielo del hero se mueve durante la entrada. El fondo, el logo y la interfaz se revelan por separado. OTRORAYO es el wordmark real del hero: no se sustituye al cerrar el overlay.
- El logo de entrada termina en la posición, tamaño y reloj del renderer del hero. El overlay ya es transparente al retirarlo.
- Se retiraron los botones “Pausar efectos” y “Repetir intro” del hero y footer. Se retiró el botón “Saltar intro”; Escape sigue disponible y `prefers-reduced-motion` muestra un reveal de 300 ms.
- El logo tiene una cara blanca opaca biselada y una placa transparente posterior, con espesor discreto. Una luz suave del fondo y los reflejos del borde comparten fase: normales extraídas de la máscara, iluminación difusa/especular, Fresnel aproximado y dispersión cromática localizada. Es una aproximación visual en Canvas 2D, no un trazador de rayos. La entrada y el hero comparten material y reloj para evitar cambios al acoplarse.
- El hero conserva estrellas, galaxias tenues y planos líquidos sutiles. El resto del recorrido comparte líneas de color que cambian de perspectiva con el scroll.
- Los efectos se detienen con la pestaña oculta o el modal abierto. Las escenas decorativas no contienen información necesaria para entender el sitio.

La intro y el recorrido dibujan sólo filamentos de color, sin paredes de túnel. El material del logo y el cielo tenue del hero se conservan.

## Tipografías y scroll

`tipografias.html` compara Space Grotesk, Sora, Manrope y Syne + Manrope con el mismo contenido. “Probar en la web” abre la landing con `?typeface=...`. Space Grotesk es ahora la fuente predeterminada por elección del usuario; los parámetros siguen permitiendo comparar alternativas sin cambiar ese valor. Las cuatro fuentes variables se sirven localmente en WOFF2 latino; las licencias OFL están en `assets/fonts/`. Space Grotesk se precarga localmente.

La página tiene cuatro secciones: inicio, experiencias, invitaciones y contacto. `journey.js` convierte el scroll nativo en un recorrido de cámara continuo: el logo se aproxima y se desvanece, las líneas de color aparecen, la perspectiva cambia detrás de las invitaciones y los filamentos acompañan el contacto. Los textos mantienen su lectura normal; no se inclinan ni se fijan paneles superpuestos.

`journey.js` proyecta dos grupos de líneas de cinco colores en Canvas 2D. Movimiento reducido usa una vista inmóvil. No hay paredes, aros, suelo ni personas en el recorrido. El prototipo `journey-space.js` está desconectado y no se carga en la landing.

La propuesta de cuatro mundos de v18 y el scroll por superposición fueron retirados. `section-worlds.*`, `scroll-scenes.js` y `event-scene.js` se conservan como prototipos; no controlan el recorrido actual.

## Identidad e invitaciones

Logo auténtico de Instagram en `assets/images/otrorayo-instagram.jpg`. Se recorta y obtiene su máscara en memoria; el original no se modifica. Paleta: `#ee3825`, `#ff6b0b`, `#fec306`, `#77bd20`, `#188ad9`. Los controles conservan vidrio oscuro, bordes blancos y el detalle inferior de cinco colores.

Las invitaciones son renders reales y artículos sin enlaces, redirecciones ni menciones a links:

- María Pía XV: render del proyecto local proporcionado.
- Macarena y Gastón: render del proyecto local proporcionado.
- Amper 50 años: captura móvil de https://www.amper50.com/ a 390 × 844 px. Archivo `assets/images/amper50-real.png`.

Los originales no se modificaron. Constanza ya no aparece en la galería. En móvil se recorren con scroll horizontal nativo.

## Consultas y correo privado

Todos los CTA de consulta abren un modal de tres pasos:

1. Nombre, WhatsApp, tipo de evento, fecha aproximada, ciudad e invitados.
2. Selección múltiple de experiencias con animación propia.
3. Presupuesto orientativo de 500 a 10.000 USD y email opcional.

Los pasos se representan con una barra de cinco colores, sin números, rótulos ni logo en la cabecera. “Enviar consulta” llama a `POST /api/contact`. Sólo muestra confirmación después de que el servidor SMTP acepta el mensaje. Si falla, conserva los datos, permite reintentar y ofrece WhatsApp. El resumen también puede copiarse o continuar por WhatsApp al número autorizado `+54 9 3536 56-3678`.

`../server/server.py` reutiliza el mecanismo Gmail SMTP de Sanigas (puerto 587, STARTTLS, usuario y contraseña de aplicación) mediante la biblioteca estándar de Python. El uso de la misma cuenta fue autorizado expresamente. La conexión y autenticación se verificaron sin enviar correos de prueba.

La configuración privada está en `../server/.env`, fuera de la carpeta pública, con permisos 600 e ignorada por Git:

- `SMTP_USER`, `SMTP_PASS`: remitente y contraseña de aplicación.
- `CONTACT_TO`: destinatario privado indicado por el usuario; nunca se incluye en el HTML, JavaScript, respuestas API o archivos para buscadores.
- `SITE_URL=https://otrorayo.com`.
- Opcionales: `HOST` y `PORT`; por defecto `127.0.0.1:4173`.

El servidor valida campos y límites, escapa el HTML del correo, limita solicitudes por IP, comprueba Origin y usa un campo trampa. Una clave por consulta evita reenvíos duplicados durante una hora en el mismo proceso. No almacena el contenido en disco ni lo imprime en logs. La limitación de solicitudes y la deduplicación son locales al proceso; usar almacenamiento compartido si se escala a varias instancias. No modificar ni publicar el `.env` de Sanigas.

## SEO y lectura por agentes

Dominio confirmado: https://otrorayo.com/.

- Título y descripción orientados a experiencias inmersivas, eventos e invitaciones web.
- Canonical, Open Graph y Twitter con URLs absolutas; imagen social real de marca de 1200 × 630 px en `assets/images/otrorayo-social.png`.
- JSON-LD con Organization, WebSite, WebPage y catálogo de servicios, teléfono e Instagram oficiales. No incluye precios inventados, reseñas ni datos privados.
- `robots.txt` permite rastreo público y excluye el endpoint y el comparador de prototipos.
- `sitemap.xml` incluye la landing canónica.
- `llms.txt` ofrece una descripción factual y enlaces oficiales para lectores automatizados; no garantiza visibilidad ni ranking.
- Contenido comercial en HTML semántico legible sin ejecutar Canvas. No hay texto oculto ni palabras clave añadidas de forma artificial.

Fuentes: [Google Search Central sobre funciones de IA](https://developers.google.com/search/docs/appearance/ai-features) y [documentación de crawlers de OpenAI](https://developers.openai.com/api/docs/bots). Las bases SEO sirven también para búsqueda con IA; no existe una garantía de posicionamiento por agregar un archivo o marcado específico.

## Publicación

La configuración de Vercel está en la raíz del repositorio: `vercel.json`, `api/contact.py` y `scripts/build_static.py`. Importar la raíz completa; el build copia únicamente archivos públicos y la función reutiliza el backend de consultas. Configurar las variables indicadas en el README raíz. El servidor local se mantiene para desarrollo. Ningún archivo privado, README o brief se copia a la salida pública.

Al publicar, comprobar las URLs de producción y enviar `https://otrorayo.com/sitemap.xml` a Search Console. La indexación y el posicionamiento requieren que el sitio esté publicado y rastreable; no se solicitó indexación ni se hizo un despliegue externo en esta sesión.

## Verificación

```sh
python3 -m unittest discover -s server/tests -v
```

Pruebas de backend con entrega SMTP simulada: validación, origen, campos trampa, límites, reintento ante fallo, deduplicación, template escapado y bloqueo de archivos privados. Las pruebas nunca envían mensajes reales.

Verificado en Chromium a 360, 390 y 1440 px: secuencia de texto, fondo en movimiento durante la transición, salida al hero, eliminación de controles, render de Amper sin navegación, metadatos, validación del contacto, error/reintento y confirmación con entrega simulada, WhatsApp y movimiento reducido. También se comprobaron las cuatro tipografías en la landing, la barra de progreso, WhatsApp obligatorio, email opcional y el desvanecimiento al scrollear con restauración al volver arriba. La entrada sin partículas, la estructura reducida y el scroll por superposición y el material de vidrio posterior se verificaron a 390 y 1440 px, con movimiento reducido y Space Grotesk cargada. Sin errores JavaScript ni overflow horizontal. Las revisiones anteriores verificaron también el modal a 360 y 768 px y el túnel a 3840 × 2160 px.

## Archivos

- `index.html`: contenido, modal, SEO y datos estructurados.
- `script.js`: navegación, coordinación de escenas, secuencia de entrada y configuración pública.
- `cosmic-scene.js`, `cosmic-background.js`: entrada, material del logo y cielo.
- `journey.js`, `journey.css`: recorrido continuo de líneas de color.
- `contact-modal.js`, `contact-modal.css`: formulario y envío.
- `styles.css`, `immersive.css`, `glass.css`, `neon.css`, `cosmic.css`, `spatial.js`: presentación e interacción.
- `../server/server.py`: servidor estático y endpoint privado SMTP.
- `../server/.env.example`: nombres de configuración, sin credenciales.

`direcciones.html` y sus módulos conservan las propuestas originales. `scene.js` y `particles.js` son históricos y la landing ya no los carga.

Revisión del recorrido continuo: Chromium a 390 y 1440 px, cuatro secciones, intro completa, modal, movimiento reducido y ausencia de desbordes horizontales y errores JavaScript.

### Ajustes de interacción (v21)

- Los botones no siguen al puntero. El CTA de experiencias conserva un contorno blanco, forma redondeada y acento inferior de color.
- El CTA de la navbar se revela cuando el del hero empieza a quedar detrás de la cabecera; al volver arriba se oculta también para teclado y lectores de pantalla.
- La intro bloquea rueda, gestos táctiles y teclas de desplazamiento, y vuelve inerte el contenido de fondo. El bloqueo se retira al terminar, saltar o salir por error; también en movimiento reducido.
- Las paredes de la intro y del recorrido usan líquido casi negro. Se redujeron los reflejos blancos y los colores del recorrido quedan en destellos tenues.

### Simplificación visual (v22)

Se retiraron las paredes líquidas de la intro y del scroll. Ambas animaciones conservan sólo los filamentos de colores; la intro mantiene la formación del logo y su transición al hero. La landing ya no carga el shader WebGL del túnel.

### Composición y recarga (v24)

La sección de experiencias incluye tres ilustraciones seleccionables (realidad virtual, visuales e interacción). Tras revisar la propuesta, se restauraron los filamentos con perspectiva y avance de cámara de v23. Se retiró el recorrido de líneas por los bordes; se mantienen las mejoras de contenido y de la intro. La frase de la intro tiene un área propia bajo el logo y sale antes de que éste se acople al hero. Se evitó la mezcla aditiva de los cinco rayos al converger.

`page-start.js` desactiva la restauración automática de scroll antes del layout. Una recarga elimina el fragmento de navegación y vuelve a `scrollY = 0`, incluso si antes se estaba en invitaciones o contacto. Los enlaces internos siguen funcionando durante la navegación normal.

### Imagen de producto

La imagen transparente de Meta Quest 3S en `assets/images/meta-quest-3s.webp` proviene de la [página oficial de Meta](https://www.meta.com/quest/quest-3s/). [Archivo original](https://lookaside.fbsbx.com/elementpath/media/?media_id=460446796890038&transcode_extension=webp&version=1725492442). Marca e imagen pertenecen a Meta.
