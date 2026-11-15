import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import ForgotPasswordPage from './ForgotPasswordPage';

vi.mock('../api/client', () => ({ api: { forgotPassword: vi.fn() } }));

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

describe('ForgotPasswordPage', () => {
  function setup() {
    render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);
    return screen.getByLabelText('Correo electrónico');
  }

  it('valida el correo requerido y su formato', () => {
    const email = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect(email).toBeInvalid();
    fireEvent.change(email, { target: { value: 'incorrecto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect(email).toBeInvalid();
    expect(api.forgotPassword).not.toHaveBeenCalled();
  });

  it('muestra carga y confirmación tras enviar el correo', async () => {
    let resolve;
    api.forgotPassword.mockReturnValue(new Promise((done) => { resolve = done; }));
    const email = setup();
    fireEvent.change(email, { target: { value: 'ana@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect(api.forgotPassword).toHaveBeenCalledWith({ email: 'ana@example.com' });
    expect(screen.getByRole('button', { name: 'Enviando...' })).toBeDisabled();
    resolve();
    expect(await screen.findByRole('status')).toHaveTextContent('Si el correo está registrado');
    expect(screen.queryByLabelText('Correo electrónico')).not.toBeInTheDocument();
  });

  it('muestra el error y permite reintentar', async () => {
    api.forgotPassword.mockRejectedValueOnce(new Error('Error de servidor')).mockResolvedValueOnce();
    const email = setup();
    fireEvent.change(email, { target: { value: 'ana@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Error de servidor');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar enlace' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
