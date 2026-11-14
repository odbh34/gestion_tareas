import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import ErrorBanner from '../components/ErrorBanner';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await api.forgotPassword({ email });
      setSent(true);
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
            <h1>Olvidé mi contraseña</h1>
          </div>
        </div>

        <p className="muted">
          Escribe tu correo y te enviaremos un enlace para restablecer la
          contraseña. El enlace caduca y solo se puede usar una vez.
        </p>

        {sent ? (
          <div className="alert alert-success" role="status">
            Si el correo está registrado, recibirás instrucciones para
            restablecer tu contraseña.
          </div>
        ) : (
          <>
            <ErrorBanner message={error} />

            <form className="form" onSubmit={handleSubmit}>
              <label>
                Correo electrónico
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="ana@ejemplo.com"
                />
              </label>

              <button
                type="submit"
                className="button button-primary button-block"
                disabled={submitting}
              >
                {submitting ? 'Enviando...' : 'Enviar enlace'}
              </button>
            </form>
          </>
        )}

        <p className="auth-switch">
          <Link to="/login">Volver a iniciar sesión</Link>
        </p>
      </section>
    </div>
  );
}
