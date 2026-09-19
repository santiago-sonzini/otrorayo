# OTRORAYO

Estudio de diseño de experiencias para eventos.

- [`landing/`](landing/README.md): sitio web, intro, recorrido inmersivo y formulario.
- [`server/`](server/): servidor Python y envío privado de consultas por SMTP.
- [`app/`](app/README.md): prototipo independiente de control de experiencias VR.

## Ejecutar la web

Requiere Python 3. No necesita instalar dependencias ni compilar.

```sh
cp server/.env.example server/.env
# Completar las variables SMTP y CONTACT_TO en server/.env.
python3 server/server.py
```

Abrir http://127.0.0.1:4173/. La interfaz funciona sin configurar SMTP; el envío necesita las variables privadas. Las credenciales y los datos locales del controlador VR no forman parte del repositorio.

## Verificar

```sh
python3 -m unittest discover -s server/tests -v
cd app
npm test
```

La publicación debe incluir el backend para que funcione el formulario. Ver [instrucciones de la landing](landing/README.md).

## Deploy en Vercel

Importar este repositorio completo y dejar **Root Directory: `.`** y **Framework Preset: Other**. `vercel.json` configura la preparación de archivos estáticos en `public/` y la función Python `/api/contact`; no seleccionar `landing/` como raíz del proyecto.

Agregar estas variables en **Settings → Environment Variables**, en Production y en Preview si se quiere probar el formulario allí:

| Variable     | Valor                                   |
| ------------ | --------------------------------------- |
| `SMTP_USER`  | Cuenta remitente autorizada             |
| `SMTP_PASS`  | Contraseña de aplicación SMTP           |
| `CONTACT_TO` | Correo privado que recibe las consultas |
| `SMTP_HOST`  | `smtp.gmail.com`                        |
| `SMTP_PORT`  | `587`                                   |
| `SITE_URL`   | `https://otrorayo.com`                  |

Las tres primeras son privadas y sólo se leen en el servidor. No usar prefijos públicos ni pegar sus valores en el código. `.env.example` incluye los nombres sin secretos. En local se puede usar `.env.local` en la raíz o `server/.env`; en Vercel sólo se usa el entorno de la plataforma. Después de cambiar variables, generar un nuevo deployment.

Los orígenes de preview se toman de las variables de sistema de Vercel y no se acepta cualquier dominio `vercel.app`. El envío se confirma después de que SMTP acepta el mensaje. Las pruebas automatizadas simulan SMTP y no envían correos.

El control VR de `app/` se incluye completo en Git y conserva su ejecución local con Node.js y WebSockets. El deployment web de Vercel publica la landing y su endpoint, no inicia el controlador VR. Las protecciones de frecuencia y deduplicación del contacto son por instancia; no son un límite global entre instancias serverless.

Configuración basada en la [documentación oficial de funciones Python](https://vercel.com/docs/functions/runtimes/python/api-directory) y [vercel.json](https://vercel.com/docs/project-configuration/vercel-json). El build estático y el handler están probados localmente; el primer deploy permite verificar el envío desde la infraestructura de Vercel.
