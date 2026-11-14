import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ROLE_LABELS = {
  estudiante: 'Estudiante',
  docente: 'Docente',
  administrador: 'Administrador',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            SR
          </span>
          <div>
            <strong>SportReserve Tasks</strong>
            <small>Gestión académica de tareas</small>
          </div>
        </div>

        <nav className="main-nav" aria-label="Navegación principal">
          <NavLink
            to="/tasks"
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            Tareas
          </NavLink>
          {user?.role === 'administrador' && (
            <NavLink
              to="/admin/users"
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              Usuarios
            </NavLink>
          )}
          <NavLink
            to="/cambiar-contrasena"
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            Contraseña
          </NavLink>
        </nav>

        <div className="user-menu">
          <div className="user-chip">
            <strong>{user?.name}</strong>
            <span>{ROLE_LABELS[user?.role] || user?.role}</span>
          </div>
          <button
            type="button"
            className="button button-secondary button-small"
            onClick={handleLogout}
          >
            Salir
          </button>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <footer className="footer">
        <span>Proyecto de Ingeniería de Software</span>
        <span>API segura · Roles · Pruebas automatizadas</span>
      </footer>
    </div>
  );
}
