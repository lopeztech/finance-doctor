import Menu from '@/config/app-menu';

describe('App Menu', () => {
  it('has a header item', () => {
    const header = Menu.find((item: any) => item.is_header);
    expect(header).toBeDefined();
    expect(header?.title).toBe('Finance Doctor');
  });

  it('has all navigation items', () => {
    const titles = Menu.filter((item: any) => !item.is_header).map((item: any) => item.title);
    expect(titles).toEqual(['Dashboard', 'Cashflow', 'Tax', 'Expenses', 'Investment Portfolio', 'Budgets', 'Goals', 'Net Worth', 'Settings']);
  });

  it('has correct paths', () => {
    const paths = Menu.filter((item: any) => !item.is_header).map((item: any) => item.path);
    expect(paths).toEqual(['/', '/cashflow', '/tax', '/expenses', '/investments', '/budgets', '/goals', '/net-worth', '/settings']);
  });

  it('has icons for all nav items', () => {
    const navItems = Menu.filter((item: any) => !item.is_header);
    navItems.forEach((item: any) => {
      expect(item.icon).toBeDefined();
      expect(item.icon).toMatch(/^fa /);
    });
  });
});
