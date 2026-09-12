// Datos de mentira para poder trabajar el front mientras el backend sigue
// siendo un stub (PID-Back todavía solo responde GET /). Todo se genera
// relativo a `new Date()`, así que el calendario siempre se ve "actual" sin
// tener que tocar fechas hardcodeadas.
//
// Cuando existan los endpoints reales este archivo se borra entero — ver el
// seam al final de client.js.

import { addDays, addOneHour, mondayIndex, toISODate } from '../utils/calendar.js'
import {
  expandAvailability,
  subtractBookedLessons,
} from '../utils/booking.js'

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

  // Las clases del alumno se suman acá para que el calendario y la pantalla de
  // reservas coincidan al menos en esas — que son justo las que nombra el
  // aviso de superposición. Va afuera del cache a propósito: el cache guarda
  // lo generado por mes y esto se arma relativo a hoy.
  // TODO(alumno): unificar de verdad cuando la clase tenga studentId y exista
  // GET /api/classes?student=me; hoy las generadas no tienen dueño.
  result.push(...getMockStudentLessons(from, to))

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
// AHORA CON DOCENTE: mockAvailability[docenteId][materiaId] = horario semanal.
// Antes era { [materiaId]: horario } y pertenecía implícitamente al único
// docente logueado — con eso no se podía contestar "quién está libre el
// martes", que es toda la pantalla del alumno.
//
// Se pierde al refrescar, igual que la sesión de App.jsx. No hay backend.
// Cada materia sembrada está adentro de los subjectIds de su docente (hay un
// test que lo verifica).
const mockAvailability = {
  // 1 — Agustín Klos, el usuario logueado (materias 1, 3, 5).
  [MOCK_USER.id]: {
    1: {
      lunes: [{ start: '09:00', end: '11:00' }],
      miercoles: [{ start: '18:00', end: '20:00' }],
    },
    5: {
      viernes: [{ start: '14:00', end: '15:00' }],
    },
  },
  // 2 — Laura Gómez (1, 3).
  2: {
    1: {
      lunes: [
        { start: '13:00', end: '15:30' },
        { start: '16:00', end: '17:00' },
      ],
      miercoles: [{ start: '09:00', end: '12:00' }],
      jueves: [
        { start: '13:00', end: '15:30' },
        { start: '16:00', end: '17:00' },
      ],
    },
    3: {
      martes: [{ start: '08:30', end: '10:30' }],
      viernes: [{ start: '15:00', end: '18:00' }],
    },
  },
  // 3 — Martín Sosa (5, 6).
  3: {
    5: {
      lunes: [{ start: '18:00', end: '21:00' }],
      miercoles: [{ start: '14:00', end: '17:00' }],
      sabado: [{ start: '10:00', end: '13:00' }],
    },
    6: {
      martes: [{ start: '08:00', end: '11:00' }],
      jueves: [{ start: '16:00', end: '19:00' }],
    },
  },
  // 4 — Carla Benítez (2, 7).
  4: {
    2: {
      lunes: [{ start: '12:00', end: '17:00' }],
      viernes: [{ start: '09:00', end: '12:00' }],
    },
    7: {
      martes: [{ start: '14:00', end: '16:00' }],
      jueves: [{ start: '10:00', end: '12:00' }],
    },
  },
}

/**
 * Todos los docentes que un alumno puede ver, con sus materias.
 *
 * MOCK_USER no está en MOCK_TEACHERS, así que sin esto los horarios que el
 * docente logueado guarda en su propia pantalla no aparecerían nunca del lado
 * del alumno — y eso es justo lo que hace la función demostrable de punta a
 * punta. ANDAMIO DE PRUEBA: el backend de verdad se va a excluir a sí mismo.
 */
export const MOCK_TEACHER_DIRECTORY = [
  {
    id: MOCK_USER.id,
    nombre: MOCK_USER.nombre,
    apellido: MOCK_USER.apellido,
    subjectIds: MOCK_USER.subjectIds,
  },
  ...MOCK_TEACHERS,
]

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

/**
 * El horario del docente LOGUEADO para una materia. Mantiene la firma de
 * antes: el PUT de verdad saca el docente de la sesión, así que agregarle un
 * teacherId sería modelar un endpoint que no vamos a construir.
 */
export function getMockAvailability(subjectId) {
  return cloneSchedule(mockAvailability[MOCK_USER.id]?.[subjectId])
}

/** Todas las materias de UN docente: { [subjectId]: horario }. */
export function getMockAvailabilityByTeacher(teacherId) {
  const all = {}
  for (const [subjectId, schedule] of Object.entries(mockAvailability[teacherId] || {})) {
    all[subjectId] = cloneSchedule(schedule)
  }
  return all
}

export function setMockAvailability(subjectId, schedule) {
  if (!mockAvailability[MOCK_USER.id]) mockAvailability[MOCK_USER.id] = {}
  mockAvailability[MOCK_USER.id][subjectId] = cloneSchedule(schedule)
  return getMockAvailability(subjectId)
}

/**
 * El store aplanado, que es lo que necesita expandAvailability: una entrada
 * por (docente, materia) con su plantilla semanal y los nombres ya resueltos.
 * Así booking.js nunca se entera de cómo está anidado esto.
 */
