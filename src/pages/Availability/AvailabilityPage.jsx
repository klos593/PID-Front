import { Component } from 'react'
import { Link } from 'react-router-dom'
import withRouter from '../../routes/withRouter.jsx'
import WeekScheduler from './WeekScheduler.jsx'
import Banner from '../../components/Banner.jsx'
import { ClockIcon, SpinnerIcon } from '../../components/icons.jsx'
import { fetchAvailabilityByTeacher, fetchSubjects, saveAvailability } from '../../api/client.js'
import { MOCK_SUBJECTS } from '../../api/mocks.js'
import {
  countSlots,
  formatSlotTotal,
  rangesToSlotIds,
  sameSlots,
  slotIdsToRanges,
} from '../../utils/availability.js'
import './AvailabilityPage.css'

/**
 * Disponibilidad semanal de UNA materia: el docente pinta las medias horas en
 * las que da clase. Las clases duran 1 h y arrancan en punto o y media (ver
 * CLAUDE.md), así que la unidad de la grilla es la media hora y dos seguidas
 * son una clase.
 *
 * Dos formas de ruta:
 *   /disponibilidad              → elegir materia (solo las que da)
 *   /disponibilidad/:materiaId   → la grilla de esa materia
 *
 * El docente no puede estar en dos lugares a la vez: los horarios que ya marcó
 * para OTRA materia se muestran ocupados y no se pueden tocar. Por eso se piden
 * todas las materias de una sola vez (fetchAvailabilityByTeacher) y no solo la
 * que se está editando — los horarios bloqueados son la unión de las otras.
 *
 * La vista de alumno sigue siendo el placeholder de antes a propósito: esta
 * pantalla es del docente, y la del alumno (ver turnos libres y reservar) es
 * otra cosa que se hace después.
 */
class AvailabilityPage extends Component {
  state = {
    slotIds: new Set(),
    // Lo último que devolvió el backend: con esto se sabe si hay cambios sin
    // guardar y es a lo que vuelve "Cancelar".
    savedSlotIds: new Set(),
    blockedBySlot: {},
    // El mapa crudo { [materiaId]: horario }, para que el elegidor pueda decir
    // cuántas horas tiene cargada cada materia.
    bySubject: {},
    subjects: [],
    loading: false,
    loadError: null,
    saving: false,
    saveError: null,
    saved: false,
    copyHint: null,
  }

  // Mismo patrón que CalendarPage: descarta respuestas que llegaron tarde.
  fetchToken = 0

  componentDidMount() {
    if (this.canEdit()) this.loadAvailability()
  }

  componentDidUpdate(prevProps) {
    // React Router reusa la misma instancia al ir de /disponibilidad/1 a
    // /disponibilidad/3, así que sin esto la pantalla mostraría los horarios de
    // una materia diciendo que son de la otra.
    if (prevProps.router.params.materiaId !== this.props.router.params.materiaId) {
      if (this.canEdit()) this.loadAvailability()
    }
  }

  componentWillUnmount() {
    this.fetchToken += 1
  }

  canEdit() {
    return Boolean(this.props.user) && this.props.viewRole === 'docente'
  }

  getSubjectId() {
    const { materiaId } = this.props.router.params
    if (!materiaId) return null
    const id = Number(materiaId)
    return Number.isInteger(id) ? id : null
  }

  /** Las materias que el docente da, resueltas contra el catálogo. */
  getMySubjects() {
    const ids = this.props.user?.subjectIds || []
    return this.state.subjects.filter((subject) => ids.includes(subject.id))
  }

  getSubject() {
    const id = this.getSubjectId()
    if (id === null) return null
    return this.state.subjects.find((subject) => subject.id === id) || null
  }

  teachesSubject() {
    const id = this.getSubjectId()
    return (this.props.user?.subjectIds || []).includes(id)
  }

  hasChanges() {
    return !sameSlots(this.state.slotIds, this.state.savedSlotIds)
  }

