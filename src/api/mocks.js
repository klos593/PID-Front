// Datos de mentira para poder trabajar el front mientras el backend sigue
// siendo un stub (PID-Back todavía solo responde GET /). Todo se genera
// relativo a `new Date()`, así que el calendario siempre se ve "actual" sin
// tener que tocar fechas hardcodeadas.
//
// Cuando existan los endpoints reales este archivo se borra entero — ver el
// seam al final de client.js.

import { addOneHour, mondayIndex, toISODate } from '../utils/calendar.js'

export const MOCK_DELAY_MS = 250

export const MOCK_USER = {
  id: 1,
  nombre: 'Agustín',
  apellido: 'Klos',
  email: 'agustin@example.com',
  role: 'docente',
  telefono: '+54 11 5555-5555',
  subjectIds: [1, 3, 5],
}

export const MOCK_SUBJECTS = [
  { id: 1, name: 'Matemática' },
  { id: 2, name: 'Física' },
  { id: 3, name: 'Álgebra' },
  { id: 4, name: 'Análisis Matemático' },
  { id: 5, name: 'Programación' },
  { id: 6, name: 'Base de Datos' },
  { id: 7, name: 'Química' },
  { id: 8, name: 'Inglés' },
]

export const MOCK_TEACHERS = [
  {
    id: 2,
    nombre: 'Laura',
    apellido: 'Gómez',
    subjectIds: [1, 3],
    bio: 'Profesora de matemática, 8 años de experiencia.',
  },
  {
    id: 3,
    nombre: 'Martín',
    apellido: 'Sosa',
    subjectIds: [5, 6],
    bio: 'Backend developer y docente de programación.',
  },
  {
    id: 4,
    nombre: 'Carla',
    apellido: 'Benítez',
    subjectIds: [2, 7],
    bio: 'Ingeniera química, clases de física y química.',
  },
]

// Solo horarios en punto o y media — la regla del dominio (clases de 1 hora
// que arrancan a las :00 o a las :30).
const START_TIMES = ['09:00', '10:30', '14:00', '16:30', '18:00']

const MOCK_STUDENTS = ['Sofía Ramírez', 'Julián Ferrari', 'Malena Ortiz']

function buildMonthClasses(year, month) {
  const classes = []
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayIso = toISODate(new Date())
  let seed = year + month

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    // Hoy siempre tiene clases: es el día que aparece seleccionado al entrar,
    // y una agenda vacía en la primera pantalla se ve como si algo fallara.
    const esHoy = toISODate(date) === todayIso
    if (!esHoy && mondayIndex(date) >= 5) continue // sin clases los fines de semana
    if (!esHoy && day % 3 !== 0 && day % 7 !== 1) continue // días salteados, para que no se vea uniforme

    // Entre 1 y 4 clases por día, y 5 el día de hoy: así se ve tanto el caso
    // normal como el "+N" de los días que no entran enteros en el casillero.
    const howMany = esHoy ? 5 : (day % 4) + 1
    for (let i = 0; i < howMany; i++) {
      const startTime = START_TIMES[(day + i) % START_TIMES.length]
      const teacher = MOCK_TEACHERS[seed % MOCK_TEACHERS.length]
      const subject = MOCK_SUBJECTS[(seed + i) % MOCK_SUBJECTS.length]
      // El calendario muestra SOLO las reservadas, así que este sorteo decide
      // cuánto se ve. Antes era la mitad (`seed % 2 === 0`) y con el filtro
      // nuevo la grilla quedaba medio vacía. Hoy va forzado a reservada
      // aparte: es el día que aparece seleccionado al entrar, y si le tocaba
      // "disponible" la primera pantalla se veía vacía. El tercio que queda
      // libre es lo que va a mostrar la pantalla de disponibilidad.
      const reservada = esHoy || seed % 3 !== 0

      classes.push({
        id: `c-${year}-${month + 1}-${day}-${i}`,
        date: toISODate(date),
        startTime,
        endTime: addOneHour(startTime),
        subjectId: subject.id,
        subjectName: subject.name,
        teacherId: teacher.id,
        teacherName: `${teacher.nombre} ${teacher.apellido}`,
        studentName: reservada ? MOCK_STUDENTS[seed % MOCK_STUDENTS.length] : null,
        status: reservada ? 'reservada' : 'disponible',
      })
      seed++
    }
  }

  return classes
}

