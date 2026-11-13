import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="auth-page">
      <section className="auth-card centered">
        <p className="eyebrow">Error 404</p>
        <h1>Página no encontrada</h1>
        <p className="muted">
          La dirección que intentaste abrir no existe en esta aplicación.
        </p>
        <Link to="/tasks" className="button button-primary">
          Volver a las tareas
        </Link>
      </section>
    </div>
  );
}
