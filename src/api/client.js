// Todo pasa por la ruta relativa /api — el dev server de Vite la redirige
// al backend de Fastify (ver server.proxy en vite.config.js). Sin estado
// propio ni comportamiento que valga la pena encapsular en una clase, así
// que queda como funciones simples.
//
// OJO: el backend todavía es un stub (PID-Back solo responde GET /), así que
// algunas de estas funciones devuelven datos de mentira por ahora. Están
// todas marcadas con "MOCK" y el `request` real queda comentado al lado:
// conectar cada una es borrar una línea y descomentar la otra.

import {
  getMockAvailabilityByTeacher,
  getMockClasses,
  MOCK_SUBJECTS,
  MOCK_TEACHERS,
  MOCK_USER,
  mockResponse,
  setMockAvailability,
} from './mocks.js'

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
  // MOCK: /api/subjects todavía no existe en PID-Back. La lista de materias
  // es fija y la define la base, así que la de mentira alcanza para armar las
  // pantallas (y hasta acá el registro fallaba en el paso 3 por esto).
  return mockResponse(MOCK_SUBJECTS)
  // return request('/api/subjects')
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
  // MOCK: /api/auth/login todavía no existe, así que aceptamos cualquier
  // credencial y devolvemos el usuario de prueba. Sin esto no hay forma de
  // pasar del login y llegar al calendario.
  return mockResponse({ user: { ...MOCK_USER, email: credentials.email } })
  // return request('/api/auth/login', {
  //   method: 'POST',
  //   body: JSON.stringify(credentials),
  // })
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

export function fetchAvailabilityByTeacher(teacherId) {
  // MOCK: un solo pedido con TODAS las materias del docente, no una por
  // materia. La pantalla necesita las otras sí o sí —son las que bloquean
  // horarios, porque nadie puede dar dos clases a la vez— y pedirlas de a una
  // sería un N+1 con N estados de carga y una carrera entre promesas cada vez
  // que se cambia de materia.
  return mockResponse(getMockAvailabilityByTeacher(teacherId))
  // return request(`/api/teachers/${teacherId}/availability`)
}

export function saveAvailability(subjectId, schedule) {
  // MOCK: escribe en el store mutable de mocks.js, así el bloqueo entre
  // materias se puede probar sin backend (ver el comentario allá).
  return mockResponse({ subjectId, schedule: setMockAvailability(subjectId, schedule) })
  // return request(`/api/subjects/${subjectId}/availability`, {
  //   method: 'PUT',
  //   body: JSON.stringify({ schedule }),
  // })
}

export function updateProfile(payload) {
  // MOCK: PATCH /api/users/me todavía no existe. Devolvemos el mismo payload
  // como si el backend lo hubiera guardado. OJO: no lo mezclamos con
  // MOCK_USER — pisar el email o el nombre con los de mentira sería un bug
  // visible (loginAccount ya respeta el email que se tipeó).
  return mockResponse({ user: { ...payload } })
  // return request('/api/users/me', {
  //   method: 'PATCH',
  //   body: JSON.stringify(payload),
  // })
}
