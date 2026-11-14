import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import ErrorBanner from '../components/ErrorBanner';

export default function ChangePasswordPage() {
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (form.newPassword !== form.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setSubmitting(true);

    try {
      await api.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setSuccess(
        'Contraseña actualizada. Las demás sesiones se cerraron y este dispositivo sigue conectado.',
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Cambiar contraseña</h1>
          <p className="muted">
            Al guardar, se cerrarán las sesiones abiertas en otros dispositivos.
          </p>
        </div>
        <Link className="button button-secondary" to="/tasks">
          Volver a tareas
        </Link>
      </header>

      <section className="panel settings-panel">
        {success && (
          <div className="alert alert-success" role="status">
            {success}
          </div>
        )}

        <ErrorBanner message={error} />

        <form className="form" onSubmit={handleSubmit}>
          <label>
            Contraseña actual
            <input
              type="password"
              name="currentPassword"
              autoComplete="current-password"
              required
              value={form.currentPassword}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  currentPassword: event.target.value,
                }))
              }
            />
          </label>

          <label>
            Nueva contraseña
            <input
              type="password"
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
            />
            <small>Entre 10 caracteres y 72 bytes UTF-8.</small>
          </label>

          <label>
            Repetir contraseña nueva
            <input
              type="password"
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
            />
          </label>

          <button
            type="submit"
            className="button button-primary"
            disabled={submitting}
          >
            {submitting ? 'Guardando...' : 'Cambiar contraseña'}
          </button>
        </form>
      </section>
    </div>
  );
}
