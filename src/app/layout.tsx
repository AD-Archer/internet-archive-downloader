import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { DownloadProvider } from '@/context';
import { ToastContainer } from '@/components';

// Use Inter font with extended Latin character set
const inter = Inter({ 
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Internet Archive Downloader",
  description: "Download content from Internet Archive to your server",
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:9321"),
  openGraph: {
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "Internet Archive Downloader Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [
      {
        url: "/logo.png",
        alt: "Internet Archive Downloader Logo",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark:bg-gray-900">
      <body className={`${inter.className} bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen`}>
        <DownloadProvider>
          <ToastContainer />
          {children}
        </DownloadProvider>
      </body>
    </html>
  );
}
