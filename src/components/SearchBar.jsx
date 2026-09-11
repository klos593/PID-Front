import { Component } from 'react'
import { SearchIcon } from './icons.jsx'
import './SearchBar.css'

/**
 * Buscador de la barra superior. Por ahora es solo la cáscara visual: el
 * input está controlado (el estado del texto vive acá) pero el submit
 * todavía no busca nada — ver el TODO en handleSubmit.
 *
 * Reusa la forma del buscador de materias de SubjectPicker (ícono a la
 * izquierda, input con padding para no taparlo), pero redondeado como
 * pastilla para que se lea como parte de la barra.
 */
class SearchBar extends Component {
  state = {
    query: '',
  }

  handleChange = (event) => {
    this.setState({ query: event.target.value })
  }

  handleSubmit = (event) => {
    event.preventDefault()
    // TODO(buscador): cuando exista /api/teachers?q= hay que navegar a
    // /buscar?q=<query> y mostrar los resultados en SearchResultsPage. El
    // puente para navegar desde un class component ya existe
    // (routes/withRouter.jsx): envolver este componente y usar
    // this.props.router.navigate. Falta solamente el endpoint.
  }

  render() {
    return (
      <form className="search-bar" role="search" onSubmit={this.handleSubmit}>
        <SearchIcon />
        <input
          type="search"
          value={this.state.query}
          onChange={this.handleChange}
          placeholder="Buscar docentes o materias..."
          aria-label="Buscar docentes o materias"
        />
      </form>
    )
  }
}

export default SearchBar
