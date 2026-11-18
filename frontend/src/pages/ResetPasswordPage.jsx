import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import ErrorBanner from '../components/ErrorBanner';
import PasswordInput from '../components/PasswordInput';

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get('token') || '',
  );
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // El token no debe quedar visible en la barra de direcciones ni en el
  // historial una vez leído.
  useEffect(() => {
    if (location.hash) {
      window.history.replaceState(null, '', location.pathname + location.search);
    }
  }, [location.hash, location.pathname, location.search]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (form.newPassword !== form.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setSubmitting(true);

    try {
      await api.resetPassword({
        token,
        newPassword: form.newPassword,
      });
      navigate('/login', {
        replace: true,
        state: { message: 'Contraseña restablecida. Ya puedes iniciar sesión.' },
      });
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
            <h1>Restablecer contraseña</h1>
          </div>
        </div>

        {!token ? (
          <>
            <div className="alert alert-error" role="alert">
              El enlace no incluye un token válido. Solicita uno nuevo.
            </div>
            <p className="auth-switch">
              <Link to="/olvide-contrasena">Solicitar otro enlace</Link>
            </p>
          </>
        ) : (
          <>
            <p className="muted">Elige una contraseña nueva para tu cuenta.</p>

            <ErrorBanner message={error} />

            <form className="form" onSubmit={handleSubmit}>
              <label>
                Nueva contraseña
                <PasswordInput
                  name="newPassword"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={72}
                  required
                  value={form.newPassword}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      newPassword: event.target.value,
                    }))
                  }
                  placeholder="Mínimo 10 caracteres"
                />
                <small>Entre 10 y 72 caracteres.</small>
              </label>

              <label>
                Repetir contraseña
                <PasswordInput
                  name="confirmPassword"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={72}
                  required
                  value={form.confirmPassword}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      confirmPassword: event.target.value,
                    }))
                  }
                  placeholder="Repite la contraseña"
                />
              </label>

              <button
                type="submit"
                className="button button-primary button-block"
                disabled={submitting}
              >
                {submitting ? 'Guardando...' : 'Cambiar contraseña'}
              </button>
            </form>

            <p className="auth-switch">
              <Link to="/login">Volver a iniciar sesión</Link>
            </p>
          </>
        )}
      </section>
    </div>
  );
}
