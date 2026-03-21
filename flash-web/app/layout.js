import './globals.css';
import Script from 'next/script';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';

export const metadata = {
  title: 'Flash Data Express - Instant Data Bundles Ghana',
  description: 'Buy affordable data bundles instantly in Ghana. MTN, Telecel & AirtelTigo. Fastest delivery, best prices.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#111827',
                color: '#E2E8F0',
                borderRadius: '12px',
                fontSize: '14px',
                border: '1px solid rgba(255,255,255,0.06)',
              },
              success: { iconTheme: { primary: '#10B981', secondary: '#fff' } },
              error: { iconTheme: { primary: '#EF4444', secondary: '#fff' } }
            }}
          />
        </AuthProvider>
        <Script id="rezolv-config" strategy="lazyOnload">
          {`window.REZOLV_CONFIG = { apiKey: "rzlv_22c149e96a8e3fb9d632e0fc6cdf631555c8d7b0b674cd4948565729e0eec468" };`}
        </Script>
        <Script src="https://api.rezolv.dev/widget.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
