// FloatingInput lives in @agricoop/ui (used by the Keycloak login theme); tested here, where the
// DOM test setup is.
import { FloatingInput } from '@agricoop/ui';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

describe('FloatingInput', () => {
  afterEach(cleanup);

  it('labels the field and links its error', () => {
    render(<FloatingInput id="username" name="username" label="Identifiant" error="Incorrect." />);
    const input = screen.getByLabelText('Identifiant');
    expect(input).toHaveAttribute('name', 'username');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'username-error');
    expect(screen.getByText('Incorrect.')).toHaveAttribute('id', 'username-error');
  });

  it('can be invalid without a message of its own', () => {
    render(<FloatingInput id="password" label="Mot de passe" invalid />);
    const input = screen.getByLabelText('Mot de passe');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('shows and hides a password', async () => {
    const user = userEvent.setup();
    render(
      <FloatingInput
        id="password"
        type="password"
        label="Mot de passe"
        toggleLabels={{ show: 'Afficher', hide: 'Masquer' }}
      />,
    );
    const input = screen.getByLabelText('Mot de passe');
    expect(input).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Afficher' }));
    expect(input).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Masquer' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('warns while Caps Lock is on', async () => {
    render(
      <FloatingInput
        id="password"
        type="password"
        label="Mot de passe"
        capsLockMessage="Verr. Maj"
      />,
    );
    const input = screen.getByLabelText('Mot de passe');
    fireEvent.keyUp(input, { key: 'A', modifierCapsLock: true });
    expect(screen.getByRole('status')).toHaveTextContent('Verr. Maj');
    expect(input.getAttribute('aria-describedby')).toContain('password-caps');
    fireEvent.blur(input);
    // Gone once its exit animation ends.
    await waitFor(() => expect(screen.queryByText('Verr. Maj')).not.toBeInTheDocument());
  });
});
