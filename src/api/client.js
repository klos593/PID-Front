// Todo pasa por la ruta relativa /api — el dev server de Vite la redirige
// al backend de Fastify. Sin estado propio ni comportamiento que valga la
// pena encapsular en una clase, así que queda como funciones simples.

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// El backend exige un token CSRF (header x-csrf-token) en cualquier POST de
// auth. Se pide una sola vez y se cachea en memoria — si expira o el
// backend lo rechaza, request() reintenta una vez pidiendo uno nuevo.
let csrfTokenPromise = null

function fetchCsrfToken() {
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetch('/api/auth/csrf-token', {
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => res.json())
      .then((data) => data.csrfToken)
      .catch((err) => {
        csrfTokenPromise = null
        throw err
      })
  }
  return csrfTokenPromise
}

async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const headers = { 'Content-Type': 'application/json', ...options.headers }

  if (!SAFE_METHODS.has(method)) {
    headers['x-csrf-token'] = await fetchCsrfToken()
  }

  let response = await fetch(path, { ...options, method, headers })

  if (response.status === 403 && !SAFE_METHODS.has(method)) {
    // Token vencido o inválido — se pide uno nuevo y se reintenta una vez.
    csrfTokenPromise = null
    headers['x-csrf-token'] = await fetchCsrfToken()
    response = await fetch(path, { ...options, method, headers })
  }

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

export function logoutAccount() {
  return request('/api/auth/logout', { method: 'POST' })
}

export function fetchCurrentUser() {
  return request('/api/auth/me')
}
