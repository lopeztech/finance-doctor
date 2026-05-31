'use client';

import '@fortawesome/fontawesome-free/css/all.css';
import 'react-perfect-scrollbar/dist/css/styles.css';
import '@/styles/nextjs.scss';

import { useEffect } from 'react';
import '@/lib/firebase';
import AuthGate from '@/components/auth-gate';
import ErrorBoundary from '@/components/error-boundary';
import GuestBanner from '@/components/guest-banner';
import Masthead from '@/components/ledger/Masthead';
import { AppSettingsProvider } from '@/config/app-settings';
import { PreferencesProvider } from '@/lib/use-preferences';
import { MemberProvider } from '@/lib/use-member';
import { Open_Sans } from 'next/font/google';
import { Source_Serif_4 } from 'next/font/google';

const openSans = Open_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700', '800'],
  display: 'swap',
  variable: '--font-open-sans',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-source-serif',
});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('bootstrap').then(bootstrap => {
        (window as Window & { bootstrap?: unknown }).bootstrap = bootstrap;
      }).catch(() => {});
    }
  }, []);

  return (
    <html lang="en" className={`${openSans.variable} ${sourceSerif.variable} ${openSans.className}`}>
      <head>
        <title>Finance Doctor</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body>
        <AppSettingsProvider>
          <PreferencesProvider>
            <AuthGate>
              <MemberProvider>
                <Masthead />
                <GuestBanner />
                <ErrorBoundary>{children}</ErrorBoundary>
              </MemberProvider>
            </AuthGate>
          </PreferencesProvider>
        </AppSettingsProvider>
      </body>
    </html>
  );
}