  getTitle() {
    const subject = this.getSubject()
    return subject ? `Disponibilidad de ${subject.name}` : 'Disponibilidad'
  }

  loadAvailability = () => {
    const token = ++this.fetchToken
    this.setState({ loading: true, loadError: null, saved: false, copyHint: null })

    Promise.all([fetchAvailabilityByTeacher(this.props.user.id), fetchSubjects()])
      .then(([bySubject, subjects]) => {
        if (token !== this.fetchToken) return

        const id = this.getSubjectId()
        const lista = Array.isArray(subjects) ? subjects : []
        const mine = rangesToSlotIds(bySubject?.[id])

        // Los horarios ocupados son la unión de las OTRAS materias.
        const blockedBySlot = {}
        for (const [otherId, schedule] of Object.entries(bySubject || {})) {
          if (Number(otherId) === id) continue
          const subject = lista.find((item) => item.id === Number(otherId))
          const name = subject ? subject.name : 'otra materia'
          for (const slot of rangesToSlotIds(schedule)) {
            // Si dos materias se pisan (no debería, pero el backend todavía no
            // lo valida) gana la primera: el cartel nombra UNA materia.
            if (!blockedBySlot[slot]) blockedBySlot[slot] = name
          }
        }

        this.setState({
          slotIds: mine,
          savedSlotIds: mine,
          blockedBySlot,
          bySubject: bySubject || {},
          subjects: lista,
          loading: false,
        })
      })
      .catch((error) => {
        if (token !== this.fetchToken) return
        this.setState({
          loading: false,
          loadError: error.message || 'No se pudo cargar la disponibilidad.',
        })
      })
  }

  handleChangeSlots = (slotIds) => {
    this.setState({ slotIds, saved: false })
  }

  handleCopyResult = (skipped) => {
    this.setState({
      copyHint:
        skipped > 0
          ? `No se copiaron ${skipped} ${skipped === 1 ? 'horario' : 'horarios'} porque ya los ocupa otra materia.`
          : null,
    })
  }

  handleCancel = () => {
    this.setState((prev) => ({
      slotIds: prev.savedSlotIds,
      saveError: null,
      saved: false,
      copyHint: null,
    }))
  }

  handleSubmit = (event) => {
    event.preventDefault()

    const schedule = slotIdsToRanges(this.state.slotIds)
    this.setState({ saving: true, saveError: null, saved: false })

    saveAvailability(this.getSubjectId(), schedule)
      .then(() => {
        this.setState((prev) => ({ saving: false, saved: true, savedSlotIds: prev.slotIds }))
      })
      .catch((error) => {
        this.setState({
          saving: false,
          saveError: error.message || 'No se pudieron guardar los horarios.',
        })
      })
  }

  /**
   * El placeholder de siempre: la pantalla del alumno se hace después. Resuelve
   * la materia contra la lista de mentira y no contra el catálogo cargado
   * porque el alumno no dispara ninguna carga — no tiene nada que editar.
   * TODO: cuando esta pantalla haga algo, traer la materia con fetchSubjects().
   */
  renderStudentPlaceholder() {
    const { materiaId } = this.props.router.params
    const id = this.getSubjectId()
    const subject = id === null ? null : MOCK_SUBJECTS.find((item) => item.id === id) || null

    return (
      <div className="availability-empty">
        <ClockIcon />
        <h1 className="availability-title">
          {subject ? `Disponibilidad de ${subject.name}` : 'Disponibilidad'}
        </h1>
        {materiaId && !subject ? (
          <p className="availability-warning">No encontramos esa materia.</p>
        ) : null}
        <p className="availability-hint">
          Acá vas a poder ver los horarios libres de cada docente y reservar tu clase.
        </p>
        <p className="availability-hint">Todavía está en construcción.</p>
      </div>
    )
  }

