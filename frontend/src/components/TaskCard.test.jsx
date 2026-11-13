import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TaskCard from './TaskCard';

const baseTask = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Tarea de prueba',
  description: 'Descripción normal',
  status: 'pendiente',
  owner_id: '22222222-2222-4222-8222-222222222222',
  owner_name: 'Ana Pérez',
  owner_email: 'ana@example.com',
  created_at: '2026-01-15T10:00:00.000Z',
};

describe('TaskCard', () => {
  it('renderiza contenido peligroso como texto, no como HTML', () => {
    const { container } = render(
      <TaskCard
        task={{
          ...baseTask,
          title: '<script>alert(1)</script>',
          description: '<img src=x onerror=alert(1)>',
        }}
        canEdit={false}
      />,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(
      screen.getByText('<script>alert(1)</script>'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('<img src=x onerror=alert(1)>'),
    ).toBeInTheDocument();
  });

  it('muestra el dueño cuando se solicita', () => {
    render(<TaskCard task={baseTask} showOwner />);

    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
  });

  it('solo muestra acciones si el usuario puede editar', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    const { rerender } = render(
      <TaskCard
        task={baseTask}
        canEdit={false}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    expect(screen.queryByText('Editar')).not.toBeInTheDocument();
    expect(screen.queryByText('Eliminar')).not.toBeInTheDocument();

    rerender(
      <TaskCard
        task={baseTask}
        canEdit
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText('Editar')).toBeInTheDocument();
    expect(screen.getByText('Eliminar')).toBeInTheDocument();
  });
});
