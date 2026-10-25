import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Argon Calendar Travel Planner — Schedule & Route Intelligence',
  description:
    'Split-screen calendar and multimodal route planner with deterministic departure calculation and Gemini Argon evidence-backed conflict investigation.',
  icons: {
    icon: [
      { url: '/argon-icon.svg?v=argon1', type: 'image/svg+xml' },
      { url: '/favicon.ico?v=argon1', sizes: '64x64' },
    ],
    shortcut: '/favicon.ico?v=argon1',
    apple: '/apple-touch-icon.png?v=argon1',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
