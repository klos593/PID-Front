import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WeekScheduler from './WeekScheduler.jsx'
import { slotIdsToRanges, timeToSlotIndex } from '../../utils/availability.js'

// Las celdas se buscan por sus data-*, que es lo mismo que usa la delegación
// de eventos del componente.
function cell(dayKey, time) {
  return document.querySelector(`[data-day="${dayKey}"][data-index="${timeToSlotIndex(time)}"]`)
}

function renderScheduler(props) {
  const onChange = vi.fn()
  const result = render(<WeekScheduler value={new Set()} onChange={onChange} {...props} />)
  return { ...result, onChange }
}

/** El último Set que emitió onChange, como rangos, que es más fácil de leer. */
function lastRanges(onChange) {
  return slotIdsToRanges(onChange.mock.calls[onChange.mock.calls.length - 1][0])
}

// Un arrastre: pointerdown en la primera celda, pointerover en cada una que se
// cruza y pointerup al final. Cada entrada con `target` distinto hace que
// user-event dispare pointerover en la celda nueva — que es justo lo que
// escucha el componente, y por eso no hace falta elementFromPoint (que jsdom
// no implementa).
function arrastre(celdas, keys = ['[MouseLeft>]', '[/MouseLeft]']) {
  const pasos = [{ keys: keys[0], target: celdas[0] }]
  for (const celda of celdas.slice(1)) pasos.push({ target: celda })
  pasos.push({ keys: keys[1] })
  return pasos
}

