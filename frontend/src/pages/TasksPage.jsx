import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import ErrorBanner from '../components/ErrorBanner';
import Loading from '../components/Loading';
import TaskCard from '../components/TaskCard';

const EMPTY_FORM = {
  title: '',
  description: '',
  status: 'pendiente',
};

const STATUS_OPTIONS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_progreso', label: 'En progreso' },
  { value: 'completada', label: 'Completada' },
  { value: 'cancelada', label: 'Cancelada' },
];

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ status: '', q: '', page: 1 });
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    api
      .listTasks({
        status: filters.status,
        q: filters.q,
        page: filters.page,
        limit: 12,
      })
      .then((response) => {
        if (cancelled) return;
        setTasks(response.data);
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
  }, [filters, reloadToken]);

  function refreshTasks() {
    setLoading(true);
    setReloadToken((token) => token + 1);
  }

  function updateFilter(key, value) {
    setLoading(true);
    setFilters((current) => ({
      ...current,
      [key]: value,
      page: key === 'page' ? value : 1,
    }));
  }

  function handleSearch(event) {
    event.preventDefault();
    updateFilter('q', search.trim());
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (editingId) {
        await api.updateTask(editingId, form);
      } else {
        await api.createTask(form);
      }
      resetForm();
      refreshTasks();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(task) {
    setEditingId(task.id);
    setForm({
      title: task.title,
      description: task.description,
      status: task.status,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(task) {
    const confirmed = window.confirm(`¿Eliminar la tarea "${task.title}"?`);
    if (!confirmed) return;

    setError('');

    try {
      await api.deleteTask(task.id);
      if (editingId === task.id) {
        resetForm();
      }
      refreshTasks();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function canEdit(task) {
    return user.role === 'administrador' || task.owner_id === user.id;
  }

  const roleHint =
    user.role === 'docente'
      ? 'Como docente puedes consultar todas las tareas, pero solo editar las tuyas.'
      : user.role === 'administrador'
        ? 'Como administrador puedes gestionar todas las tareas y usuarios.'
        : 'Como estudiante solo ves y gestionas tus propias tareas.';

  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Panel de tareas</p>
          <h1>Hola, {user.name}</h1>
          <p className="muted">{roleHint}</p>
        </div>
        <div className="summary-pill">
          <strong>{meta?.total ?? 0}</strong>
          <span>{meta?.total === 1 ? 'tarea' : 'tareas'}</span>
        </div>
      </section>

      <ErrorBanner message={error} />

      <div className="tasks-layout">
        <aside className="panel form-panel">
          <div className="panel-heading">
            <h2>{editingId ? 'Editar tarea' : 'Nueva tarea'}</h2>
            {editingId && (
              <button
                type="button"
                className="link-button"
                onClick={resetForm}
              >
                Cancelar
              </button>
            )}
          </div>

          <form className="form" onSubmit={handleSubmit}>
            <label>
              Título
              <input
                type="text"
                name="title"
                required
                maxLength={120}
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Ej. Entregar informe"
              />
            </label>

            <label>
              Descripción
              <textarea
                name="description"
                rows={4}
                maxLength={2000}
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Detalles de la tarea"
              />
            </label>

            <label>
              Estado
              <select
                name="status"
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="button button-primary button-block"
              disabled={saving}
            >
              {saving
                ? 'Guardando...'
                : editingId
                  ? 'Guardar cambios'
                  : 'Crear tarea'}
            </button>
          </form>
        </aside>

        <section className="tasks-main">
          <div className="panel toolbar">
            <form className="search-form" onSubmit={handleSearch}>
              <label className="sr-only" htmlFor="task-search">
                Buscar tareas
              </label>
              <input
                id="task-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por título o descripción"
              />
              <button type="submit" className="button button-secondary">
                Buscar
              </button>
            </form>

            <label className="filter-label">
              Estado
              <select
                value={filters.status}
                onChange={(event) =>
                  updateFilter('status', event.target.value)
                }
              >
                <option value="">Todos</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <Loading label="Cargando tareas..." />
          ) : tasks.length === 0 ? (
            <div className="panel empty-state">
              <h2>No hay tareas para mostrar</h2>
              <p>
                Crea la primera tarea desde el formulario o cambia los filtros
                de búsqueda.
              </p>
            </div>
          ) : (
            <div className="task-list">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  canEdit={canEdit(task)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  showOwner={user.role !== 'estudiante'}
                />
              ))}
            </div>
          )}

          {meta && meta.totalPages > 1 && (
            <nav className="pagination" aria-label="Paginación de tareas">
              <button
                type="button"
                className="button button-secondary button-small"
                disabled={filters.page <= 1}
                onClick={() => updateFilter('page', filters.page - 1)}
              >
                Anterior
              </button>
              <span>
                Página {meta.page} de {meta.totalPages}
              </span>
              <button
                type="button"
                className="button button-secondary button-small"
                disabled={filters.page >= meta.totalPages}
                onClick={() => updateFilter('page', filters.page + 1)}
              >
                Siguiente
              </button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
