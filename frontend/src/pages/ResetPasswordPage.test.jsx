import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import ResetPasswordPage from './ResetPasswordPage';

vi.mock('../api/client', () => ({ api: { resetPassword: vi.fn() } }));

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

function Login() {
  const location = useLocation();
  return <div>{location.state?.message}</div>;
}

function setup(url = '/restablecer?origen=correo#token=abc%2B123') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/restablecer" element={<ResetPasswordPage />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </MemoryRouter>,
  );
}

function fillPasswords(password = 'password123', confirmation = password) {
  fireEvent.change(screen.getByLabelText(/Nueva contraseña/), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Repetir contraseña'), { target: { value: confirmation } });
}

describe('ResetPasswordPage', () => {
  it('rechaza un enlace sin token y ofrece solicitar otro', () => {
    setup('/restablecer');
    expect(screen.getByRole('alert')).toHaveTextContent('El enlace no incluye un token válido');
    expect(screen.getByRole('link', { name: 'Solicitar otro enlace' })).toHaveAttribute('href', '/olvide-contrasena');
    expect(screen.queryByRole('button', { name: 'Cambiar contraseña' })).not.toBeInTheDocument();
  });

  it('elimina el fragmento de la URL y usa el token original para restablecer', async () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');
    let resolve;
    api.resetPassword.mockReturnValue(new Promise((done) => { resolve = done; }));
    setup();
    expect(replaceState).toHaveBeenCalledWith(null, '', '/restablecer?origen=correo');
    replaceState.mockRestore();
    fillPasswords();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(api.resetPassword).toHaveBeenCalledWith({ token: 'abc+123', newPassword: 'password123' });
    expect(screen.getByRole('button', { name: 'Guardando...' })).toBeDisabled();
    resolve();
    expect(await screen.findByText('Contraseña restablecida. Ya puedes iniciar sesión.')).toBeInTheDocument();
  });

  it('valida campos requeridos y contraseñas diferentes', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(screen.getByLabelText(/Nueva contraseña/)).toBeInvalid();
    fillPasswords('password123', 'diferente123');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Las contraseñas no coinciden');
    expect(api.resetPassword).not.toHaveBeenCalled();
  });

  it('muestra errores de la API y habilita de nuevo el formulario', async () => {
    api.resetPassword.mockRejectedValue(new Error('Token caducado'));
    setup();
    fillPasswords();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Token caducado');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cambiar contraseña' })).toBeEnabled());
  });
});
