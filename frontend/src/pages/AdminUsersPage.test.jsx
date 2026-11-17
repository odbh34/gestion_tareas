import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import AdminUsersPage from './AdminUsersPage';

const refresh = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    listUsers: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    updateUserRole: vi.fn(),
    updateUserStatus: vi.fn(),
  },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-id',
      name: 'Administrador',
      email: 'admin@demo.com',
      role: 'administrador',
    },
    refresh,
  }),
}));

const adminUser = {
  id: 'admin-id',
  name: 'Administrador',
  email: 'admin@demo.com',
  role: 'administrador',
  is_active: true,
};

const studentUser = {
  id: 'student-id',
  name: 'Estudiante Uno',
  email: 'estudiante@demo.com',
  role: 'estudiante',
  is_active: true,
};

beforeEach(() => {
  vi.resetAllMocks();
  refresh.mockResolvedValue(adminUser);
  api.listUsers.mockResolvedValue({
    data: [adminUser, studentUser],
    meta: { total: 2 },
  });
});

afterEach(cleanup);

function setup() {
  render(<AdminUsersPage />);
}

describe('AdminUsersPage', () => {
  it('muestra el listado de usuarios', async () => {
    setup();

    expect(await screen.findByText('Estudiante Uno')).toBeInTheDocument();
    expect(screen.getByText('estudiante@demo.com')).toBeInTheDocument();
    expect(api.listUsers).toHaveBeenCalledWith({ email: '', limit: 100 });
  });

  it('crea usuarios con contraseña temporal y rol', async () => {
    const createdUser = {
      id: 'new-id',
      name: 'Docente Nuevo',
      email: 'docente@demo.com',
      role: 'docente',
      is_active: true,
    };
    api.createUser.mockResolvedValue({ data: createdUser });

    setup();
    await screen.findByText('Estudiante Uno');

    fireEvent.change(screen.getByLabelText('Nombre completo'), {
      target: { value: 'Docente Nuevo' },
    });
    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'docente@demo.com' },
    });
    fireEvent.change(screen.getByLabelText(/Contraseña temporal/), {
      target: { value: 'Docente123!' },
    });
    fireEvent.change(screen.getByLabelText('Rol'), {
      target: { value: 'docente' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }));

    await waitFor(() => {
      expect(api.createUser).toHaveBeenCalledWith({
        name: 'Docente Nuevo',
        email: 'docente@demo.com',
        password: 'Docente123!',
        role: 'docente',
      });
    });
    expect(
      await screen.findByText('Usuario docente@demo.com creado correctamente.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Docente Nuevo')).toBeInTheDocument();
  });

  it('edita nombre y correo sin ofrecer cambio de contraseña', async () => {
    const editedUser = {
      ...studentUser,
      name: 'Estudiante Editado',
      email: 'editado@demo.com',
    };
    api.updateUser.mockResolvedValue({ data: editedUser });

    setup();
    await screen.findByText('Estudiante Uno');

    const row = screen.getByText('Estudiante Uno').closest('tr');
    fireEvent.click(
      Array.from(row.querySelectorAll('button')).find(
        (button) => button.textContent === 'Editar',
      ),
    );

    expect(screen.queryByLabelText(/Contraseña temporal/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Nueva contraseña/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Enviar enlace/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nombre completo'), {
      target: { value: 'Estudiante Editado' },
    });
    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'editado@demo.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(api.updateUser).toHaveBeenCalledWith('student-id', {
        name: 'Estudiante Editado',
        email: 'editado@demo.com',
      });
    });
    expect(await screen.findByText('Estudiante Editado')).toBeInTheDocument();
  });

  it('cambia el rol de un usuario desde la tabla', async () => {
    const updatedUser = { ...studentUser, role: 'docente' };
    api.updateUserRole.mockResolvedValue({ data: updatedUser });

    setup();
    await screen.findByText('Estudiante Uno');

    fireEvent.change(screen.getByLabelText('Rol de Estudiante Uno'), {
      target: { value: 'docente' },
    });

    await waitFor(() => {
      expect(api.updateUserRole).toHaveBeenCalledWith('student-id', 'docente');
    });
    expect(
      await screen.findByText('Rol de estudiante@demo.com actualizado correctamente.'),
    ).toBeInTheDocument();
  });

  it('desactiva y reactiva cuentas sin eliminarlas', async () => {
    const inactiveUser = { ...studentUser, is_active: false };
    api.updateUserStatus.mockResolvedValueOnce({ data: inactiveUser });
    api.updateUserStatus.mockResolvedValueOnce({ data: studentUser });

    setup();
    await screen.findByText('Estudiante Uno');

    const row = screen.getByText('Estudiante Uno').closest('tr');
    fireEvent.click(
      Array.from(row.querySelectorAll('button')).find(
        (button) => button.textContent === 'Desactivar',
      ),
    );

    await waitFor(() => {
      expect(api.updateUserStatus).toHaveBeenCalledWith('student-id', false);
    });
    expect(await screen.findByText('Inactivo')).toBeInTheDocument();

    const inactiveRow = screen.getByText('Estudiante Uno').closest('tr');
    fireEvent.click(
      Array.from(inactiveRow.querySelectorAll('button')).find(
        (button) => button.textContent === 'Activar',
      ),
    );

    await waitFor(() => {
      expect(api.updateUserStatus).toHaveBeenCalledWith('student-id', true);
    });
    expect(
      await screen.findByText('Cuenta de estudiante@demo.com reactivada.'),
    ).toBeInTheDocument();
  });

  it('no muestra acciones de restablecimiento ni eliminación', async () => {
    setup();
    await screen.findByText('Estudiante Uno');

    expect(screen.queryByText(/enviar enlace/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/restablecer contraseña/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument();
    expect(api.updateUserStatus).not.toHaveBeenCalled();
  });
});
