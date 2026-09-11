import { Component } from "react";
import SchedulerCell from "./SchedulerCell.jsx";
import {
  buildDayColumn,
  dayLabel,
  slotIdAt,
} from "../../utils/availability.js";

// Abajo de esto no entra '14:00 – 15:00' adentro del bloque.
const MIN_LABEL_HEIGHT = 26;

/**
 * Una columna = un día. Dibuja las DOS CAPAS sobre la misma grilla CSS: abajo
 * los botones de media hora (uno por fila) y encima los bloques ya fusionados,
 * con grid-row: span N y pointer-events: none.
 *
 * Un elemento que abarca varias filas tapa también los gaps de 1px que hay
 * entre ellas, así que el bloque borra sus propias líneas internas y se ve como
 * un rectángulo entero — el mismo truco de líneas finitas de MonthGrid, al
 * revés. Y como no recibe eventos, el área sensible sigue siendo la celda de
 * media hora que tiene debajo.
 *
 * Los bloques van con aria-hidden: lo semántico son los botones. Si no, un
 * lector de pantalla leería '14:00 – 15:00' y después las dos celdas otra vez.
 *
 * Todos los eventos se escuchan acá y no en cada celda: son 3 listeners por
 * columna en vez de 3 por celda, y las celdas quedan sin props que cambien de
 * identidad en cada render.
 */
class SchedulerDayColumn extends Component {
  shouldComponentUpdate(nextProps) {
    if (
      nextProps.selectedIds !== this.props.selectedIds ||
      nextProps.blockedBySlot !== this.props.blockedBySlot ||
      nextProps.focusedId !== this.props.focusedId ||
      nextProps.fromIndex !== this.props.fromIndex ||
      nextProps.toIndex !== this.props.toIndex ||
      nextProps.slotHeight !== this.props.slotHeight
    ) {
      return true;
    }

    // Una columna que no participa del arrastre no cambia. Con 7 columnas esto
    // saca la mayor parte del trabajo de cada paso.
    const participaba = this.props.draftDay === this.props.dayKey;
    const participa = nextProps.draftDay === nextProps.dayKey;
    if (!participaba && !participa) return false;

    return (
      participaba !== participa ||
      nextProps.draftFrom !== this.props.draftFrom ||
      nextProps.draftTo !== this.props.draftTo
    );
  }

  /** El estado que se está dibujando, con el arrastre en curso aplicado. */
  getPreviewIds() {
    const {
      dayKey,
      selectedIds,
      draftDay,
      draftFrom,
      draftTo,
      draftMode,
      blockedBySlot,
    } = this.props;

    if (draftDay !== dayKey || draftFrom === null || draftTo === null)
      return selectedIds;

    const preview = new Set(selectedIds);
    const from = Math.min(draftFrom, draftTo);
    const to = Math.max(draftFrom, draftTo);

    for (let index = from; index <= to; index++) {
      const id = slotIdAt(dayKey, index);
      // Los horarios ocupados por otra materia no se pintan ni se despintan.
      if (blockedBySlot[id]) continue;
      if (draftMode === "add") preview.add(id);
      else preview.delete(id);
    }

    return preview;
  }

  getCellLabel(cell) {
    const dia = dayLabel(this.props.dayKey);
    if (cell.state === "blocked")
      return `${dia} ${cell.time}, ocupado por ${cell.blockedBy}`;
    if (cell.state === "selected") return `${dia} ${cell.time}, disponible`;
    return `${dia} ${cell.time}`;
  }

  render() {
    const { dayKey, fromIndex, toIndex, blockedBySlot, focusedId, slotHeight } =
      this.props;

    const { cells, blocks } = buildDayColumn({
      dayKey,
      fromIndex,
      toIndex,
      selectedIds: this.getPreviewIds(),
      blockedBySlot,
    });

    return (
      <div
        className="sched-day"
        data-day={dayKey}
        onPointerDown={this.props.onPointerDown}
        onPointerOver={this.props.onPointerOver}
        onClick={this.props.onClick}
        onKeyDown={this.props.onKeyDown}
      >
        {cells.map((cell) => (
          <SchedulerCell
            key={cell.id}
            dayKey={dayKey}
            index={cell.index}
            row={cell.index - fromIndex + 1}
            state={cell.state}
            isHalf={cell.isHalf}
            focusable={cell.id === focusedId}
            label={this.getCellLabel(cell)}
          />
        ))}

        {blocks.map((block) => {
          // La etiqueta se dibuja si el bloque ENTERO tiene alto para ella: un
          // bloque de una hora son dos celdas, así que entra aunque una sola
          // no entraría.
          const compacto = block.span * slotHeight < MIN_LABEL_HEIGHT;
          return (
            <div
              key={block.key}
              className={`sched-block is-${block.state} ${compacto ? "is-compact" : ""}`}
              style={{
                gridRow: `${block.from - fromIndex + 1} / span ${block.span}`,
              }}
              aria-hidden="true"
            >
              <span className="sched-block-time">{block.label}</span>
              {block.blockedBy ? (
                <span className="sched-block-subject">{block.blockedBy}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }
}

SchedulerDayColumn.defaultProps = {
  blockedBySlot: {},
  draftDay: null,
  draftFrom: null,
  draftTo: null,
  draftMode: null,
  focusedId: null,
  slotHeight: 14,
};

export default SchedulerDayColumn;
