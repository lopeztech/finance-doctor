import Menu from '@/config/app-menu';

const navItems = () => Menu.filter(item => !item.is_header);

describe('App Menu', () => {
  it('has a header item', () => {
    const header = Menu.find(item => item.is_header);
    expect(header).toBeDefined();
    expect(header?.title).toBe('Finance Doctor');
  });

  it('has all navigation items', () => {
    const titles = navItems().map(item => item.title);
    expect(titles).toEqual(['Financial Advisor', 'Tax Advisor', 'Cashflow Advisor', 'Investments', 'Spending Data', 'Budgets', 'Settings']);
  });

  it('has correct paths', () => {
    const paths = navItems().map(item => item.path);
    expect(paths).toEqual(['/', '/tax', '/cashflow', '/investments', '/expenses', '/budgets', '/settings']);
  });

  it('has icons for all nav items', () => {
    navItems().forEach(item => {
      expect(item.icon).toBeDefined();
      expect(item.icon).toMatch(/^fa /);
    });
  });
});
