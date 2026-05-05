import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Gauntlet - By Gawkers',
    description: 'Pixel-art gaming powerhouse on Ethereum.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body suppressHydrationWarning>{children}</body>
        </html>
    );
}
