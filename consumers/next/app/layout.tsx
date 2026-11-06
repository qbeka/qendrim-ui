import type { ReactNode } from 'react';
import '@qbeka/react/styles.css';

export const metadata = { title: 'Next consumer' };

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-q-recipe="editorial">
      <body>{children}</body>
    </html>
  );
}
