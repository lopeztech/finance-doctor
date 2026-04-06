import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signIn } from 'next-auth/react';
import LoginPage from '@/app/login/page';

jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
}));

jest.mock('@/config/app-settings', () => ({
  useAppSettings: () => ({
    settings: {},
    updateSettings: jest.fn(),
  }),
}));

describe('Login Page', () => {
  it('renders the brand name', () => {
    render(<LoginPage />);
    expect(screen.getByText('Finance')).toBeInTheDocument();
  });

  it('renders the tagline', () => {
    render(<LoginPage />);
    expect(screen.getByText('Your personal finance health check')).toBeInTheDocument();
  });

  it('renders Google sign-in button', () => {
    render(<LoginPage />);
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
  });

  it('calls signIn when Google button is clicked', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByText('Sign in with Google'));
    expect(signIn).toHaveBeenCalledWith('google', { callbackUrl: '/' });
  });
});
