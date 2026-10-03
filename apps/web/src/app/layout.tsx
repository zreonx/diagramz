import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'Diagramz — AI Collaborative Diagramming Workspace',
  description:
    'Full-stack AI-powered diagramming combining infinite canvas UX, Mermaid code-as-diagrams, and real-time multiplayer collaboration.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.process = window.process || { env: { NODE_ENV: 'production', IS_PREACT: 'false' } };`,
          }}
        />
      </head>
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
