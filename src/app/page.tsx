"use client";

import { useState } from "react";
import DownloadForm from "@/components/DownloadForm";
import DownloadQueue from "@/components/DownloadQueue";

// Download queue item type
interface QueueItem {
  id: string;
  url: string;
  destination: string;
  status: "queued" | "downloading" | "completed" | "failed";
  progress: number;
  estimatedTime?: string;
}

/**
 * Main page component
 */
export default function Home() {
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);

  // Handle adding a new download to the queue
  const handleDownloadAdded = (download: any) => {
    const newItem: QueueItem = {
      id: download.id,
      url: download.url,
      destination: download.destination,
      status: download.status,
      progress: 0,
    };
    
    setQueueItems((prev) => [...prev, newItem]);
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Internet Archive Downloader
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Download content from Internet Archive to your server
          </p>
        </header>
        
        {/* Download form */}
        <DownloadForm onDownloadAdded={handleDownloadAdded} />
        
        {/* Download queue */}
        <DownloadQueue initialItems={queueItems} />
      </div>
    </main>
  );
}
