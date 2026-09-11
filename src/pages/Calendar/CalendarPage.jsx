import { Component, createRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Banner from '../../components/Banner.jsx'
import MonthHeader from './MonthHeader.jsx'
import MonthGrid from './MonthGrid.jsx'
import DayAgenda from './DayAgenda.jsx'
import {
  addMonths,
  buildMonthGrid,
  formatMonthTitle,
  fromISODate,
  startOfMonth,
  toISODate,
} from '../../utils/calendar.js'
import { fetchClasses } from '../../api/client.js'
import './CalendarPage.css'

// Mismo patrón que RegisterPage pero con menos desplazamiento: acá se mueve
// una grilla entera, no una tarjeta, y 60px se sentía exagerado.
const slideVariants = {
  enter: (direction) => ({ x: direction > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction > 0 ? -40 : 40, opacity: 0 }),
}

// Cuántas clases mostrar por celda antes de poder medir de verdad (y en
// jsdom, donde no hay layout y todo mide 0).
const DEFAULT_VISIBLE_EVENTS = 3
const FALLBACK_LINE_HEIGHT = 19

// Esta pantalla es "mis clases": solo las reservadas/confirmadas. Los turnos
// libres son de la pantalla de disponibilidad, no de acá.
const CALENDAR_STATUS = 'reservada'

/**
 * Pantalla principal: a la derecha el calendario del mes (con las clases de
 * cada día adentro de cada casillero, estilo calendario de Apple) y a la
 * izquierda el detalle del día seleccionado. Es la primera pantalla que ve
 * alguien que entra a la app.
 *
 * Es el único componente con métodos de ciclo de vida, y va explicado porque
 * rompe con el resto: en RegisterPage el fetch tiene un disparador natural
 * (el usuario pasa de paso), pero una pantalla de entrada no tiene ninguno —
 * los datos tienen que estar cuando aparece. componentDidMount es el
 * equivalente en clases a un efecto de montaje, y componentDidUpdate
 * recarga cuando se cambia de mes. El otro motivo para tener ciclo de vida
 * acá es que hay que medir el alto real de las celdas, y eso solo se puede
 * hacer después de pintar.
 */
class CalendarPage extends Component {
  state = {
    viewDate: startOfMonth(new Date().getFullYear(), new Date().getMonth()),
    selectedIso: toISODate(new Date()),
    direction: 1,
    classes: [],
    classesLoading: false,
    classesError: null,
    maxVisibleEvents: DEFAULT_VISIBLE_EVENTS,
  }

  // Contador para descartar respuestas viejas: si se cambia de mes mientras
  // una request está en vuelo, la que llega tarde no tiene que pisar el
  // estado. También neutraliza el doble montaje que hace <StrictMode> en
  // desarrollo.
  fetchToken = 0

  gridRef = createRef()

  componentDidMount() {
    this.loadClasses()
    this.measureVisibleEvents()
    window.addEventListener('resize', this.measureVisibleEvents)
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.viewDate !== this.state.viewDate) {
      this.loadClasses()
    }
    // Las celdas cambian de alto cuando aparece el cartel de error o cuando
    // el navegador termina de acomodar la grilla.
    this.measureVisibleEvents()
  }

  componentWillUnmount() {
    this.fetchToken += 1
    window.removeEventListener('resize', this.measureVisibleEvents)
  }

  getWeeks() {
    const { viewDate } = this.state
    return buildMonthGrid(viewDate.getFullYear(), viewDate.getMonth())
  }

  /** Las clases agrupadas por fecha ISO, cada lista ordenada por hora. */
  getClassesByDate() {
    const map = {}

    for (const item of this.state.classes) {
      // Se las pedimos al backend con ?status=reservada, pero mientras el
      // endpoint no exista no queremos depender de que respete el filtro: un
      // turno libre acá se leería como una clase que nadie reservó.
      if (item.status && item.status !== CALENDAR_STATUS) continue
      if (!map[item.date]) map[item.date] = []
      map[item.date].push(item)
    }

    // Las clases duran 1 h y arrancan :00 o :30, así que comparar los
    // strings 'HH:MM' alcanza para ordenarlas.
    for (const iso of Object.keys(map)) {
      map[iso].sort((a, b) => a.startTime.localeCompare(b.startTime))
    }

    return map
  }

  /**
   * Cuántas líneas de clase entran en una celda. Se mide el contenedor de
   * las clases (que se queda con el alto sobrante, así que no depende de
   * cuántas haya) y se lo divide por el alto de una línea, que sale de la
   * variable CSS --day-event-line para no repetir el número en dos lados.
   *
   * En jsdom todo mide 0: en ese caso no tocamos el valor por defecto.
   */
  measureVisibleEvents = () => {
    const grid = this.gridRef.current
    if (!grid) return

    const container = grid.querySelector('[data-cell-events]')
    if (!container) return

    const available = container.clientHeight
    if (available <= 0) return

    const declared = getComputedStyle(grid).getPropertyValue('--day-event-line')
    const lineHeight = parseFloat(declared) || FALLBACK_LINE_HEIGHT
    const max = Math.max(Math.floor(available / lineHeight), 0)

    if (max !== this.state.maxVisibleEvents) {
      this.setState({ maxVisibleEvents: max })
    }
  }

  loadClasses = () => {
    const weeks = this.getWeeks()
    const from = weeks[0][0].iso
    const to = weeks[weeks.length - 1][6].iso
    const token = ++this.fetchToken

    this.setState({ classesLoading: true, classesError: null })
    fetchClasses({ from, to, status: CALENDAR_STATUS })
      .then((classes) => {
        if (token !== this.fetchToken) return
        // Defensivo: si el backend devuelve algo que no es un array,
        // preferimos una lista vacía a romper el render de la grilla.
        this.setState({
          classes: Array.isArray(classes) ? classes : [],
          classesLoading: false,
        })
      })
      .catch((error) => {
        if (token !== this.fetchToken) return
        this.setState({
          classesLoading: false,
          classesError: error.message || 'No se pudieron cargar las clases.',
        })
      })
  }

  handlePrevMonth = () => {
    this.setState((prev) => ({ viewDate: addMonths(prev.viewDate, -1), direction: -1 }))
  }

  handleNextMonth = () => {
    this.setState((prev) => ({ viewDate: addMonths(prev.viewDate, 1), direction: 1 }))
  }

  handleToday = () => {
    const today = new Date()
    this.setState((prev) => {
      const viewDate = startOfMonth(today.getFullYear(), today.getMonth())
      return {
        viewDate: viewDate.getTime() === prev.viewDate.getTime() ? prev.viewDate : viewDate,
        selectedIso: toISODate(today),
        direction: viewDate < prev.viewDate ? -1 : 1,
      }
    })
  }

  handleSelectDay = (iso) => () => {
    this.setState({ selectedIso: iso })
  }

  render() {
    const { viewDate, selectedIso, direction, classesLoading, classesError, maxVisibleEvents } =
      this.state
    const classesByDate = this.getClassesByDate()

    return (
      <div className="calendar-page">
        <section className="calendar-main">
          <MonthHeader
            title={formatMonthTitle(viewDate)}
            loading={classesLoading}
            onPrev={this.handlePrevMonth}
            onNext={this.handleNextMonth}
            onToday={this.handleToday}
          />
          {classesError ? <Banner type="danger">{classesError}</Banner> : null}
          <div className="calendar-viewport">
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={viewDate.getTime()}
                className="calendar-slide"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
                <MonthGrid
                  weeks={this.getWeeks()}
                  classesByDate={classesByDate}
                  selectedIso={selectedIso}
                  onSelectDay={this.handleSelectDay}
                  maxVisibleEvents={maxVisibleEvents}
                  gridRef={this.gridRef}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        {/* Va después en el DOM pero se dibuja a la izquierda (order en el
            CSS): el calendario es el contenido principal y el detalle es
            complementario. En pantallas chicas se apilan en el orden del
            DOM, que es el que conviene ahí. */}
        <aside className="calendar-aside">
          <DayAgenda
            date={fromISODate(selectedIso)}
            classes={classesByDate[selectedIso] || []}
            loading={classesLoading}
            viewRole={this.props.viewRole}
          />
        </aside>
      </div>
    )
  }
}

export default CalendarPage
