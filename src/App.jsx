import { Component } from 'react'
import RegisterPage from './pages/Register/RegisterPage.jsx'
import LoginPage from './pages/Login/LoginPage.jsx'

const VIEW_REGISTER = 'register'
const VIEW_LOGIN = 'login'

/**
 * Punto de montaje de la app: alterna entre Registro y Login sin router
 * (una sola pantalla visible a la vez, todo en `this.state`). Al completar
 * el registro se pasa a Login mostrando un mensaje de éxito. Por ahora
 * arranca en Login (aún no hay una pantalla previa que decida a dónde ir).
 */
class App extends Component {
  state = {
    view: VIEW_LOGIN,
    justRegisteredName: null,
    currentUser: null,
  }

  handleRegisterComplete = (_result, nombre) => {
    this.setState({ view: VIEW_LOGIN, justRegisteredName: nombre })
  }

  handleGoToRegister = () => {
    this.setState({ view: VIEW_REGISTER, justRegisteredName: null })
  }

  handleGoToLogin = () => {
    this.setState({ view: VIEW_LOGIN, justRegisteredName: null })
  }

  handleLoginSuccess = (user) => {
    this.setState({ currentUser: user })
  }

  render() {
    const { view, justRegisteredName, currentUser } = this.state

    if (currentUser) {
      // Todavía no hay una pantalla post-login (dashboard/búsqueda) —
      // placeholder mínimo hasta que se construya esa vista.
      return (
        <div className="auth-page">
          <p>Sesión iniciada como {currentUser.email} ({currentUser.role}).</p>
        </div>
      )
    }

    if (view === VIEW_LOGIN) {
      return (
        <LoginPage
          successMessage={
            justRegisteredName
              ? `¡Listo, ${justRegisteredName}! Tu cuenta fue creada.`
              : null
          }
          onSuccess={this.handleLoginSuccess}
          onGoToRegister={this.handleGoToRegister}
        />
      )
    }

    return <RegisterPage onComplete={this.handleRegisterComplete} onGoToLogin={this.handleGoToLogin} />
  }
}

export default App
