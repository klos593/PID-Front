import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App.jsx'
import { formatMonthTitle } from './utils/calendar.js'

// Mockeamos el cliente entero para no esperar la latencia simulada de los
// datos de mentira y para controlar qué devuelve cada llamada.
// Ojo: vi.mock con factory reemplaza el módulo ENTERO, así que todo lo que
// importe cualquier pantalla tiene que estar acá o llega como undefined.
const {
  loginAccount,
  fetchClasses,
  fetchSubjects,
  registerAccount,
  updateProfile,
  fetchAvailabilityByTeacher,
  saveAvailability,
} = vi.hoisted(() => ({
  loginAccount: vi.fn(),
  fetchClasses: vi.fn(),
  fetchSubjects: vi.fn(),
  registerAccount: vi.fn(),
  updateProfile: vi.fn(),
  fetchAvailabilityByTeacher: vi.fn(),
  saveAvailability: vi.fn(),
}))

vi.mock('./api/client.js', () => ({
  loginAccount,
  fetchClasses,
  fetchSubjects,
  registerAccount,
  updateProfile,
  fetchAvailabilityByTeacher,
  saveAvailability,
}))

const user = {
  id: 1,
  nombre: 'Agustín',
  apellido: 'Klos',
  email: 'agustin@example.com',
  role: 'docente',
  subjectIds: [],
}

function go(path) {
  window.history.pushState({}, '', path)
}

describe('App', () => {
  beforeEach(() => {
    loginAccount.mockReset().mockResolvedValue({ user })
    fetchClasses.mockReset().mockResolvedValue([])
    fetchSubjects.mockReset().mockResolvedValue([])
    registerAccount.mockReset().mockResolvedValue({ user })
    updateProfile.mockReset().mockImplementation((payload) => Promise.resolve({ user: payload }))
    fetchAvailabilityByTeacher.mockReset().mockResolvedValue({})
    saveAvailability.mockReset().mockResolvedValue({})
  })

  async function loguearse() {
    await userEvent.type(screen.getByLabelText('Email'), 'agustin@example.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secreta123')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    await screen.findByText(formatMonthTitle(new Date()))
  }

  it('arranca en el calendario', async () => {
    go('/')
    render(<App />)
    expect(await screen.findByText(formatMonthTitle(new Date()))).toBeInTheDocument()
  })

  it('después de loguearse cae en el calendario', async () => {
    go('/ingresar')
    render(<App />)

    await userEvent.type(screen.getByLabelText('Email'), 'agustin@example.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secreta123')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(await screen.findByText(formatMonthTitle(new Date()))).toBeInTheDocument()
    expect(loginAccount).toHaveBeenCalledWith({
      email: 'agustin@example.com',
      password: 'secreta123',
    })
  })

  it('el perfil muestra los datos del usuario logueado', async () => {
    go('/ingresar')
    render(<App />)

    await userEvent.type(screen.getByLabelText('Email'), 'agustin@example.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secreta123')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    await screen.findByText(formatMonthTitle(new Date()))

    await userEvent.click(screen.getByLabelText('Mi perfil'))
    expect(await screen.findByText('Agustín Klos')).toBeInTheDocument()
  })

  it('arranca con el usuario de prueba ya cargado', async () => {
    // ANDAMIO DE PRUEBA: App arranca con MOCK_USER para no tener que pasar
    // por el login en cada refresh. Cuando eso se saque, este test cambia por
    // el de antes (sin usuario, el perfil muestra "Iniciá sesión..."), que
    // igual sigue cubierto en ProfilePage.test.jsx.
    go('/perfil')
    render(<App />)
    expect(await screen.findByText('Agustín Klos')).toBeInTheDocument()
    expect(screen.queryByText('Iniciá sesión para ver tu perfil.')).not.toBeInTheDocument()
  })

  it('se puede entrar al login aunque ya haya un usuario cargado', async () => {
    // La redirección post-login vive en LoginPage, no en la ruta, justamente
    // para que /ingresar no rebote cuando ya hay usuario.
    go('/ingresar')
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })

  it('lo que se guarda en el perfil sobrevive navegar y volver', async () => {
    // El perfil se desmonta al navegar, así que el dato tiene que quedar en
    // App (handleUserChange) o al volver se vería el teléfono viejo.
    go('/ingresar')
    render(<App />)
    await loguearse()

    await userEvent.click(screen.getByLabelText('Mi perfil'))
    const telefono = await screen.findByLabelText('Teléfono (opcional)')
    await userEvent.clear(telefono)
    await userEvent.type(telefono, '+54 9 11 4321-8765')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText('Listo, guardamos tus cambios.')

    await userEvent.click(screen.getByLabelText('Mi calendario'))
    await screen.findByText(formatMonthTitle(new Date()))

    await userEvent.click(screen.getByLabelText('Mi perfil'))
    expect(await screen.findByLabelText('Teléfono (opcional)')).toHaveValue('+54 9 11 4321-8765')
  })

  it('desde el perfil como docente se llega a la disponibilidad de la materia', async () => {
    // El usuario tiene que DAR la materia para que aparezca la fila con el
    // botón: si no la da, cae en el bloque de "Agregar materia".
    loginAccount.mockResolvedValue({ user: { ...user, subjectIds: [1] } })
    fetchSubjects.mockResolvedValue([{ id: 1, name: 'Matemática' }])
    go('/ingresar')
    render(<App />)
    await loguearse()

    // El usuario de prueba es docente, así que al loguearse viewRole queda
    // en docente y las materias se pueden editar.
    await userEvent.click(screen.getByLabelText('Mi perfil'))
    await userEvent.click(await screen.findByRole('link', { name: 'Disponibilidad de Matemática' }))

    expect(await screen.findByText('Disponibilidad de Matemática')).toBeInTheDocument()
  })

  it('el ícono de la barra lleva a la disponibilidad sin materia', async () => {
    go('/')
    render(<App />)
    await userEvent.click(screen.getByLabelText('Disponibilidad'))
    expect(await screen.findByText('Disponibilidad')).toBeInTheDocument()
  })

  it('una ruta que no existe vuelve al calendario', async () => {
    go('/cualquier-cosa')
    render(<App />)
    expect(await screen.findByText(formatMonthTitle(new Date()))).toBeInTheDocument()
  })
})
