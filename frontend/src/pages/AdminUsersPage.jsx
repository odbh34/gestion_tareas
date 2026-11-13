import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import ErrorBanner from '../components/ErrorBanner';
import Loading from '../components/Loading';

const ROLE_OPTIONS = [
  { value: 'estudiante', label: 'Estudiante' },
  { value: 'docente', label: 'Docente' },
  { value: 'administrador', label: 'Administrador' },
];

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    api
      .listUsers({ email: query, limit: 100 })
      .then((response) => {
        if (cancelled) return;
        setUsers(response.data);
        setError('');
      })
      .catch((requestError) => {
        if (cancelled) return;
        setError(requestError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  function handleSearch(event) {
    event.preventDefault();
    setLoading(true);
    setQuery(search.trim());
  }

  async function handleRoleChange(targetUser, role) {
    setError('');

    try {
      const response = await api.updateUserRole(targetUser.id, role);
      setUsers((current) =>
        current.map((user) =>
          user.id === targetUser.id ? response.data : user,
        ),
      );
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Usuarios</h1>
          <p className="muted">
            Busca por correo y administra los roles del sistema. La consulta
            usa parámetros seguros en la base de datos.
          </p>
        </div>
        <div className="summary-pill">
          <strong>{users.length}</strong>
          <span>{users.length === 1 ? 'usuario' : 'usuarios'}</span>
        </div>
      </section>

      <ErrorBanner message={error} />

      <div className="panel">
        <form className="search-form" onSubmit={handleSearch}>
          <label className="sr-only" htmlFor="user-search">
            Buscar usuarios por correo
          </label>
          <input
            id="user-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por correo: ana@ejemplo.com"
          />
          <button type="submit" className="button button-secondary">
            Buscar
          </button>
        </form>
      </div>

      {loading ? (
        <Loading label="Cargando usuarios..." />
      ) : users.length === 0 ? (
        <div className="panel empty-state">
          <h2>No se encontraron usuarios</h2>
          <p>Prueba con otro correo o limpia la búsqueda.</p>
        </div>
      ) : (
        <div className="panel table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    {user.name}
                    {user.id === currentUser.id && (
                      <span className="you-label"> (tú)</span>
                    )}
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <select
                      aria-label={`Rol de ${user.name}`}
                      value={user.role}
                      onChange={(event) =>
                        handleRoleChange(user, event.target.value)
                      }
                    >
                      {ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span
                      className={
                        user.is_active ? 'state-active' : 'state-inactive'
                      }
                    >
                      {user.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
