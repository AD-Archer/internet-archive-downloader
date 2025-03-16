"use client";

import DownloadForm from "@/components/DownloadForm";
import DownloadQueue from "@/components/DownloadQueue";

/**
 * Main page component for the Internet Archive Downloader
 */
export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Internet Archive Downloader
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Download content from the Internet Archive
        </p>
      </header>
      
      <div className="grid grid-cols-1 gap-8">
        <DownloadForm />
        <DownloadQueue />
      </div>
    </main>
  );
}
