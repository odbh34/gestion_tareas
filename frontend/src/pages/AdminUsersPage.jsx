import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import ErrorBanner from '../components/ErrorBanner';
import Loading from '../components/Loading';
import PasswordInput from '../components/PasswordInput';
import {
  PASSWORD_RULES,
  validateUserFields,
} from '../utils/userFormValidation';

const ROLE_OPTIONS = [
  { value: 'estudiante', label: 'Estudiante' },
  { value: 'docente', label: 'Docente' },
  { value: 'administrador', label: 'Administrador' },
];

const EMPTY_CREATE_FORM = {
  name: '',
  email: '',
  password: '',
  role: 'estudiante',
};

const EMPTY_EDIT_FORM = {
  name: '',
  email: '',
};

function FieldError({ id, message }) {
  if (!message) return null;

  return (
    <small id={id} className="field-error" role="alert">
      {message}
    </small>
  );
}

export default function AdminUsersPage() {
  const { user: currentUser, refresh } = useAuth();
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateErrors, setShowCreateErrors] = useState(false);
  const [showEditErrors, setShowEditErrors] = useState(false);

  const createErrors = validateUserFields(createForm);
  const editErrors = validateUserFields(editForm);

  useEffect(() => {
    let cancelled = false;

    api
      .listUsers({ email: query, limit: 100 })
      .then((response) => {
        if (cancelled) return;
        setUsers(response.data);
        setMeta(response.meta);
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

  function replaceUser(updatedUser) {
    setUsers((current) =>
      current.map((user) =>
        user.id === updatedUser.id ? updatedUser : user,
      ),
    );
  }

  async function handleCreate(event) {
    event.preventDefault();
    setShowCreateErrors(true);
    if (Object.keys(createErrors).length > 0) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.createUser(createForm);
      setUsers((current) => [response.data, ...current]);
      setMeta((current) =>
        current ? { ...current, total: current.total + 1 } : current,
      );
      setCreateForm(EMPTY_CREATE_FORM);
      setShowCreateErrors(false);
      setSuccess(`Usuario ${response.data.email} creado correctamente.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function startEditing(user) {
    setEditingUser(user);
    setEditForm({ name: user.name, email: user.email });
    setShowEditErrors(false);
    setError('');
    setSuccess('');
  }

  function cancelEditing() {
    setEditingUser(null);
    setEditForm(EMPTY_EDIT_FORM);
    setShowEditErrors(false);
  }

  async function handleEdit(event) {
    event.preventDefault();
    if (!editingUser) return;

    setShowEditErrors(true);
    if (Object.keys(editErrors).length > 0) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.updateUser(editingUser.id, editForm);
      replaceUser(response.data);

      if (editingUser.id === currentUser.id) {
        await refresh().catch(() => {});
      }

      setEditingUser(null);
      setEditForm(EMPTY_EDIT_FORM);
      setShowEditErrors(false);
      setSuccess(`Usuario ${response.data.email} actualizado correctamente.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(targetUser, role) {
    setActionId(targetUser.id);
    setError('');
    setSuccess('');

    try {
      const response = await api.updateUserRole(targetUser.id, role);
      replaceUser(response.data);
      setSuccess(`Rol de ${response.data.email} actualizado correctamente.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setActionId(null);
    }
  }

  async function handleStatusChange(targetUser) {
    const nextActive = !targetUser.is_active;

    setActionId(targetUser.id);
    setError('');
    setSuccess('');

    try {
      const response = await api.updateUserStatus(targetUser.id, nextActive);
      replaceUser(response.data);
      setSuccess(
        nextActive
          ? `Cuenta de ${response.data.email} reactivada.`
          : `Cuenta de ${response.data.email} desactivada.`,
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setActionId(null);
    }
  }

  const busy = saving || actionId !== null;
  const total = meta?.total ?? users.length;

  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Usuarios</h1>
          <p className="muted">
            Crea cuentas, edita nombre y correo, cambia roles y activa o
            desactiva usuarios. Las cuentas no se eliminan para conservar sus
            tareas.
          </p>
        </div>
        <div className="summary-pill">
          <strong>{total}</strong>
          <span>{total === 1 ? 'usuario' : 'usuarios'}</span>
        </div>
      </section>

      <ErrorBanner message={error} />

      {success && (
        <div className="alert alert-success" role="status">
          {success}
        </div>
      )}

      <div className="tasks-layout">
        <section className="panel form-panel">
          <div className="panel-heading">
            <h2>{editingUser ? 'Editar usuario' : 'Nuevo usuario'}</h2>
          </div>

          {editingUser ? (
            <form className="form" onSubmit={handleEdit} noValidate>
              <div className="field">
                <label htmlFor="edit-name">Nombre completo</label>
                <input
                  id="edit-name"
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={80}
                  value={editForm.name}
                  aria-invalid={Boolean(showEditErrors && editErrors.name)}
                  aria-describedby={
                    showEditErrors && editErrors.name
                      ? 'edit-name-error'
                      : undefined
                  }
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
                <FieldError
                  id="edit-name-error"
                  message={showEditErrors ? editErrors.name : ''}
                />
              </div>

              <div className="field">
                <label htmlFor="edit-email">Correo electrónico</label>
                <input
                  id="edit-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={120}
                  value={editForm.email}
                  aria-invalid={Boolean(showEditErrors && editErrors.email)}
                  aria-describedby={
                    showEditErrors && editErrors.email
                      ? 'edit-email-error'
                      : undefined
                  }
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
                <FieldError
                  id="edit-email-error"
                  message={showEditErrors ? editErrors.email : ''}
                />
              </div>

              <p className="muted">
                El rol se cambia desde la tabla. Para volver a crear una cuenta,
                cancela esta edición.
              </p>

              <div className="task-actions">
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={saving}
                >
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={saving}
                  onClick={cancelEditing}
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <form className="form" onSubmit={handleCreate} noValidate>
              <div className="field">
                <label htmlFor="create-name">Nombre completo</label>
                <input
                  id="create-name"
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={80}
                  value={createForm.name}
                  aria-invalid={Boolean(showCreateErrors && createErrors.name)}
                  aria-describedby={
                    showCreateErrors && createErrors.name
                      ? 'create-name-error'
                      : undefined
                  }
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
                <FieldError
                  id="create-name-error"
                  message={showCreateErrors ? createErrors.name : ''}
                />
              </div>

              <div className="field">
                <label htmlFor="create-email">Correo electrónico</label>
                <input
                  id="create-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={120}
                  value={createForm.email}
                  aria-invalid={Boolean(showCreateErrors && createErrors.email)}
                  aria-describedby={
                    showCreateErrors && createErrors.email
                      ? 'create-email-error'
                      : undefined
                  }
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
                <FieldError
                  id="create-email-error"
                  message={showCreateErrors ? createErrors.email : ''}
                />
              </div>

              <div className="field">
                <label htmlFor="create-password">Contraseña temporal</label>
                <PasswordInput
                  id="create-password"
                  name="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                  maxLength={72}
                  value={createForm.password}
                  aria-invalid={Boolean(
                    showCreateErrors && createErrors.password,
                  )}
                  aria-describedby="create-password-rules"
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                />
                <ul
                  id="create-password-rules"
                  className="password-rules"
                  aria-label="Requisitos de la contraseña"
                >
                  {PASSWORD_RULES.map((rule) => {
                    const met = rule.test(createForm.password);
                    return (
                      <li
                        key={rule.id}
                        className={met ? 'rule-met' : 'rule-pending'}
                      >
                        <span aria-hidden="true">{met ? '✓' : '○'}</span>{' '}
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
                <FieldError
                  id="create-password-error"
                  message={showCreateErrors ? createErrors.password : ''}
                />
              </div>

              <div className="field">
                <label htmlFor="create-role">Rol</label>
                <select
                  id="create-role"
                  name="role"
                  value={createForm.role}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      role: event.target.value,
                    }))
                  }
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="button button-primary"
                disabled={saving}
              >
                {saving ? 'Creando...' : 'Crear usuario'}
              </button>
            </form>
          )}
        </section>

        <div className="tasks-main">
          <div className="panel toolbar">
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
                    <th>Acciones</th>
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
                          disabled={busy || user.id === currentUser.id}
                          title={
                            user.id === currentUser.id
                              ? 'No puedes cambiar tu propio rol'
                              : undefined
                          }
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
                      <td>
                        <div className="task-actions">
                          <button
                            type="button"
                            className="button button-secondary button-small"
                            disabled={busy}
                            onClick={() => startEditing(user)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className={
                              user.is_active
                                ? 'button button-danger button-small'
                                : 'button button-secondary button-small'
                            }
                            disabled={
                              busy ||
                              (user.id === currentUser.id && user.is_active)
                            }
                            title={
                              user.id === currentUser.id && user.is_active
                                ? 'No puedes desactivar tu propia cuenta'
                                : undefined
                            }
                            onClick={() => handleStatusChange(user)}
                          >
                            {user.is_active ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
