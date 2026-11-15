import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import ChangePasswordPage from './ChangePasswordPage';

vi.mock('../api/client', () => ({ api: { changePassword: vi.fn() } }));

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

function setup() {
  render(<MemoryRouter><ChangePasswordPage /></MemoryRouter>);
}

function fillPasswords(confirmation = 'password123') {
  fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'actual123' } });
  fireEvent.change(screen.getByLabelText(/Nueva contraseña/), { target: { value: 'password123' } });
  fireEvent.change(screen.getByLabelText('Repetir contraseña nueva'), { target: { value: confirmation } });
}

describe('ChangePasswordPage', () => {
  it('valida campos requeridos y contraseñas diferentes', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(screen.getByLabelText('Contraseña actual')).toBeInvalid();
    fillPasswords('diferente123');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Las contraseñas no coinciden');
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it('muestra carga y limpia los campos al cambiar la contraseña', async () => {
    let resolve;
    api.changePassword.mockReturnValue(new Promise((done) => { resolve = done; }));
    setup();
    fillPasswords();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(api.changePassword).toHaveBeenCalledWith({ currentPassword: 'actual123', newPassword: 'password123' });
    expect(screen.getByRole('button', { name: 'Guardando...' })).toBeDisabled();
    resolve();
    expect(await screen.findByRole('status')).toHaveTextContent('Contraseña actualizada');
    expect(screen.getByLabelText('Contraseña actual')).toHaveValue('');
    expect(screen.getByLabelText(/Nueva contraseña/)).toHaveValue('');
    expect(screen.getByLabelText('Repetir contraseña nueva')).toHaveValue('');
  });

  it('muestra errores de la API y conserva los datos para reintentar', async () => {
    api.changePassword.mockRejectedValue(new Error('Contraseña actual incorrecta'));
    setup();
    fillPasswords();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Contraseña actual incorrecta');
    expect(screen.getByLabelText('Contraseña actual')).toHaveValue('actual123');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cambiar contraseña' })).toBeEnabled());
  });
});
