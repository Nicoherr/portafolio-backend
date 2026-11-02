import test from 'node:test'
import assert from 'node:assert/strict'
import { validateContact } from './contact-validation.js'

test('accepts a valid contact message and trims its fields', () => {
  assert.deepEqual(validateContact({
    name: '  Nicolás Herrera  ',
    email: '  nicolas@example.com ',
    message: '  Hola, quisiera conversar.  ',
  }), {
    valid: true,
    data: {
      name: 'Nicolás Herrera',
      email: 'nicolas@example.com',
      message: 'Hola, quisiera conversar.',
    },
  })
})

test('rejects invalid email addresses and empty messages', () => {
  assert.equal(validateContact({ name: 'Nicolás', email: 'inválido', message: 'Hola' }).valid, false)
  assert.equal(validateContact({ name: 'Nicolás', email: 'nic\0olas@example.com', message: 'Hola' }).valid, false)
  assert.equal(validateContact({ name: 'Nicolás', email: 'nicolas@example.com', message: '  ' }).valid, false)
})

test('rejects oversized fields and honeypot submissions', () => {
  assert.equal(validateContact({
    name: 'N'.repeat(101),
    email: 'nicolas@example.com',
    message: 'Hola',
  }).valid, false)
  assert.equal(validateContact({
    name: 'Nicolás',
    email: 'nicolas@example.com',
    message: 'Hola',
    website: 'spam',
  }).valid, false)
})
