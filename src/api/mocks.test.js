import {
  getMockAvailability,
  getMockAvailabilityByTeacher,
  getMockAvailabilityEntries,
  getMockAvailabilitySlots,
  getMockClasses,
  getMockStudentLessons,
  MOCK_SUBJECTS,
  MOCK_TEACHER_DIRECTORY,
  MOCK_USER,
  setMockAvailability,
} from './mocks.js'
import { addDays, addMonths, isValidSlotStart, toISODate } from '../utils/calendar.js'
import { rangesOverlap } from '../utils/booking.js'

const hoy = toISODate(new Date())

// Rango largo para tener de todo: el mes de hoy entero más el siguiente.
const desde = toISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const hasta = toISODate(addMonths(new Date(), 2))

describe('getMockClasses', () => {
  it('hoy siempre tiene clases reservadas', () => {
    // Es el día que aparece seleccionado al entrar: si el sorteo lo dejaba
    // sin clases reservadas, la primera pantalla se veía vacía. Este test es
    // la regresión de esa garantía.
    const clases = getMockClasses(hoy, hoy, 'reservada')
    expect(clases.length).toBeGreaterThan(0)
    expect(clases.every((clase) => clase.status === 'reservada')).toBe(true)
  })

  it('filtra por estado cuando se lo piden', () => {
    const reservadas = getMockClasses(desde, hasta, 'reservada')
    expect(reservadas.length).toBeGreaterThan(0)
    expect(reservadas.every((clase) => clase.status === 'reservada')).toBe(true)

    const disponibles = getMockClasses(desde, hasta, 'disponible')
    expect(disponibles.length).toBeGreaterThan(0)
    expect(disponibles.every((clase) => clase.status === 'disponible')).toBe(true)
  })

  it('sin estado devuelve todo', () => {
    const todas = getMockClasses(desde, hasta)
    expect(todas.some((clase) => clase.status === 'reservada')).toBe(true)
    // Tiene que seguir habiendo turnos libres: son los que va a mostrar la
    // pantalla de disponibilidad.
    expect(todas.some((clase) => clase.status === 'disponible')).toBe(true)
  })

  it('respeta el rango de fechas', () => {
    const clases = getMockClasses(desde, hasta)
    expect(clases.every((clase) => clase.date >= desde && clase.date <= hasta)).toBe(true)
  })

  it('devuelve lo mismo si se pide dos veces (el cache no se ensucia)', () => {
    // El filtro por estado va después del cache justamente para esto: pedir
    // un estado no puede cambiar lo que ve la siguiente llamada.
    getMockClasses(desde, hasta, 'reservada')
    const todas = getMockClasses(desde, hasta)
    expect(todas.some((clase) => clase.status === 'disponible')).toBe(true)
  })

  it('las clases duran una hora y arrancan en punto o y media', () => {
    for (const clase of getMockClasses(desde, hasta)) {
      expect(clase.startTime).toMatch(/^([01]\d|2[0-3]):(00|30)$/)
      expect(clase.endTime).toMatch(/^([01]\d|2[0-3]):(00|30)$/)
    }
  })
})

