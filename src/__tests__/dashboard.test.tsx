import { render, screen } from '@testing-library/react';
import Dashboard from '@/app/page';

jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

describe('Dashboard', () => {
  it('renders the page header', () => {
    render(<Dashboard />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders Tax Health card', () => {
    render(<Dashboard />);
    expect(screen.getByText('Tax Health')).toBeInTheDocument();
    expect(screen.getByText(/Upload your expenses/)).toBeInTheDocument();
  });

  it('renders Investment Health card', () => {
    render(<Dashboard />);
    expect(screen.getByText('Investment Health')).toBeInTheDocument();
    expect(screen.getByText(/Add your investments/)).toBeInTheDocument();
  });

  it('links to /tax and /investments', () => {
    render(<Dashboard />);
    const links = screen.getAllByText('Get started');
    expect(links).toHaveLength(2);

    const taxLink = links[0].closest('a');
    const investLink = links[1].closest('a');
    expect(taxLink).toHaveAttribute('href', '/tax');
    expect(investLink).toHaveAttribute('href', '/investments');
  });
});
