import StatusBadge from './StatusBadge';

export default function TaskCard({
  task,
  canEdit = false,
  onEdit,
  onDelete,
  showOwner = false,
}) {
  return (
    <article className="task-card">
      <header className="task-card-header">
        <h3>{task.title}</h3>
        <StatusBadge status={task.status} />
      </header>

      <p className="task-description">
        {task.description || 'Sin descripción'}
      </p>

      {showOwner && (
        <p className="task-owner">
          Dueño: <strong>{task.owner_name}</strong>{' '}
          <span>{task.owner_email}</span>
        </p>
      )}

      <footer className="task-card-footer">
        <time dateTime={task.created_at}>
          Creada: {new Date(task.created_at).toLocaleString('es-ES')}
        </time>

        {canEdit && (
          <div className="task-actions">
            <button
              type="button"
              className="button button-secondary button-small"
              onClick={() => onEdit(task)}
            >
              Editar
            </button>
            <button
              type="button"
              className="button button-danger button-small"
              onClick={() => onDelete(task)}
            >
              Eliminar
            </button>
          </div>
        )}
      </footer>
    </article>
  );
}
