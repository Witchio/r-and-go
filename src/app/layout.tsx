import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'R & Go — Schedule & Route Intelligence',
  description:
    'R & Go: Split-screen calendar and multimodal route planner with deterministic departure calculation and AI evidence-backed conflict investigation.',
  icons: {
    icon: [
      { url: '/r-and-go-icon.svg?v=randgo1', type: 'image/svg+xml' },
      { url: '/favicon.ico?v=randgo1', sizes: '64x64' },
    ],
    shortcut: '/favicon.ico?v=randgo1',
    apple: '/apple-touch-icon.png?v=randgo1',
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
