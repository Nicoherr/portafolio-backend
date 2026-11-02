import { createServer as createHttpServer } from 'node:http'
import nodemailer from 'nodemailer'
import { validateContact } from './contact-validation.js'

const MAX_BODY_BYTES = 25 * 1024
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX_REQUESTS = 5

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function readJsonBody(request) {
  const chunks = []
  let byteLength = 0

  for await (const chunk of request) {
    byteLength += chunk.length
    if (byteLength > MAX_BODY_BYTES) {
      throw new HttpError(413, 'El mensaje excede el tamaño permitido.')
    }
    chunks.push(chunk)
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'El contenido enviado no es JSON válido.')
  }
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(JSON.stringify(body))
}

function createSmtpSender(env) {
  const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'CONTACT_TO', 'CONTACT_FROM']
  const missing = required.filter((key) => !env[key])
  const port = Number(env.SMTP_PORT || 587)

  if (missing.length || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Configuración SMTP incompleta o inválida. Revisa: ${[...missing, ...(Number.isInteger(port) && port > 0 && port <= 65535 ? [] : ['SMTP_PORT'])].join(', ')}`,
    )
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  })

  return async ({ name, email, message }) => {
    await transporter.sendMail({
      from: env.CONTACT_FROM,
      to: env.CONTACT_TO,
      replyTo: email,
      subject: `Nuevo mensaje de contacto: ${name}`,
      text: `Nombre: ${name}\nCorreo: ${email}\n\nMensaje:\n${message}`,
    })
  }
}

export function createContactServer({
  sendEmail,
  now = Date.now,
  corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173',
} = {}) {
  const deliverEmail = sendEmail ?? createSmtpSender(process.env)
  const requestsByIp = new Map()

  return createHttpServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost')
    const requestOrigin = request.headers.origin

    if (requestOrigin && requestOrigin !== corsOrigin) {
      sendJson(response, 403, { error: 'Origen no permitido.' })
      return
    }

    if (requestOrigin) {
      response.setHeader('Access-Control-Allow-Origin', corsOrigin)
      response.setHeader('Vary', 'Origin')
    }

    if (request.method === 'OPTIONS' && url.pathname === '/api/contact') {
      response.writeHead(204, {
        Allow: 'POST, OPTIONS',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '600',
      })
      response.end()
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/health') {
      sendJson(response, 200, { status: 'ok' })
      return
    }

    if (url.pathname !== '/api/contact') {
      sendJson(response, 404, { error: 'Ruta no encontrada.' })
      return
    }

    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST')
      sendJson(response, 405, { error: 'Método no permitido.' })
      return
    }

    const ip = request.socket.remoteAddress ?? 'unknown'
    const requestTime = now()
    const recentRequests = (requestsByIp.get(ip) ?? [])
      .filter((timestamp) => requestTime - timestamp < RATE_LIMIT_WINDOW_MS)

    if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
      sendJson(response, 429, { error: 'Demasiados intentos. Espera unos minutos antes de volver a enviar.' })
      return
    }

    requestsByIp.set(ip, [...recentRequests, requestTime])

    try {
      if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
        throw new HttpError(415, 'El contenido debe enviarse como JSON.')
      }

      const result = validateContact(await readJsonBody(request))
      if (!result.valid) {
        sendJson(response, 400, { error: result.error })
        return
      }

      await deliverEmail(result.data)
      sendJson(response, 200, { message: 'Mensaje enviado correctamente.' })
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(response, error.status, { error: error.message })
        return
      }

      console.error('Error al enviar el mensaje de contacto:', error)
      sendJson(response, 502, { error: 'No se pudo enviar el mensaje. Inténtalo nuevamente más tarde.' })
    }
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const port = Number(process.env.PORT || 3001)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('PORT debe ser un número entre 1 y 65535.')
    }

    const server = createContactServer()
    server.listen(port, () => {
      console.log(`Backend escuchando en http://localhost:${port}`)
    })
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
