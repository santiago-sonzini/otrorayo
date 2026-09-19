# PROMPT MAESTRO — LANDING OTRORAYO

Quiero que diseñes e implementes dentro de la carpeta `/landing` una landing page completa, lista para abrir localmente y publicar como sitio estático, para **OTRORAYO**, un *experience design studio* que crea experiencias únicas para eventos.

No quiero una propuesta, un wireframe ni una explicación: **quiero que escribas la implementación real**. Antes de empezar, inspeccioná todo lo que ya exista dentro de `/landing` y preservá cualquier recurso útil. Si la carpeta está vacía, creá la estructura indicada abajo.

## Resultado que buscamos

La página tiene que provocar dos sensaciones consecutivas:

1. **Impacto:** una apertura cinematográfica, breve y memorable, protagonizada por un rayo blanco que parte la oscuridad y da origen al logo de OTRORAYO en una explosión de color.
2. **Deseo y confianza:** inmediatamente después, una experiencia de navegación clara y comercial que deje una idea muy simple: **“Hacemos que tu evento sea único.”**

La landing debe convertir consultas de personas que están organizando fiestas de 15, casamientos, celebraciones privadas y eventos de marca. La realidad virtual es el servicio destacado y el gran diferencial actual, pero OTRORAYO no debe parecer una empresa que solo alquila visores: diseña fenómenos completos para eventos mediante ideas, tecnología, visuales, IA, contenido, juegos interactivos, pulseras inteligentes e invitaciones web personalizadas.

## Contexto de marca

Usar como fuente conceptual el perfil oficial: `https://www.instagram.com/otrorayo/`.

Datos de identidad ya observados:

- Nombre: **OTRORAYO**.
- Descriptor: **Experience design studio**.
- Frase de marca existente: **“Cada evento, su propio fenómeno.”**
- Territorio de servicios comunicado: pulseras inteligentes, visuales, IA y contenido.
- Identidad actual: fondo negro, logo blanco, círculo incompleto atravesado por una diagonal/rayo, estética nocturna y contemporánea.

El lockup verbal oficial debe aparecer, respetando exactamente estas dos líneas y sin traducirlas ni reformularlas:

> Experience design studio  
> Cada evento, su propio fenómeno

Usarlo como firma de marca en el hero y/o junto al logo. **“Hacemos que tu evento sea único.”** es la promesa comercial principal de esta landing; no reemplaza el lockup oficial.

No inventar premios, clientes, testimonios, cantidad de eventos, años de experiencia ni métricas. No usar logos de terceros. Si faltan fotos o videos reales, construir una experiencia visual abstracta de alto nivel y dejar slots bien diseñados y documentados para reemplazarlos luego; no usar imágenes genéricas de banco que hagan parecer a OTRORAYO una empresa de cotillón.

## Restricción tecnológica no negociable

La página debe estar hecha solo con:

- HTML5 semántico.
- CSS moderno.
- JavaScript vanilla.
- SVG inline y Canvas 2D cuando hagan falta.

No usar React, Vue, Svelte, Astro, Tailwind, Bootstrap, jQuery, GSAP, Three.js, npm, bundlers ni dependencias externas de JavaScript. No requerir instalación ni compilación. Debe funcionar abriendo `index.html` y también desde cualquier hosting estático.

Estructura mínima:

```text
landing/
├── index.html
├── styles.css
├── script.js
├── assets/
│   ├── images/
│   ├── video/
│   └── icons/
└── README.md
```

El HTML, CSS y JS deben estar separados y ordenados. Los recursos visuales esenciales que puedan resolverse como SVG deben estar dentro del propio HTML o en `assets/icons/`. No incrustar enormes blobs base64.

## Dirección de arte

La estética general es **dark, premium, eléctrica, inmersiva y editorial**. Debe sentirse como el sitio de un estudio creativo que diseña experiencias, no como una plantilla SaaS ni una web de salón de fiestas.

### Paleta sugerida

- Negro casi absoluto: `#050505`.
- Negro elevado: `#0C0C0F`.
- Blanco limpio: `#F7F7F2`.
- Gris secundario: `#A7A7B0`.
- Cyan eléctrico: `#00E7FF`.
- Violeta intenso: `#7950FF`.
- Magenta: `#FF2DAA`.
- Naranja/ámbar para destellos: `#FF8A1F`.

Los colores vivos aparecen como energía, refracción, reflejos y acentos; nunca como bloques infantiles ni como un arcoíris permanente. El estado estable del sitio debe seguir siendo predominantemente negro y blanco.

