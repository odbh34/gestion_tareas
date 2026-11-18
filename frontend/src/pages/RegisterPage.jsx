import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import ErrorBanner from '../components/ErrorBanner';
import PasswordInput from '../components/PasswordInput';
import {
  normalizeEmail,
  normalizeName,
  passwordChecks,
  validateEmail,
  validateName,
  validatePassword,
} from '../utils/validation';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function changeField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: '' }));
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const name = normalizeName(form.name);
    const email = normalizeEmail(form.email);
    const errors = {
      name: validateName(name),
      email: validateEmail(email),
      password: validatePassword(form.password, { name, email }),
    };

    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    setSubmitting(true);

    try {
      await register({ name, email, password: form.password });
      navigate('/login', {
        replace: true,
        state: { message: 'Cuenta creada. Ya puedes iniciar sesión.' },
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  const checks = passwordChecks(form.password, {
    name: form.name,
    email: form.email,
  });

  return (
    <div className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">
            SR
          </span>
          <div>
            <p className="eyebrow">SportReserve Co.</p>
            <h1>Crear cuenta</h1>
          </div>
        </div>

        <p className="muted">
          Las cuentas nuevas se crean con rol de estudiante. Un administrador
          puede cambiar el rol después.
        </p>

        <ErrorBanner message={error} />

        <form className="form" onSubmit={handleSubmit} noValidate>
          <label>
            Nombre completo
            <input
              type="text"
              name="name"
              autoComplete="name"
              minLength={2}
              maxLength={80}
              required
              value={form.name}
              onChange={(event) => changeField('name', event.target.value)}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? 'name-error' : undefined}
              placeholder="Ana Pérez"
            />
            {fieldErrors.name && (
              <small id="name-error" className="field-error" role="alert">
                {fieldErrors.name}
              </small>
            )}
          </label>

          <label>
            Correo electrónico
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(event) => changeField('email', event.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              placeholder="ana@ejemplo.com"
            />
            {fieldErrors.email && (
              <small id="email-error" className="field-error" role="alert">
                {fieldErrors.email}
              </small>
            )}
          </label>

          <label>
            Contraseña
            <PasswordInput
              name="password"
              autoComplete="new-password"
              minLength={10}
              maxLength={72}
              required
              value={form.password}
              onChange={(event) => changeField('password', event.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                fieldErrors.password ? 'password-error' : 'password-checks'
              }
              placeholder="Mínimo 10 caracteres"
            />
            {fieldErrors.password && (
              <small id="password-error" className="field-error" role="alert">
                {fieldErrors.password}
              </small>
            )}
            <ul id="password-checks" className="password-checks">
              {checks.map((check) => (
                <li key={check.label} className={check.ok ? 'ok' : undefined}>
                  {check.ok ? '✓' : '○'} {check.label}
                </li>
              ))}
            </ul>
          </label>

          <button
            type="submit"
            className="button button-primary button-block"
            disabled={submitting}
          >
            {submitting ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="auth-switch">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </section>
    </div>
  );
}
