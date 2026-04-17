import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signInWithPopup } from 'firebase/auth';
import LoginPage from '@/app/login/page';

jest.mock('firebase/auth', () => ({
  signInWithPopup: jest.fn().mockResolvedValue({ user: { uid: 'test' } }),
  GoogleAuthProvider: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@/lib/firebase', () => ({
  auth: {},
}));

jest.mock('@/config/app-settings', () => ({
  useAppSettings: () => ({
    settings: {},
    updateSettings: jest.fn(),
  }),
}));

describe('Login Page', () => {
  beforeEach(() => jest.clearAllMocks());

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

  it('calls signInWithPopup when Google button is clicked', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByText('Sign in with Google'));
    expect(signInWithPopup).toHaveBeenCalled();
  });
});
