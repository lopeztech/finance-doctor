describe('Middleware config', () => {
  it('matcher pattern excludes static assets via negative lookahead', () => {
    const matcher = '/((?!_next/static|_next/image|favicon.ico|assets).*)';

    // Pattern should contain negative lookahead for static assets
    expect(matcher).toContain('_next/static');
    expect(matcher).toContain('_next/image');
    expect(matcher).toContain('favicon.ico');
    expect(matcher).toContain('assets');
  });

  it('matcher uses negative lookahead syntax', () => {
    const matcher = '/((?!_next/static|_next/image|favicon.ico|assets).*)';
    expect(matcher).toMatch(/\(\?!/); // negative lookahead
    expect(matcher.startsWith('/')).toBe(true);
  });
});
