// Todo pasa por la ruta relativa /api — el dev server de Vite la redirige
// al backend de Fastify (ver server.proxy en vite.config.js). Sin estado
// propio ni comportamiento que valga la pena encapsular en una clase, así
// que queda como funciones simples.
//
// OJO: el backend todavía es un stub para la mayoría de las rutas (PID-Back
// solo tiene auth andando), así que varias de estas funciones devuelven
// datos de mentira por ahora. Están todas marcadas con "MOCK" y el `request`
// real queda comentado al lado: conectar cada una es borrar una línea y
// descomentar la otra.

import {
  addMockStudentLesson,
  getMockAvailabilitySlots,
  getMockStudentLessons,
  getMockClasses,
  MOCK_TEACHERS,
  mockResponse,
} from './mocks.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// fetch NO manda cookies salvo que se le pida, y el backend guarda la sesión
// (`sid`) y el secreto del CSRF en cookies httpOnly. En dev no se nota porque
// el proxy de Vite hace que todo sea same-origin, pero en producción el front
// sale por nginx/Caddy y sin esto la sesión se pierde en cada pedido.
const CREDENTIALS = 'include'

// El backend exige un token CSRF (header x-csrf-token) en cualquier POST de
// auth. Se pide una sola vez y se cachea en memoria — si expira o el
// backend lo rechaza, request() reintenta una vez pidiendo uno nuevo.
let csrfTokenPromise = null

function fetchCsrfToken() {
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetch('/api/auth/csrf-token', {
      headers: { 'Content-Type': 'application/json' },
      credentials: CREDENTIALS,
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

  let response = await fetch(path, { ...options, method, headers, credentials: CREDENTIALS })

  if (response.status === 403 && !SAFE_METHODS.has(method)) {
    // Token vencido o inválido — se pide uno nuevo y se reintenta una vez.
    csrfTokenPromise = null
    headers['x-csrf-token'] = await fetchCsrfToken()
    response = await fetch(path, { ...options, method, headers, credentials: CREDENTIALS })
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

export function fetchClasses({ from, to, status }) {
  // MOCK: las clases del rango que muestra la grilla del calendario.
  // `status` es opcional y lo va a filtrar el backend (ver el query de
  // abajo): 'reservada' para el calendario, 'disponible' para la pantalla de
  // disponibilidad.
  return mockResponse(getMockClasses(from, to, status))
  // return request(
  //   `/api/classes?from=${from}&to=${to}${status ? `&status=${status}` : ''}`,
  // )
}

export function fetchTeachers() {
  // MOCK: lo va a usar el buscador cuando exista.
  return mockResponse(MOCK_TEACHERS)
  // return request('/api/teachers')
}

/**
 * Un solo pedido con TODAS las materias de ESE docente, no una por materia.
 * La pantalla necesita las otras sí o sí —son las que bloquean horarios,
 * porque nadie puede dar dos clases a la vez— y pedirlas de a una sería un
 * N+1 con N estados de carga y una carrera entre promesas cada vez que se
 * cambia de materia.
 */
export function fetchAvailabilityByTeacher(teacherId) {
  return request(`/api/teachers/${teacherId}/availability`)
}

export function fetchAvailability({ from, to }) {
  // MOCK: la disponibilidad YA con fecha y YA neta de lo reservado. El mock
  // hace acá el trabajo que va a hacer el backend: guarda plantillas semanales
  // y las proyecta sobre el rango que pide la pantalla (ver expandAvailability
  // en utils/booking.js). La pantalla del alumno nunca ve una plantilla
  // semanal, igual que no la va a ver cuando esto sea HTTP.
  return mockResponse(getMockAvailabilitySlots(from, to))
  // return request(`/api/availability?from=${from}&to=${to}`)
}

export function fetchMyLessons({ from, to }) {
  // MOCK: las clases que YA reservó el alumno logueado. No sale de
  // fetchClasses porque ese es un listado global sin dueño: `studentName` es
  // texto de pantalla y todavía no hay studentId (ver mocks.js).
  return mockResponse(getMockStudentLessons(from, to))
  // return request(
  //   `/api/classes?from=${from}&to=${to}&status=reservada&student=me`,
  // )
}

export function bookLesson(lesson) {
  // MOCK: empuja la clase a las del alumno en mocks.js. Como la
  // disponibilidad se calcula restando esas clases, el horario deja de
  // ofrecerse solo en la próxima carga, sin tener que tocar nada más.
  return mockResponse({ lesson: addMockStudentLesson(lesson) })
  // return request('/api/classes', {
  //   method: 'POST',
  //   body: JSON.stringify(lesson),
  // })
}

/**
 * Reemplaza la semana entera de esa materia: lo que no va en `schedule` se
 * borra. El docente sale de la sesión en el backend, no se manda.
 */
export function saveAvailability(subjectId, schedule) {
  return request(`/api/subjects/${subjectId}/availability`, {
    method: 'PUT',
    body: JSON.stringify({ schedule }),
  })
}

/**
 * Guarda el perfil. Devuelve el usuario completo y actualizado (no envuelto
 * en { user }), igual que login y /me. El id sale de la sesión en el backend,
 * así que mandarlo en el body no cambiaría nada.
 */
export function updateProfile(payload) {
  return request('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify({
      telefono: payload.telefono,
      subjectIds: payload.subjectIds,
    }),
  })
}
