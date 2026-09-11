import { Component } from 'react'
import { StudentIcon, TeacherIcon } from './icons.jsx'

/**
 * Botón para mirar la app como docente o como alumno.
 *
 * ANDAMIO DE PRUEBA — ESTO NO VA A PRODUCCIÓN. Existe solo para poder ver las
 * dos vistas mientras no haya sesión de verdad. Cuando el login devuelva el
 * rol del usuario, este botón se borra entero y `viewRole` pasa a salir de
 * `user.role` en App.
 *
 * Qué toca: el calendario (de quién es el nombre en cada clase), el perfil
 * (si las materias se editan o son de solo lectura) y el texto de la pantalla
 * de disponibilidad. NO cambia quién está logueado — de ahí que el perfil
 * avise cuando el rol que se mira no es el de la cuenta.
 *
 * A diferencia del tema, el rol lo necesitan varias pantallas, así que el
 * estado vive en App y acá solo llega por props.
 */
class RoleToggle extends Component {
  render() {
    const { role, onToggle } = this.props
    const esDocente = role === 'docente'

    return (
      <button
        type="button"
        className="navbar-icon-btn"
        onClick={onToggle}
        aria-label={esDocente ? 'Viendo como docente. Ver como alumno' : 'Viendo como alumno. Ver como docente'}
      >
        {esDocente ? <TeacherIcon /> : <StudentIcon />}
      </button>
    )
  }
}

export default RoleToggle