### Tipografía y composición

- Tipografía sans serif de alto impacto, usando una pila local/sistema para no depender de Google Fonts.
- Titulares muy grandes con `clamp()`, compactos y con fuerte jerarquía.
- Texto editorial, breve, con bastante aire.
- Layout asimétrico pero legible.
- Bordes finos, líneas técnicas, grillas apenas visibles y halos de color controlados.
- Usar mayúsculas en etiquetas y microcopy, no en párrafos completos.
- Evitar glassmorphism genérico, blobs aleatorios, tarjetas idénticas por todas partes y estética “AI startup”.

## La apertura épica: storyboard obligatorio

Crear una intro a pantalla completa sobre fondo negro. Debe estar construida con SVG, CSS y/o Canvas 2D, correr fluida y finalizar en un máximo aproximado de **3,6 segundos**. El hero real debe existir y renderizarse desde el primer momento detrás de la intro; la animación es una capa de presentación, no una pantalla de carga falsa.

### Secuencia

**0,00–0,35 s — Tensión**

- Pantalla negra con una viñeta muy sutil y un mínimo pulso luminoso central.
- Aparecen pequeñas interferencias o partículas casi imperceptibles.
- No agregar audio automático.

**0,35–1,10 s — El rayo**

- Un rayo blanco, afilado e irregular, entra desde el cuadrante superior izquierdo y cruza hacia el inferior derecho.
- La línea principal debe sentirse dibujada por energía real: núcleo blanco, bloom controlado, ramas secundarias y un pequeño temblor.
- Evitar que parezca una simple línea CSS rotada.
- Puede usarse un SVG con `stroke-dasharray`/`stroke-dashoffset` y pequeñas variaciones predefinidas, más un halo en Canvas o pseudo-elementos.

**1,10–1,55 s — Fractura e impacto**

- Al atravesar el centro, el rayo “parte” el espacio y produce un flash blanco brevísimo, nunca una pantalla blanca larga.
- Desde el punto de impacto nace una explosión cromática con cyan, violeta, magenta y ámbar: partículas, arcos, filamentos y aberración cromática.
- La explosión debe expandirse y perder energía rápidamente; no debe convertirse en un fondo ruidoso permanente.

**1,45–2,45 s — Nace el logo**

- La energía dibuja un círculo blanco incompleto alrededor del centro.
- El rayo diagonal se estabiliza y se integra en el símbolo de OTRORAYO.
- El logo termina nítido, blanco y centrado. Idealmente construirlo como SVG editable y no como PNG.
- Si no existe el archivo oficial del logo, crear una aproximación geométrica fiel al signo observado y dejarla identificada en el README como recurso provisorio que debe ser reemplazado por el vector oficial.

**2,45–3,60 s — Transición al hero**

- Las partículas se apagan o migran hacia los bordes.
- El símbolo reduce su escala y encuentra una posición coherente dentro del hero o el header.
- Entran el titular, el subtítulo y los CTA con una secuencia corta y firme.
- La intro se elimina del flujo y libera por completo interacción y scroll.

### Reglas de UX de la intro

- Mostrar un control discreto **“Saltar intro”** a partir de los primeros 500 ms.
- El botón debe ser usable con teclado y touch.
- Guardar en `sessionStorage` que la intro ya se reprodujo, para no obligar a verla otra vez en la misma sesión. En siguientes vistas de la sesión, hacer un reveal rápido de 250–400 ms.
- Ofrecer un botón pequeño y accesible **“Repetir intro”** cerca del hero o footer.
- Si `prefers-reduced-motion: reduce` está activo, no ejecutar rayos, flashes, parallax ni partículas: mostrar el logo con un fade suave y revelar el hero en menos de 400 ms.
- Nunca bloquear la página por un error de JavaScript. Agregar un *failsafe* que quite la intro antes de los 4,5 segundos.
- No provocar flashes repetidos. Usar un solo flash corto y moderado para reducir riesgo fotosensible.
- No capturar ni reemplazar el scroll nativo.

## Rendimiento de la animación en mobile

Mobile es prioritario, no una adaptación posterior.

- Diseñar primero para 360–430 px de ancho y luego escalar a desktop.
- Limitar el `devicePixelRatio` efectivo del Canvas para evitar sobrecarga: aproximadamente 1,5 en mobile y 2 en desktop.
- Usar un máximo orientativo de 60–90 partículas en mobile y 140–180 en desktop.
- Animar principalmente `transform` y `opacity`.
- Evitar blur masivo en pantalla completa. Simular glow con pocas capas, gradientes radiales y `filter` acotado.
- Pausar `requestAnimationFrame` cuando la pestaña no está visible y detenerlo por completo al finalizar la intro.
- Reducir efectos si hay pocos núcleos de CPU, modo de ahorro o viewport pequeño.
- Todas las posiciones del Canvas y SVG deben recalcularse al cambiar orientación sin deformar el símbolo.
- Respetar `safe-area-inset-*` en iPhone.

