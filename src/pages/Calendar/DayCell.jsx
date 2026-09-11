import { Component } from 'react'
import { formatDayLong } from '../../utils/calendar.js'

/**
 * Una celda del calendario, al estilo del calendario de Apple: el número del
 * día arriba y abajo una línea por clase (hora + materia). Si no entran
 * todas, se muestran las que entran y una última línea "+N" con las que
 * quedaron afuera.
 *
 * Cuántas líneas entran no lo decide este componente: se lo pasa
 * CalendarPage en `maxVisible`, que mide el alto real de una celda (ver
 * measureVisibleEvents).
 *
 * Es un botón, así que va como clase y no como función (las funciones quedan
 * solo para los íconos SVG, que son pura presentación — ver icons.jsx). El
 * precedente exacto es RoleCard: sin estado propio, pero con onClick.
 *
 * Los estilos están en MonthGrid.css, no en un DayCell.css: fuera de la
 * grilla no significan nada.
 */
class DayCell extends Component {
  /**
   * Qué clases se muestran y cuántas quedan escondidas. Ojo con el caso
   * borde: si sobra una sola, mostrarla igual sería más honesto que un "+1",
   * pero la línea del "+N" ocupa su propio renglón, así que hay que liberar
   * uno.
   */
  getSplit() {
    const { events, maxVisible } = this.props

    if (events.length <= maxVisible) {
      return { visible: events, hidden: 0 }
    }

    const shown = Math.max(maxVisible - 1, 0)
    return { visible: events.slice(0, shown), hidden: events.length - shown }
  }

  getLabel() {
    const { cell, events } = this.props
    const day = formatDayLong(cell.date)
    if (events.length === 0) return `${day}, sin clases`
    return `${day}, ${events.length} ${events.length === 1 ? 'clase' : 'clases'}`
  }

  render() {
    const { cell, selected, onSelect } = this.props
    const { visible, hidden } = this.getSplit()
    const classNames = ['day-cell']
    if (!cell.inMonth) classNames.push('is-outside')
    if (cell.isToday) classNames.push('is-today')
    if (selected) classNames.push('is-selected')

    return (
      <button
        type="button"
        className={classNames.join(' ')}
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={this.getLabel()}
      >
        <span className="day-cell-number">{cell.day}</span>
        <span className="day-cell-events" data-cell-events>
          {visible.map((item) => (
            <span key={item.id} className="day-event">
              <span className="day-event-dot" />
              <span className="day-event-time">{item.startTime}</span>
              <span className="day-event-title">{item.subjectName}</span>
            </span>
          ))}
          {hidden > 0 ? <span className="day-event-more">+{hidden}</span> : null}
        </span>
      </button>
    )
  }
}

DayCell.defaultProps = {
  events: [],
  maxVisible: 3,
  selected: false,
}

export default DayCell