describe('disponibilidad de mentira', () => {
  it('viene sembrada con horas en punto o y media', () => {
    // Es la regla del dominio: las clases arrancan :00 o :30. Se recorre el
    // store aplanado y no el de un solo docente: antes esto iteraba lo que
    // devolvía getMockAvailabilityByTeacher() sin argumento, que con la
    // restructuración pasó a ser {} y el test dejó de mirar nada.
    const entries = getMockAvailabilityEntries()
    expect(entries.length).toBeGreaterThan(0)

    for (const entry of entries) {
      for (const ranges of Object.values(entry.schedule)) {
        for (const range of ranges) {
          expect(isValidSlotStart(range.start)).toBe(true)
          // El fin puede ser '24:00', que isValidSlotStart no acepta a
          // propósito (solo vale como inicio).
          expect(range.end === '24:00' || isValidSlotStart(range.end)).toBe(true)
        }
      }
    }
  })

  it('cada docente solo tiene horarios de materias que da', () => {
    for (const entry of getMockAvailabilityEntries()) {
      const teacher = MOCK_TEACHER_DIRECTORY.find((item) => item.id === entry.teacherId)
      expect(teacher).toBeDefined()
      expect(teacher.subjectIds).toContain(entry.subjectId)
    }
  })

  it('el docente logueado aparece entre los que un alumno puede ver', () => {
    // Sin esto, lo que el docente guarda en su propia pantalla no se vería
    // nunca del lado del alumno y la demo no cerraría de punta a punta.
    expect(MOCK_TEACHER_DIRECTORY.some((teacher) => teacher.id === MOCK_USER.id)).toBe(true)
    expect(getMockAvailabilityEntries().some((entry) => entry.teacherId === MOCK_USER.id)).toBe(
      true,
    )
  })

  it('las entradas traen resueltos los nombres', () => {
    for (const entry of getMockAvailabilityEntries()) {
      expect(entry.teacherName).toMatch(/\S+ \S+/)
      expect(MOCK_SUBJECTS.some((subject) => subject.name === entry.subjectName)).toBe(true)
    }
  })

  it('guarda y devuelve lo guardado (el store es mutable a propósito)', () => {
    // Sin esto no se puede ver el bloqueo entre materias: guardar una y abrir
    // otra tiene que mostrar esas horas ocupadas.
    setMockAvailability(99, { martes: [{ start: '08:00', end: '09:00' }] })
    expect(getMockAvailability(99)).toEqual({ martes: [{ start: '08:00', end: '09:00' }] })
    // setMockAvailability escribe siempre bajo el docente logueado: el PUT de
    // verdad saca el docente de la sesión.
    expect(getMockAvailabilityByTeacher(MOCK_USER.id)[99]).toEqual({
      martes: [{ start: '08:00', end: '09:00' }],
    })
  })

  it('devuelve copias: mutar el resultado no ensucia el store', () => {
    setMockAvailability(98, { lunes: [{ start: '10:00', end: '11:00' }] })
    const copia = getMockAvailability(98)
    copia.lunes[0].start = '23:00'
    copia.viernes = [{ start: '01:00', end: '02:00' }]

    expect(getMockAvailability(98)).toEqual({ lunes: [{ start: '10:00', end: '11:00' }] })
  })
})

describe('disponibilidad con fecha', () => {
  // Una semana entera a partir de hoy, que es lo que mira la pantalla.
  const semanaDesde = toISODate(new Date())
  const semanaHasta = toISODate(addDays(new Date(), 6))

  it('proyecta las plantillas sobre fechas concretas', () => {
    const slots = getMockAvailabilitySlots(semanaDesde, semanaHasta)
    expect(slots.length).toBeGreaterThan(0)

    for (const slot of slots) {
      expect(slot.date >= semanaDesde && slot.date <= semanaHasta).toBe(true)
      expect(slot.ranges.length).toBeGreaterThan(0)
    }
  })

  it('viene neta de lo que el alumno ya reservó con ese docente', () => {
    const lessons = getMockStudentLessons(semanaDesde, semanaHasta)
    expect(lessons.length).toBeGreaterThan(0)

    const slots = getMockAvailabilitySlots(semanaDesde, semanaHasta)
    for (const lesson of lessons) {
      const delDocente = slots.filter(
        (slot) => slot.teacherId === lesson.teacherId && slot.date === lesson.date,
      )
      for (const slot of delDocente) {
        for (const range of slot.ranges) {
          expect(
            rangesOverlap(range, { start: lesson.startTime, end: lesson.endTime }),
          ).toBe(false)
        }
      }
    }
  })

  it('en la semana que viene hay al menos una superposición para mostrar', () => {
    // La regresión del aviso gris: si nada choca, el indicador de
    // superposición no se puede ver nunca en pantalla.
    const slots = getMockAvailabilitySlots(semanaDesde, semanaHasta)
    const lessons = getMockStudentLessons(semanaDesde, semanaHasta)

    const hayChoque = slots.some((slot) =>
      lessons.some(
        (lesson) =>
          lesson.date === slot.date &&
          lesson.teacherId !== slot.teacherId &&
          slot.ranges.some((range) =>
            rangesOverlap(range, { start: lesson.startTime, end: lesson.endTime }),
          ),
      ),
    )
    expect(hayChoque).toBe(true)
  })

  it('las clases del alumno también salen en el listado general', () => {
    // Así el calendario y la pantalla de reservas coinciden al menos en esas.
    const clases = getMockClasses(desde, hasta, 'reservada')
    for (const lesson of getMockStudentLessons(semanaDesde, semanaHasta)) {
      expect(clases.some((clase) => clase.id === lesson.id)).toBe(true)
    }
  })
})
