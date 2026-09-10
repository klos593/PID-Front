// Todo pasa por la ruta relativa /api — el dev server de Vite la redirige
// al backend de Fastify. Sin estado propio ni comportamiento que valga la
// pena encapsular en una clase, así que queda como funciones simples.

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    // sin body (p. ej. error de red) — data queda en null
  }

  if (!response.ok) {
    const error = new Error(data?.message || 'Ocurrió un error inesperado.')
    error.status = response.status
    error.code = data?.error
    error.fields = data?.fields
    throw error
  }

  return data
}

export function fetchSubjects() {
  return request('/api/subjects')
}

export function checkEmailAvailability(email) {
  return request(`/api/auth/check-email?email=${encodeURIComponent(email)}`)
}

export function registerAccount(payload) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function loginAccount(credentials) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
}
