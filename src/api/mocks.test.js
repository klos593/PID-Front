import {
  getMockAvailability,
  getMockAvailabilityByTeacher,
  getMockClasses,
  setMockAvailability,
} from './mocks.js'
import { isValidSlotStart } from '../utils/calendar.js'
import { addMonths, toISODate } from '../utils/calendar.js'

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
    // Es la regla del dominio: las clases arrancan :00 o :30.
    for (const schedule of Object.values(getMockAvailabilityByTeacher())) {
      for (const ranges of Object.values(schedule)) {
        for (const range of ranges) {
          expect(isValidSlotStart(range.start)).toBe(true)
          // El fin puede ser '24:00', que isValidSlotStart no acepta a
          // propósito (solo vale como inicio).
          expect(range.end === '24:00' || isValidSlotStart(range.end)).toBe(true)
        }
      }
    }
  })

  it('guarda y devuelve lo guardado (el store es mutable a propósito)', () => {
    // Sin esto no se puede ver el bloqueo entre materias: guardar una y abrir
    // otra tiene que mostrar esas horas ocupadas.
    setMockAvailability(99, { martes: [{ start: '08:00', end: '09:00' }] })
    expect(getMockAvailability(99)).toEqual({ martes: [{ start: '08:00', end: '09:00' }] })
    expect(getMockAvailabilityByTeacher()[99]).toEqual({
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
