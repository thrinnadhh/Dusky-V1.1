import React from 'react';

export const metadata = { title: 'Dusky Admin' };

export default function RootLayout({ children }: React.PropsWithChildren): React.JSX.Element {
  return <html lang="en"><body>{children}</body></html>;
}

