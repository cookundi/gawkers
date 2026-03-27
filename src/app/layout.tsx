'use client';
import { PrivyProvider } from '@privy-io/react-auth';
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning={true}>
        <PrivyProvider
          appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
          config={{
            appearance: {
              theme: 'dark',
              accentColor: '#A020F0', // Gawker Purple
              showWalletLoginFirst: true,
            },
          }}
        >
          {children}
        </PrivyProvider>
      </body>
    </html>
  );
}