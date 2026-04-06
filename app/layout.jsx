import Script from 'next/script';
import './globals.css';
import { CityEyeProvider } from '../components/app/CityEyeProvider';

export const metadata = {
  title: 'CityEye · Urban AI Monitor',
  description: 'CityEye — инфраструктурный execution layer для современного города.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <head>
        <meta name="color-scheme" content="light" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700;800&family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <Script
          src="https://api-maps.yandex.ru/2.1/?apikey=2532047c-bcbe-42f2-9f54-e6a086239004&lang=ru_RU"
          strategy="beforeInteractive"
        />
        <Script
          src="https://yastatic.net/s3/mapsapi-jslibs/heatmap/0.0.1/heatmap.min.js"
          strategy="beforeInteractive"
        />
      </head>
      <body>
        <CityEyeProvider>{children}</CityEyeProvider>
      </body>
    </html>
  );
}
