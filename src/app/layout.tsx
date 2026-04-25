import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'GAWKERS — The Gauntlet',
    description: 'Pixel-art gaming powerhouse on Ethereum. Play to earn your mint.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body suppressHydrationWarning>{children}</body>
        </html>
    );
}