## Estructura de la landing y copy base

Implementar una sola página con narrativa de conversión. El copy puede pulirse, pero debe conservar este tono: directo, seguro, creativo, en español argentino natural, sin grandilocuencia vacía.

### 1. Header

- Logo/símbolo OTRORAYO a la izquierda.
- Navegación corta: `Experiencias`, `Realidad virtual`, `Invitación web`, `Cómo trabajamos`.
- CTA destacado: **“Contanos tu idea”**.
- En mobile: header compacto, CTA siempre visible y menú accesible. El menú debe abrir/cerrar con botón real, `aria-expanded`, Escape y control de foco razonable.

### 2. Hero

Firma de marca, respetando mayúsculas y minúsculas:

> Experience design studio

H1 principal, sin cambiar el concepto:

> Hacemos que tu evento sea único.

Texto:

> Diseñamos experiencias que mezclan creatividad, tecnología y contenido para que cada momento se sienta hecho solo para vos.

CTA primario:

> Contanos tu idea

CTA secundario:

> Ver experiencias

Completar el lockup, cerca de la firma anterior o junto al logo:

> Cada evento, su propio fenómeno.

El hero debe verse completo y potente en un iPhone sin depender de hover. Puede conservar ecos del rayo: una diagonal fina, una fractura de luz o un halo cromático muy sutil. No dejar partículas animándose intensamente durante toda la visita.

### 3. Manifiesto / propuesta de valor

Titular sugerido:

> No sumamos cosas a una fiesta. Diseñamos lo que la hace inolvidable.

Texto breve que explique que cada experiencia nace de la historia, temática, invitados y energía del evento. Mostrar tres principios en una composición editorial:

- **Idea primero:** la tecnología tiene sentido cuando cuenta algo.
- **Hecho para tu evento:** nada genérico, nada copiado.
- **De punta a punta:** concepto, diseño, contenido y ejecución.

### 4. Servicios / ecosistema OTRORAYO

Crear una sección visual con cuatro territorios, no un grid de tarjetas SaaS repetidas:

1. **Experiencias inmersivas** — realidad virtual y mundos diseñados para vivir desde adentro.
2. **Interacción en vivo** — juegos, pulseras inteligentes, IA y dinámicas que conectan a los invitados.
3. **Visuales y contenido** — identidad del evento, piezas audiovisuales, pantallas y contenido que sucede esa misma noche.
4. **Invitaciones web** — una experiencia personalizada que empieza antes de que llegue el primer invitado.

Cada territorio debe tener una microinteracción distinta pero coherente y funcionar por tap/focus, no solo por hover.

### 5. Sección protagonista de realidad virtual

Esta es la sección más inmersiva después del hero. Debe comunicar posibilidades, no especificaciones técnicas.

Eyebrow:

> AHORA TAMBIÉN EN REALIDAD VIRTUAL

Titular sugerido:

> Un mundo dentro de tu evento.

Texto base:

> Creamos experiencias de realidad virtual personalizadas para que tus invitados entren, literalmente, en otro lugar. Historias, universos y momentos sincronizados que solo pueden existir en tu celebración.

Ideas que se pueden expresar como pequeñas escenas o pasos:

- Un universo visual diseñado según la identidad del evento.
- Experiencias grupales y coordinadas.
- Contenido preparado y operado por OTRORAYO durante el show.
- Una antesala/lobby personalizada para recibir a cada invitado.

Crear un visual abstracto que recuerde un visor o un portal sin copiar la interfaz de Meta ni depender de modelos 3D externos. Se puede usar CSS perspective, capas SVG, una retícula curva y un portal cromático liviano. No hacer girar un modelo pesado de un headset.

CTA:

> Quiero una experiencia VR

### 6. Casos o experiencias

Crear una franja/carrusel accesible o una grilla editorial preparada para contenidos reales. Incluir un caso real disponible en la comunicación de la marca sin atribuir métricas no verificadas:

- **Figus del Reino** — álbum digital de figuritas diseñado para una fiesta de 15, con intercambio entre invitados, premios y ranking en pantalla.

