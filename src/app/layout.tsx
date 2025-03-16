import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { DownloadProvider } from "@/context/DownloadContext";
import { Toaster } from "react-hot-toast";
import StartupCheck from "@/components/StartupCheck";

// Use Inter font from Google Fonts
const inter = Inter({ 
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter"
});

export const metadata: Metadata = {
  title: "Internet Archive Downloader",
  description: "Download files and playlists from Internet Archive",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <DownloadProvider>
          <StartupCheck />
          <header className="bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] text-white p-6 shadow-lg">
            <div className="container mx-auto">
              <h1 className="text-2xl font-bold">Internet Archive Downloader</h1>
              <p className="text-sm opacity-80 mt-1">Download media from archive.org with ease</p>
            </div>
          </header>
          <main className="container mx-auto p-6 flex-grow">
            {children}
          </main>
          <footer className="border-t border-[var(--border)] p-6 text-center text-[var(--text-muted)] text-sm">
            <div className="container mx-auto">
              &copy; {new Date().getFullYear()} Internet Archive Downloader
            </div>
          </footer>
          <Toaster position="bottom-right" />
        </DownloadProvider>
      </body>
    </html>
  );
}
