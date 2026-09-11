import { Component } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './routes/AppLayout.jsx'
import AvailabilityPage from './pages/Availability/AvailabilityPage.jsx'
import CalendarPage from './pages/Calendar/CalendarPage.jsx'
import LoginPage from './pages/Login/LoginPage.jsx'
import ProfilePage from './pages/Profile/ProfilePage.jsx'
import RegisterPage from './pages/Register/RegisterPage.jsx'
import SearchResultsPage from './pages/Search/SearchResultsPage.jsx'
import { MOCK_USER } from './api/mocks.js'

/**
 * Punto de montaje de la app, ahora con rutas de verdad (react-router-dom)
 * en lugar del switch de vistas a mano que había antes. La pantalla de
 * entrada es el calendario.
 *
 * La sesión es solo `this.state.user`, en memoria: todavía no hay backend de
 * auth y no queremos inventar un token falso, así que refrescar la página la
 * pierde. Las rutas no tienen portero, así que sin usuario igual se llega al
 * calendario (con datos de mentira).
 *
 * ANDAMIO DE PRUEBA — arranca con el usuario de mentira YA logueado (ver
 * MOCK_USER más abajo), para no tener que pasar por el login en cada refresh
 * mientras se arman las pantallas. Se borra junto con el interruptor de rol
 * (ver RoleToggle.jsx) el día que el login sea de verdad: ahí `user` vuelve a
 * arrancar en null y el perfil vuelve a mostrar el cartel de "iniciá sesión".
 * El login sigue funcionando igual si se entra a /ingresar.
 *
 * Todas las redirecciones se hacen con <Navigate> y todos los links con
 * <Link>/<NavLink>: son componentes comunes, no hooks, así que esto sigue
 * siendo un class component como el resto de la app.
 */
class App extends Component {
  state = {
    // ANDAMIO DE PRUEBA: acá va null cuando el login sea de verdad.
    user: MOCK_USER,
    justRegisteredName: null,
    // Desde qué rol se está mirando la app. ANDAMIO DE PRUEBA: el botón de la
    // barra (RoleToggle) NO va a producción. Arranca en el rol del usuario que
    // se loguea; el día que se borre el botón, esto se reemplaza por user.role
    // y sale del estado.
    viewRole: MOCK_USER.role,
  }

  handleLoginSuccess = (result) => {
    const user = result?.user ?? null
    this.setState({
      user,
      justRegisteredName: null,
      viewRole: user?.role === 'docente' ? 'docente' : 'alumno',
    })
  }

  handleRegisterComplete = (_result, nombre) => {
    this.setState({ justRegisteredName: nombre })
  }

  // Andamio de prueba — ver RoleToggle.jsx.
  handleToggleRole = () => {
    this.setState((prev) => ({ viewRole: prev.viewRole === 'docente' ? 'alumno' : 'docente' }))
  }

  /**
   * App es el dueño de `user`, así que el perfil avisa para acá cuando
   * guarda. Sin esto, salir del perfil lo desmonta y al volver se vería el
   * dato viejo. No se toca `viewRole`: ese lo maneja el interruptor de la
   * barra, no lo que se guardó.
   */
  handleUserChange = (user) => {
    this.setState({ user })
  }

  render() {
    const { user, justRegisteredName, viewRole } = this.state

    return (
      <BrowserRouter>
        <Routes>
          {/* Sin guardia de "ya está logueado": la redirección después de
              entrar la hace LoginPage con su propio <Navigate>, así /ingresar
              se puede visitar igual (hace falta ahora que la app arranca con
              un usuario de prueba ya cargado). */}
          <Route
            path="/ingresar"
            element={
              <LoginPage
                successMessage={
                  justRegisteredName
                    ? `¡Listo, ${justRegisteredName}! Tu cuenta fue creada.`
                    : null
                }
                onSuccess={this.handleLoginSuccess}
              />
            }
          />
          <Route
            path="/registro"
            element={<RegisterPage onComplete={this.handleRegisterComplete} />}
          />

          {/* Ruta sin path: solo aporta el layout (barra superior) a las de
              adentro, y así el NavBar no se remonta al cambiar de pantalla. */}
          <Route element={<AppLayout viewRole={viewRole} onToggleRole={this.handleToggleRole} />}>
            <Route path="/" element={<CalendarPage viewRole={viewRole} />} />
            <Route
              path="/perfil"
              element={
                <ProfilePage
                  user={user}
                  viewRole={viewRole}
                  onUserChange={this.handleUserChange}
                />
              }
            />
            <Route path="/buscar" element={<SearchResultsPage />} />
            {/* Dos rutas para la misma pantalla: con materia (desde el botón
                de cada materia del perfil) y sin materia (desde el ícono de
                la barra). La v7 de react-router sacó los parámetros
                opcionales, así que no se puede escribir en una sola. */}
            <Route
              path="/disponibilidad"
              element={<AvailabilityPage viewRole={viewRole} user={user} />}
            />
            <Route
              path="/disponibilidad/:materiaId"
              element={<AvailabilityPage viewRole={viewRole} user={user} />}
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    )
  }
}

export default App