Agregar dos slots claramente marcados como contenido a reemplazar, con títulos conceptuales neutrales, por ejemplo `Experiencia inmersiva` y `Visuales en vivo`. No presentarlos como clientes reales ni escribir testimonios falsos.

Cada caso debe mostrar qué lo volvió único, no solo una galería de fotos. Si no hay assets, usar arte abstracto y comentarios HTML indicando exactamente dónde agregar imagen/video, formato recomendado y proporción.

### 7. Invitación web personalizada

Esta sección debe poder vender el servicio por sí sola. Mostrar un mockup de celular creado con HTML/CSS y una mini invitación navegable o animada.

Eyebrow:

> TU EVENTO EMPIEZA ANTES

Titular:

> Una invitación web hecha para vos.

Texto:

> Convertimos la invitación en la primera experiencia del evento: una web con tu identidad, lista para compartir y pensada para que cada invitado tenga toda la información en un solo lugar.

Features posibles, sin prometer integraciones que no estén implementadas:

- Diseño 100 % personalizado.
- Cuenta regresiva.
- Fecha, ubicación y acceso al mapa.
- Dress code y agenda.
- Confirmación de asistencia.
- Galería, música, mensajes y datos útiles.
- Link simple para compartir por WhatsApp.

CTA:

> Quiero mi invitación

Agregar una aclaración elegante: la función de RSVP requiere definir posteriormente dónde se guardan las respuestas; en esta landing no crear una falsa persistencia si no hay backend.

### 8. Cómo trabajamos

Explicar el proceso en cuatro pasos breves:

1. **Nos contás el evento.**
2. **Encontramos la idea.**
3. **Diseñamos cada detalle.**
4. **Lo hacemos suceder.**

Usar una línea narrativa inspirada en la trayectoria del rayo, con animación por `IntersectionObserver`. No usar scroll-jacking ni secciones que obliguen al usuario a esperar.

### 9. CTA y formulario de consulta

Titular:

> Tu evento puede ser el próximo fenómeno.

Texto:

> Contanos qué estás imaginando. Nosotros encontramos la forma de volverlo inolvidable.

Campos mínimos:

- Nombre.
- Tipo de evento.
- Fecha aproximada.
- Ciudad.
- Cantidad estimada de invitados.
- Qué te interesa: experiencia integral, realidad virtual, interacción/juegos, visuales/contenido, invitación web u otro.
- Mensaje libre.

El CTA final debe decir:

> Empecemos a crear

Como no hay backend definido, centralizar en la parte superior de `script.js` un objeto `CONFIG` con:

- URL de Instagram: `https://www.instagram.com/otrorayo/`.
- Número de WhatsApp vacío o claramente señalado como pendiente.
- Email vacío o claramente señalado como pendiente.

Implementar validación accesible. Al enviar:

- Si hay WhatsApp configurado, construir un mensaje claro con los datos y abrir `wa.me`.
- Si no hay WhatsApp pero hay email, usar un `mailto:` bien codificado.
- Si ninguno está configurado, no fingir que se envió: mostrar un mensaje amable que invite a escribir por Instagram y ofrecer el enlace.

No guardar ni transmitir datos a ningún servicio externo adicional.

### 10. FAQ breve

Usar `details/summary` con preguntas reales de conversión:

- ¿Las experiencias se diseñan desde cero?
- ¿Qué tipo de eventos hacen?
- ¿La realidad virtual funciona para grupos?
- ¿La invitación web se adapta a mi temática?
- ¿Con cuánto tiempo de anticipación conviene escribirles?

Responder sin inventar plazos rígidos, precios ni disponibilidad. Invitar a consultar según la complejidad.

### 11. Footer

- Logo OTRORAYO.
- “Cada evento, su propio fenómeno.”
- Link a Instagram.
- CTA de contacto.
- Año automático.
- Botón accesible para repetir la intro.

## Animaciones después de la intro

El sitio debe seguir sintiéndose vivo, pero con mucha más calma:

- Reveals de secciones con `IntersectionObserver`.
- Líneas que se dibujan, máscaras suaves y pequeños cambios de profundidad.
- Botones con respuesta inmediata al hover, focus y tap.
- Parallax muy sutil solo en dispositivos que lo toleren y nunca ligado a una librería.
- Nada debe competir con el contenido o retrasar un CTA.
- Todo elemento oculto para animar debe quedar visible si JavaScript falla.

## Responsive y accesibilidad

