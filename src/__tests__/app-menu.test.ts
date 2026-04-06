import Menu from '@/config/app-menu';

describe('App Menu', () => {
  it('has a header item', () => {
    const header = Menu.find((item: any) => item.is_header);
    expect(header).toBeDefined();
    expect(header?.title).toBe('Finance Doctor');
  });

  it('has Dashboard, Tax, and Investments items', () => {
    const titles = Menu.filter((item: any) => !item.is_header).map((item: any) => item.title);
    expect(titles).toEqual(['Dashboard', 'Tax', 'Investments']);
  });

  it('has correct paths', () => {
    const paths = Menu.filter((item: any) => !item.is_header).map((item: any) => item.path);
    expect(paths).toEqual(['/', '/tax', '/investments']);
  });

  it('has icons for all nav items', () => {
    const navItems = Menu.filter((item: any) => !item.is_header);
    navItems.forEach((item: any) => {
      expect(item.icon).toBeDefined();
      expect(item.icon).toMatch(/^fa /);
    });
  });
});
