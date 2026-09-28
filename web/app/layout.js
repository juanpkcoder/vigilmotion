import './globals.css';

export const metadata = {
  title: 'VigilMotion — Centro de Monitoreo 24/7 y Alertas WhatsApp',
  description: 'Sistema inteligente de teleasistencia y detección de caídas para adultos mayores con alertas prioritarias directas a WhatsApp.',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#060913',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🛡️</text></svg>" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>{children}</body>
    </html>
  );
}