- Mobile first.
- Probar como mínimo en anchos de 360, 390, 430, 768, 1024 y 1440 px.
- No permitir overflow horizontal en ningún ancho.
- Touch targets de al menos 44 × 44 px.
- Contraste mínimo WCAG AA; priorizar AAA para texto corriente cuando sea posible.
- Navegación completa con teclado.
- Focus visible y consistente.
- Jerarquía de headings correcta y un solo `h1`.
- `alt` útil en imágenes reales; `alt=""` en decoración.
- SVG decorativos con `aria-hidden="true"`.
- Labels reales en formulario y mensajes de error asociados.
- Respetar `prefers-reduced-motion` y `prefers-contrast`.
- El contenido principal debe ser comprensible y usable sin JavaScript; solo se pierden las mejoras animadas y la composición automática del mensaje.

## Performance y calidad

- Objetivo en mobile: LCP menor a 2,5 s, CLS menor a 0,1 e INP menor a 200 ms en condiciones razonables.
- No cargar video de fondo automáticamente en mobile.
- Si luego se agrega video, usar poster, `preload="metadata"`, lazy load y pausa fuera de viewport.
- Imágenes en AVIF/WebP con dimensiones declaradas, `srcset` y `loading="lazy"` debajo del fold.
- No usar sombras/filters gigantes ni `will-change` permanente.
- El JavaScript no debe producir errores en consola.
- Pausar animaciones cuando la pestaña está oculta.
- Mantener el peso inicial bajo; la intro debe ser generativa, no un video pesado.

## SEO y metadatos

Incluir:

- `lang="es"`.
- Title sugerido: `OTRORAYO — Experiencias únicas para eventos`.
- Meta description orientada a experiencias personalizadas, realidad virtual, interacción, visuales e invitaciones web.
- Open Graph y Twitter Card con una imagen placeholder claramente documentada.
- Canonical marcado como pendiente si todavía no existe el dominio definitivo.
- Favicon SVG basado en el símbolo.
- JSON-LD tipo `Organization` o `ProfessionalService`, sin inventar dirección, teléfono ni rango de precios. Incluir solo nombre, descripción e Instagram mientras falten datos.

## README obligatorio

Documentar en `landing/README.md`:

- Cómo abrir el sitio localmente.
- Cómo servirlo con un servidor estático simple si el navegador restringe alguna función al abrir archivos locales.
- Dónde reemplazar el logo provisorio por el oficial.
- Dónde cargar fotos y videos reales.
- Qué dimensiones/proporciones convienen para cada asset.
- Cómo configurar WhatsApp y email.
- Cómo cambiar textos, colores y velocidad de la intro.
- Qué degradación se aplica en dispositivos de bajo rendimiento y con reduced motion.
- Qué elementos siguen pendientes de información real de la marca.

## Criterios de aceptación

No considerar el trabajo terminado hasta comprobar todo esto:

- La intro reproduce la secuencia rayo → fractura → explosión de color → logo → hero.
- La intro dura menos de 4 segundos, tiene “Saltar intro”, failsafe y alternativa reduced motion.
- El logo queda nítido en pantallas retina y no se deforma.
- La landing comunica claramente “Hacemos que tu evento sea único” antes de hacer scroll.
- Realidad virtual aparece como diferencial protagonista, no como único servicio.
- La invitación web tiene una sección específica y un CTA propio.
- Hay una ruta de conversión clara al principio, a mitad de página y al final.
- El formulario nunca informa un envío falso.
- Todo funciona sin framework, npm ni build.
- No hay overflow horizontal en 360 px.
- El menú mobile, FAQ, botones, formulario y control de intro funcionan con teclado y touch.
- `prefers-reduced-motion` elimina el movimiento intenso.
- La página sigue siendo legible y navegable si JavaScript falla.
- No hay errores de consola ni links con `href="#"` sin comportamiento real.
- El README explica cómo personalizar y publicar el resultado.

## Forma de trabajo

1. Inspeccioná `/landing` y los documentos de marca disponibles en el repositorio.
2. Definí brevemente en el README las decisiones visuales y cualquier supuesto.
3. Implementá primero una versión funcional y semántica.
4. Construí la intro como mejora progresiva.
5. Verificá responsive, teclado, reduced motion y errores de consola.
6. Abrí el resultado en navegador y corregí cualquier problema visual evidente, especialmente en mobile.

Tomá decisiones razonables sin frenar por detalles menores. Si falta información de contacto o un asset oficial, usá una constante o un placeholder explícito y documentado; no inventes datos. El resultado final debe sentirse propio de OTRORAYO: oscuro, eléctrico, sorprendente y a la vez muy fácil de entender y contratar.
