import { Component } from 'react'
import RoleCard from '../../../components/RoleCard.jsx'
import { StudentIcon, TeacherIcon } from '../../../components/icons.jsx'

/** Paso 2 del registro: elegir Docente o Alumno. */
class StepRole extends Component {
  handleNext = () => {
    if (this.props.value) {
      this.props.onNext()
    }
  }

  render() {
    const { value, onSelect, onBack } = this.props

    return (
      <div className="step-role">
        <RoleCard
          icon={<TeacherIcon />}
          title="Docente"
          subtitle="Vas a dar materias"
          selected={value === 'teacher'}
          onClick={() => onSelect('teacher')}
        />
        <RoleCard
          icon={<StudentIcon />}
          title="Alumno"
          subtitle="Te interesan materias"
          selected={value === 'student'}
          onClick={() => onSelect('student')}
        />
        <div className="btn-row">
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            Atrás
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!value}
            onClick={this.handleNext}
          >
            Siguiente
          </button>
        </div>
      </div>
    )
  }
}

export default StepRole
