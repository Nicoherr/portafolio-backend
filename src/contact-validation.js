const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateContact(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, error: 'El contenido enviado no es válido.' }
  }

  if (typeof body.website === 'string' && body.website.trim()) {
    return { valid: false, error: 'No se pudo enviar el mensaje.' }
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''

  if (!name || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name)) {
    return { valid: false, error: 'Ingresa un nombre válido (máximo 100 caracteres).' }
  }

  if (!email || email.length > 254 || /[\u0000-\u001f\u007f]/.test(email) || !EMAIL_PATTERN.test(email)) {
    return { valid: false, error: 'Ingresa un correo electrónico válido.' }
  }

  if (!message || message.length > 5000) {
    return { valid: false, error: 'El mensaje debe tener entre 1 y 5000 caracteres.' }
  }

  return { valid: true, data: { name, email, message } }
}