export function getMockAvailabilityEntries() {
  const entries = []

  for (const teacher of MOCK_TEACHER_DIRECTORY) {
    const porMateria = mockAvailability[teacher.id] || {}

    for (const [subjectId, schedule] of Object.entries(porMateria)) {
      const subject = MOCK_SUBJECTS.find((item) => item.id === Number(subjectId))
      if (!subject) continue

      entries.push({
        teacherId: teacher.id,
        teacherName: `${teacher.nombre} ${teacher.apellido}`,
        subjectId: subject.id,
        subjectName: subject.name,
        schedule: cloneSchedule(schedule),
      })
    }
  }

  return entries
}

// --- Las clases que YA reservó el alumno logueado ---------------------------
//
// MOCK_STUDENTS son tres nombres sueltos sin id y `studentName` es texto de
// pantalla: hoy NO hay forma de decir "las clases de ESTE alumno". Esta lista
// es esa respuesta hasta que exista studentId.
//
// Mutable igual que mockAvailability y por el mismo motivo: la ronda 2 va a
// empujar acá al reservar, y el aviso de superposición tiene que cambiar sin
// refrescar.
const MOCK_STUDENT_NAME = 'Sofía Ramírez'

/**
 * El próximo lunes/martes/… contando hoy. Sembrar por día de semana y no por
 * fecha fija es lo que hace que la superposición caiga SIEMPRE encima de la
 * plantilla semanal, sea hoy el día que sea.
 */
function nextWeekdayIso(dayIndex) {
  const today = new Date()
  return toISODate(addDays(today, (dayIndex - mondayIndex(today) + 7) % 7))
}

// Cada una está elegida para que se pueda ver un estado distinto en pantalla:
//   - lunes 14:00 con Laura  -> se RESTA de su disponibilidad (no es un aviso)
//     y además choca con la de Carla, que ese día está libre de 12 a 17: esa
//     tarjeta muestra el aviso gris y SIGUE siendo reservable.
//   - martes 09:00 con Martín -> otra resta, en el medio de su rango.
//   - martes 09:00 también pisa el Álgebra de Laura (08:30–10:30), que queda
//     partida en dos pedazos de media hora: esa tarjeta NO se puede reservar.
const mockStudentLessons = [
  {
    id: 'sl-1',
    dayIndex: 0,
    startTime: '14:00',
    endTime: '15:00',
    subjectId: 1,
    subjectName: 'Matemática',
    teacherId: 2,
    teacherName: 'Laura Gómez',
  },
  {
    id: 'sl-2',
    dayIndex: 1,
    startTime: '09:00',
    endTime: '10:00',
    subjectId: 6,
    subjectName: 'Base de Datos',
    teacherId: 3,
    teacherName: 'Martín Sosa',
  },
  {
    id: 'sl-3',
    dayIndex: 4,
    startTime: '10:00',
    endTime: '11:00',
    subjectId: 2,
    subjectName: 'Física',
    teacherId: 4,
    teacherName: 'Carla Benítez',
  },
]

/** Las clases del alumno con fecha de verdad, dentro del rango pedido. */
export function getMockStudentLessons(from, to) {
  return mockStudentLessons
    .map((lesson) => ({
      ...lesson,
      // Las sembradas van por día de semana; las que se reservan ya tienen su
      // fecha concreta.
      date: lesson.date || nextWeekdayIso(lesson.dayIndex),
      status: 'reservada',
      studentName: MOCK_STUDENT_NAME,
    }))
    .filter((lesson) => lesson.date >= from && lesson.date <= to)
}

/**
 * Reservar: suma la clase a las del alumno. Como getMockAvailabilitySlots
 * resta estas clases, el horario desaparece solo de la disponibilidad del
 * docente en la próxima carga — que es la regla del dominio (ver CLAUDE.md).
 *
 * Se guarda con `date` de verdad y no con dayIndex: una reserva es de un día
 * concreto, no de todos los lunes.
 */
export function addMockStudentLesson(lesson) {
  mockStudentLessons.push({ ...lesson, id: lesson.id || `sl-${Date.now()}` })
  return lesson
}

/**
 * La disponibilidad con FECHA y ya neta de lo reservado — lo que va a devolver
 * GET /api/availability. Acá el mock hace el trabajo que va a hacer el
 * backend: guarda plantillas semanales y las proyecta sobre el rango que pide
 * la pantalla.
 *
 * No se restan las clases sueltas que genera buildMonthClasses: son ruido de
 * otro generador (un sorteo `seed % 3` que no sale de la disponibilidad de
 * nadie), y dejarlas comerse las plantillas haría que la pantalla se viera
 * rota al azar en cada carga.
 */
export function getMockAvailabilitySlots(from, to) {
  const rows = expandAvailability(getMockAvailabilityEntries(), from, to)
  return subtractBookedLessons(rows, getMockStudentLessons(from, to))
}

/** Simula la latencia de red para que se vean los estados de carga. */
export function mockResponse(data) {
  return new Promise((resolve) => setTimeout(() => resolve(data), MOCK_DELAY_MS))
}
