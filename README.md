# Portafolio Backend

API Node.js para recibir el formulario de contacto del frontend y entregar los
mensajes por SMTP.

## Requisitos

- Node.js 20.6 o superior
- Credenciales de un servidor SMTP

## Configuración

```sh
cp .env.example .env
npm install
```

Configura en `.env`:

- `PORT`: puerto HTTP (por defecto, `3001`).
- `CORS_ORIGIN`: origen exacto del frontend. En desarrollo, `http://localhost:5173`.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: conexión SMTP.
- `CONTACT_TO`: dirección que recibirá los mensajes.
- `CONTACT_FROM`: remitente autorizado por el proveedor SMTP.

Inicia el servidor con `npm run dev` y ejecuta las pruebas con `npm test`.
`GET /api/health` verifica que la API está disponible.

No publiques `.env` ni agregues credenciales al repositorio.
