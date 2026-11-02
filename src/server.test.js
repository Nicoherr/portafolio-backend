import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createContactServer } from './server.js'

test('POST /api/contact validates and delivers a message', async (context) => {
  let deliveredMessage
  const server = createContactServer({
    sendEmail: async (message) => {
      deliveredMessage = message
    },
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  context.after(() => server.close())

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Nicolás',
      email: 'nicolas@example.com',
      message: 'Hola',
    }),
  })

  assert.equal(response.status, 200)
  assert.deepEqual(deliveredMessage, {
    name: 'Nicolás',
    email: 'nicolas@example.com',
    message: 'Hola',
  })
  assert.deepEqual(await response.json(), { message: 'Mensaje enviado correctamente.' })
})

test('POST /api/contact rejects invalid input without sending email', async (context) => {
  const server = createContactServer({
    sendEmail: () => assert.fail('No debe enviar mensajes inválidos'),
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  context.after(() => server.close())

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '', email: 'invalido', message: '' }),
  })

  assert.equal(response.status, 400)
  assert.ok((await response.json()).error)
})

test('allows the configured frontend origin and rejects other origins', async (context) => {
  const server = createContactServer({
    sendEmail: async () => {},
    corsOrigin: 'https://portfolio.example',
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  context.after(() => server.close())
  const url = `http://127.0.0.1:${server.address().port}/api/contact`

  const allowed = await fetch(url, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://portfolio.example',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  })
  assert.equal(allowed.status, 204)
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://portfolio.example')

  const rejected = await fetch(url, {
    method: 'POST',
    headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Nicolás', email: 'nicolas@example.com', message: 'Hola' }),
  })
  assert.equal(rejected.status, 403)
})