describe('WeekScheduler', () => {
  it('dibuja siete columnas de 48 medias horas', () => {
    renderScheduler()
    expect(document.querySelectorAll('[data-index]')).toHaveLength(7 * 48)
  })

  it('startHour y endHour recortan la grilla', () => {
    renderScheduler({ startHour: 8, endHour: 20 })
    expect(document.querySelectorAll('[data-index]')).toHaveLength(7 * 24)
    expect(cell('lunes', '08:00')).toBeInTheDocument()
    expect(cell('lunes', '07:30')).toBeNull()
  })

  it('un clic prende una celda y avisa una sola vez', async () => {
    const { onChange } = renderScheduler()

    await userEvent.click(cell('lunes', '09:00'))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(lastRanges(onChange)).toEqual({ lunes: [{ start: '09:00', end: '09:30' }] })
  })

  it('un clic sobre una celda prendida la apaga', async () => {
    const { onChange } = renderScheduler({ value: new Set(['lunes-0900']) })

    await userEvent.click(cell('lunes', '09:00'))

    expect(lastRanges(onChange)).toEqual({})
  })

  it('arrastrar desde una celda apagada prende todo el rango', async () => {
    const { onChange } = renderScheduler()

    await userEvent.pointer(
      arrastre([cell('lunes', '09:00'), cell('lunes', '09:30'), cell('lunes', '10:00')]),
    )

    // Un solo aviso por gesto, no uno por celda.
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(lastRanges(onChange)).toEqual({ lunes: [{ start: '09:00', end: '10:30' }] })
  })

  it('arrastrar desde una celda prendida APAGA el rango', async () => {
    // El estado de la primera celda decide la dirección del gesto.
    const { onChange } = renderScheduler({
      value: new Set(['lunes-0900', 'lunes-0930', 'lunes-1000', 'lunes-1030']),
    })

    await userEvent.pointer(
      arrastre([cell('lunes', '09:00'), cell('lunes', '09:30'), cell('lunes', '10:00')]),
    )

    expect(lastRanges(onChange)).toEqual({ lunes: [{ start: '10:30', end: '11:00' }] })
  })

  it('el arrastre no se pasa a otro día', async () => {
    const { onChange } = renderScheduler()

    await userEvent.pointer(
      arrastre([cell('lunes', '09:00'), cell('lunes', '09:30'), cell('martes', '09:30')]),
    )

    expect(lastRanges(onChange)).toEqual({ lunes: [{ start: '09:00', end: '10:00' }] })
  })

  it('el arrastre saltea los horarios ocupados y pinta el resto', async () => {
    // Pintar por arriba de una isla ocupada tiene que funcionar y dejarla como
    // está, no cortar el gesto.
    const { onChange } = renderScheduler({
      blockedBySlot: { 'lunes-0930': 'Matemática' },
    })

    await userEvent.pointer(
      arrastre([cell('lunes', '09:00'), cell('lunes', '09:30'), cell('lunes', '10:00')]),
    )

    expect(lastRanges(onChange)).toEqual({
      lunes: [
        { start: '09:00', end: '09:30' },
        { start: '10:00', end: '10:30' },
      ],
    })
  })

  it('soltar afuera de la grilla igual confirma', async () => {
    const { onChange } = renderScheduler()

    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: cell('lunes', '09:00') },
      { target: cell('lunes', '09:30') },
      { keys: '[/MouseLeft]', target: document.body },
    ])

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(lastRanges(onChange)).toEqual({ lunes: [{ start: '09:00', end: '10:00' }] })
  })

  it('una celda ocupada no arranca nada', async () => {
    const { onChange } = renderScheduler({ blockedBySlot: { 'lunes-0900': 'Matemática' } })

    await userEvent.click(cell('lunes', '09:00'))

    expect(onChange).not.toHaveBeenCalled()
    expect(cell('lunes', '09:00')).toHaveAttribute('aria-disabled', 'true')
  })

  it('funciona igual con el dedo', async () => {
    const { onChange } = renderScheduler()

    await userEvent.pointer([
      { keys: '[TouchA>]', target: cell('lunes', '09:00') },
      { pointerName: 'TouchA', target: cell('lunes', '09:30') },
      { keys: '[/TouchA]' },
    ])

    expect(lastRanges(onChange)).toEqual({ lunes: [{ start: '09:00', end: '10:00' }] })
  })

  it('dos medias horas seguidas se ven como un bloque con su etiqueta', () => {
    renderScheduler({ value: new Set(['lunes-1400', 'lunes-1430']) })
    expect(screen.getByText('14:00 – 15:00')).toBeInTheDocument()
  })

  it('con un hueco real hay dos bloques', () => {
    renderScheduler({
      value: new Set(['viernes-1400', 'viernes-1430', 'viernes-1630', 'viernes-1700']),
    })
    expect(screen.getByText('14:00 – 15:00')).toBeInTheDocument()
    expect(screen.getByText('16:30 – 17:30')).toBeInTheDocument()
  })

  it('el bloque ocupado dice qué materia lo ocupa', () => {
    renderScheduler({
      blockedBySlot: { 'lunes-0900': 'Matemática', 'lunes-0930': 'Matemática' },
    })
    expect(screen.getByText('Matemática')).toBeInTheDocument()
  })

  it('los bloques son aria-hidden para que no se lea todo dos veces', () => {
    renderScheduler({ value: new Set(['lunes-1400', 'lunes-1430']) })
    expect(screen.getByText('14:00 – 15:00').closest('.sched-block')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })

  it('las celdas dicen el día y la hora', () => {
    renderScheduler({
      value: new Set(['lunes-0900']),
      blockedBySlot: { 'martes-1000': 'Álgebra' },
    })
    expect(screen.getByLabelText('Lunes 09:00, disponible')).toBeInTheDocument()
    expect(screen.getByLabelText('Martes 10:00, ocupado por Álgebra')).toBeInTheDocument()
    expect(screen.getByLabelText('Miércoles 11:00')).toBeInTheDocument()
  })

  it('hay una sola parada de tabulación en toda la grilla', () => {
    renderScheduler()
    const focusables = [...document.querySelectorAll('[data-index]')].filter(
      (node) => node.getAttribute('tabindex') === '0',
    )
    expect(focusables).toHaveLength(1)
  })

  it('las flechas mueven el foco', async () => {
    renderScheduler({ startHour: 9, endHour: 12 })

    cell('lunes', '09:00').focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(cell('lunes', '09:30'))

    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(cell('martes', '09:30'))
  })

  it('Enter prende la celda enfocada sin contarla dos veces', async () => {
    const { onChange } = renderScheduler()

    cell('lunes', '09:00').focus()
    await userEvent.keyboard('{Enter}')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(lastRanges(onChange)).toEqual({ lunes: [{ start: '09:00', end: '09:30' }] })
  })

  it('desactivado no deja pintar', async () => {
    const { onChange } = renderScheduler({ disabled: true })

    await userEvent.click(cell('lunes', '09:00'))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('copia los horarios de un día a otros', async () => {
    const { onChange } = renderScheduler({ value: new Set(['lunes-0900', 'lunes-0930']) })

    await userEvent.click(screen.getByLabelText('Copiar los horarios de Lunes a otros días'))
    await userEvent.click(screen.getByLabelText('Martes'))
    await userEvent.click(screen.getByLabelText('Miércoles'))
    await userEvent.click(screen.getByRole('button', { name: 'Copiar' }))

    expect(lastRanges(onChange)).toEqual({
      lunes: [{ start: '09:00', end: '10:00' }],
      martes: [{ start: '09:00', end: '10:00' }],
      miercoles: [{ start: '09:00', end: '10:00' }],
    })
  })

  it('copiar avisa cuántos horarios no se pudieron por estar ocupados', async () => {
    const onCopyResult = vi.fn()
    renderScheduler({
      value: new Set(['lunes-0900', 'lunes-0930']),
      blockedBySlot: { 'martes-0930': 'Matemática' },
      onCopyResult,
    })

    await userEvent.click(screen.getByLabelText('Copiar los horarios de Lunes a otros días'))
    await userEvent.click(screen.getByLabelText('Martes'))
    await userEvent.click(screen.getByRole('button', { name: 'Copiar' }))

    expect(onCopyResult).toHaveBeenCalledWith(1)
  })

  it('el menú de copiar se cierra con Escape', async () => {
    renderScheduler()

    await userEvent.click(screen.getByLabelText('Copiar los horarios de Lunes a otros días'))
    expect(screen.getByText('Copiar Lunes a:')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByText('Copiar Lunes a:')).not.toBeInTheDocument()
  })

  it('cuenta lo marcado en el texto de estado', () => {
    renderScheduler({ value: new Set(['lunes-0900', 'lunes-0930', 'martes-1000']) })
    expect(screen.getByRole('status')).toHaveTextContent('1 h 30 min por semana')
  })
})

describe('WeekScheduler en pantalla angosta', () => {
  beforeEach(() => {
    // jsdom no implementa matchMedia: lo estiramos para forzar la vista de un
    // día solo.
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  })

  afterEach(() => {
    delete window.matchMedia
  })

  it('dibuja un solo día y deja cambiarlo con las pestañas', async () => {
    renderScheduler()

    expect(document.querySelectorAll('[data-index]')).toHaveLength(48)
    expect(cell('lunes', '09:00')).toBeInTheDocument()
    expect(cell('martes', '09:00')).toBeNull()

    await userEvent.click(screen.getByRole('tab', { name: 'Mié' }))

    expect(cell('miercoles', '09:00')).toBeInTheDocument()
    expect(cell('lunes', '09:00')).toBeNull()
  })

  it('sigue teniendo el botón de copiar', () => {
    renderScheduler()
    expect(
      screen.getByLabelText('Copiar los horarios de Lunes a otros días'),
    ).toBeInTheDocument()
  })
})
