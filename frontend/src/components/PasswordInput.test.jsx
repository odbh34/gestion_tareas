import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import PasswordInput from './PasswordInput';

afterEach(cleanup);

it('muestra y oculta cada contraseña sin enviar el formulario', () => {
  const submit = vi.fn((event) => event.preventDefault());
  render(
    <form onSubmit={submit}>
      <label>Primera contraseña<PasswordInput defaultValue="secreto" /></label>
      <label>Segunda contraseña<PasswordInput defaultValue="otra" /></label>
    </form>,
  );

  const first = screen.getByLabelText('Primera contraseña');
  const second = screen.getByLabelText('Segunda contraseña');
  expect(first).toHaveAttribute('type', 'password');
  expect(second).toHaveAttribute('type', 'password');

  fireEvent.click(screen.getAllByRole('button', { name: 'Mostrar contraseña' })[0]);
  expect(first).toHaveAttribute('type', 'text');
  expect(first).toHaveValue('secreto');
  expect(second).toHaveAttribute('type', 'password');
  expect(submit).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
  expect(first).toHaveAttribute('type', 'password');
  expect(first).toHaveValue('secreto');
});