  renderSubjectChooser() {
    const materias = this.getMySubjects()

    if (materias.length === 0) {
      return (
        <div className="availability-empty">
          <ClockIcon />
          <h1 className="availability-title">Disponibilidad</h1>
          <p className="availability-hint">
            Todavía no elegiste qué materias das. Agregalas desde tu perfil y después volvé acá a
            cargar tus horarios.
          </p>
          <Link className="auth-link" to="/perfil">
            Ir a mi perfil
          </Link>
        </div>
      )
    }

    return (
      <div className="availability-chooser">
        <h1 className="availability-title">Disponibilidad</h1>
        <p className="availability-hint">
          Elegí una materia para cargar los días y horarios en los que la das.
        </p>
        <ul className="availability-subject-list">
          {materias.map((subject) => (
            <li key={subject.id}>
              <Link className="availability-subject-link" to={`/disponibilidad/${subject.id}`}>
                <span className="availability-subject-name">{subject.name}</span>
                <span className="availability-subject-total">
                  {formatSlotTotal(countSlots(rangesToSlotIds(this.state.bySubject[subject.id])))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  renderScheduler() {
    const { slotIds, blockedBySlot, saving, saveError, saved, copyHint, loadError } = this.state

    return (
      <form className="availability-editor" onSubmit={this.handleSubmit}>
        <div className="availability-editor-head">
          <h1 className="availability-title">{this.getTitle()}</h1>
          <p className="availability-hint">
            Pintá las medias horas en las que das clase. Podés arrastrar para marcar un rato entero
            y usar el botón de cada día para copiarlo a los demás.
          </p>
        </div>

        {loadError ? <Banner type="danger">{loadError}</Banner> : null}
        {saveError ? <Banner type="danger">{saveError}</Banner> : null}
        {saved ? <Banner type="success">Listo, guardamos tus horarios.</Banner> : null}
        {copyHint ? <Banner type="danger">{copyHint}</Banner> : null}

        <WeekScheduler
          value={slotIds}
          blockedBySlot={blockedBySlot}
          onChange={this.handleChangeSlots}
          onCopyResult={this.handleCopyResult}
          disabled={saving}
        />

        <div className="btn-row">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={this.handleCancel}
            disabled={!this.hasChanges() || saving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!this.hasChanges() || saving}
          >
            {saving ? <SpinnerIcon className="spin" /> : null}
            Guardar cambios
          </button>
        </div>

        {/* Para poder verificar a mano lo que se va a mandar mientras no haya
            backend. Cuando el endpoint exista esto se puede sacar. */}
        <details className="availability-json">
          <summary>Ver lo que se va a guardar</summary>
          <pre>{JSON.stringify(slotIdsToRanges(slotIds), null, 2)}</pre>
        </details>
      </form>
    )
  }

  renderBody() {
    const { user, viewRole } = this.props

    // La vista de alumno va PRIMERO y no pide usuario: es informativa y las
    // rutas de la app no tienen portero (ver App.jsx). El login solo hace
    // falta para editar.
    if (viewRole !== 'docente') return this.renderStudentPlaceholder()

    if (!user) {
      return (
        <div className="availability-empty">
          <p>Iniciá sesión para cargar tu disponibilidad.</p>
          <Link className="auth-link" to="/ingresar">
            Ir al login
          </Link>
        </div>
      )
    }

    if (this.state.loading) {
      return (
        <div className="availability-empty">
          <SpinnerIcon className="spin" />
          <p className="availability-hint">Cargando tus horarios...</p>
        </div>
      )
    }

    if (this.getSubjectId() === null) return this.renderSubjectChooser()

    if (!this.teachesSubject()) {
      return (
        <div className="availability-empty">
          <ClockIcon />
          <h1 className="availability-title">Disponibilidad</h1>
          <p className="availability-warning">No estás dando esa materia.</p>
          <Link className="auth-link" to="/disponibilidad">
            Elegir otra materia
          </Link>
        </div>
      )
    }

    return this.renderScheduler()
  }

  render() {
    return <div className="availability-page">{this.renderBody()}</div>
  }
}

AvailabilityPage.defaultProps = {
  viewRole: 'alumno',
}

export default withRouter(AvailabilityPage)