// Cache por mes: pedir dos veces el mismo mes devuelve exactamente lo mismo,
// así paginar para atrás y adelante no "reordena" las clases.
const monthCache = new Map()

function getMonthClasses(year, month) {
  const key = `${year}-${month}`
  if (!monthCache.has(key)) {
    monthCache.set(key, buildMonthClasses(year, month))
  }
  return monthCache.get(key)
}

/**
 * Clases entre dos fechas ISO, inclusive. Recorre mes por mes porque la
 * grilla del calendario puede abarcar tres meses (el relleno del anterior y
 * el del siguiente). Comparar strings 'YYYY-MM-DD' alcanza para filtrar.
 *
 * `status` es opcional: el calendario pide solo 'reservada' (es "mis
 * clases") y la pantalla de disponibilidad va a pedir solo 'disponible'. El
 * filtro va acá y no en buildMonthClasses a propósito: el cache por mes
 * tiene que guardar las clases enteras, sin filtrar, o pedir dos rangos
 * distintos devolvería cosas distintas para el mismo mes.
 */
export function getMockClasses(from, to, status) {
  const start = new Date(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, 1)
  const end = new Date(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, 1)
  const result = []

  for (
    let cursor = start;
    cursor <= end;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  ) {
    result.push(...getMonthClasses(cursor.getFullYear(), cursor.getMonth()))
  }

  return result.filter(
    (item) => item.date >= from && item.date <= to && (!status || item.status === status),
  )
}

// --- Disponibilidad semanal por materia ------------------------------------
//
// ESTE OBJETO ES MUTABLE A PROPÓSITO, y es lo único que hace demostrable el
// bloqueo entre materias: guardar Matemática los lunes de 09:00 a 11:00 y
// después entrar a Álgebra tiene que mostrar esas horas ocupadas. Con datos de
// mentira inmutables eso no se ve nunca.
//
// Se pierde al refrescar, igual que la sesión de App.jsx. No hay backend.
// Viene sembrado para las materias 1 y 5 (las dos están en MOCK_USER), así que
// abrir la 3 muestra horarios ocupados desde la primera carga, sin tener que
// guardar nada antes.
const mockAvailability = {
  1: {
    lunes: [{ start: '09:00', end: '11:00' }],
    miercoles: [{ start: '18:00', end: '20:00' }],
  },
  5: {
    viernes: [{ start: '14:00', end: '15:00' }],
  },
}

/**
 * Copia profunda. Devolver el objeto de adentro dejaría que una pantalla
 * mutara el store sin querer (mismo cuidado que el cache de clases por mes).
 */
function cloneSchedule(schedule) {
  const copy = {}
  for (const [dayKey, ranges] of Object.entries(schedule || {})) {
    copy[dayKey] = ranges.map((range) => ({ ...range }))
  }
  return copy
}

export function getMockAvailability(subjectId) {
  return cloneSchedule(mockAvailability[subjectId])
}

/** Todas las materias del docente de una: { [subjectId]: horario }. */
export function getMockAvailabilityByTeacher() {
  const all = {}
  for (const [subjectId, schedule] of Object.entries(mockAvailability)) {
    all[subjectId] = cloneSchedule(schedule)
  }
  return all
}

export function setMockAvailability(subjectId, schedule) {
  mockAvailability[subjectId] = cloneSchedule(schedule)
  return getMockAvailability(subjectId)
}

/** Simula la latencia de red para que se vean los estados de carga. */
export function mockResponse(data) {
  return new Promise((resolve) => setTimeout(() => resolve(data), MOCK_DELAY_MS))
}
