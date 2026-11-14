import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import ErrorBanner from '../components/ErrorBanner';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const successMessage = location.state?.message;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(form);
      navigate(location.state?.from || '/tasks', { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">
            SR
          </span>
          <div>
            <p className="eyebrow">SportReserve Co.</p>
            <h1>Gestión de tareas</h1>
          </div>
        </div>

        <p className="muted">
          Ingresa con tu cuenta para administrar tus tareas académicas.
        </p>

        {successMessage && (
          <div className="alert alert-success" role="status">
            {successMessage}
          </div>
        )}

        <ErrorBanner message={error} />

        <form className="form" onSubmit={handleSubmit}>
          <label>
            Correo electrónico
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              placeholder="estudiante@demo.com"
            />
          </label>

          <label>
            Contraseña
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              placeholder="Tu contraseña"
            />
          </label>

          <button
            type="submit"
            className="button button-primary button-block"
            disabled={submitting}
          >
            {submitting ? 'Ingresando...' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="auth-switch">
          <Link to="/olvide-contrasena">¿Olvidaste tu contraseña?</Link>
        </p>

        <p className="auth-switch">
          ¿No tienes cuenta? <Link to="/register">Regístrate</Link>
        </p>

        {import.meta.env.DEV && (
          <div className="demo-box">
            <strong>Usuarios demo (solo desarrollo)</strong>
            <ul>
              <li>estudiante@demo.com / Demo12345!</li>
              <li>docente@demo.com / Demo12345!</li>
              <li>admin@demo.com / Demo12345!</li>
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
