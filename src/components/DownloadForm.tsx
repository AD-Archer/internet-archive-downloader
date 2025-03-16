"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";

// Form schema for download request
const downloadSchema = z.object({
  url: z.string().url("Please enter a valid Internet Archive URL"),
  destination: z.string().default("/mnt/jellyfin/downloads"),
  formats: z.object({
    mp4: z.boolean().default(true),
    mov: z.boolean().default(true),
    mkv: z.boolean().default(true),
    avi: z.boolean().default(false),
    webm: z.boolean().default(false),
    mp3: z.boolean().default(false),
    flac: z.boolean().default(false),
  }).default({
    mp4: true,
    mov: true,
    mkv: true,
    avi: false,
    webm: false,
    mp3: false,
    flac: false,
  }),
  priority: z.enum(["high", "normal", "low"]).default("normal"),
  searchQuery: z.string().optional(),
  isBatchDownload: z.boolean().default(false),
});

// Type for form data
type DownloadFormData = z.infer<typeof downloadSchema>;

// Props for the component
interface DownloadFormProps {
  onDownloadAdded: (download: {
    id: string;
    url: string;
    destination: string;
    formats: Record<string, boolean>;
    status: string;
    priority?: string;
  }) => void;
}

/**
 * Form component for adding new downloads
 */
export default function DownloadForm({ onDownloadAdded }: DownloadFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showBatchOptions, setShowBatchOptions] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  
  // Form setup with validation
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DownloadFormData>({
    resolver: zodResolver(downloadSchema),
    defaultValues: {
      destination: "/mnt/jellyfin/downloads",
      formats: {
        mp4: true,
        mov: true,
        mkv: true,
        avi: false,
        webm: false,
        mp3: false,
        flac: false,
      },
      priority: "normal",
      isBatchDownload: false,
    },
  });

  // Watch for form value changes
  const isBatchDownload = watch("isBatchDownload");
  const searchQuery = watch("searchQuery");

  // Handle search
  const handleSearch = async () => {
    if (!searchQuery || searchQuery.trim() === "") {
      toast.error("Please enter a search query");
      return;
    }

    try {
      setIsSearching(true);
      const response = await fetch(`/api/search?query=${encodeURIComponent(searchQuery)}`);
      
      if (!response.ok) {
        throw new Error("Failed to search Internet Archive");
      }
      
      const data = await response.json();
      setSearchResults(data.results || []);
      
      if (data.results.length === 0) {
        toast.error("No results found");
      }
    } catch (error) {
      console.error("Error searching:", error);
      toast.error("Failed to search Internet Archive");
    } finally {
      setIsSearching(false);
    }
  };

  // Toggle item selection for batch download
  const toggleItemSelection = (identifier: string) => {
    setSelectedItems(prev => 
      prev.includes(identifier)
        ? prev.filter(id => id !== identifier)
        : [...prev, identifier]
    );
  };

  // Handle batch download
  const handleBatchDownload = async () => {
    if (selectedItems.length === 0) {
      toast.error("Please select at least one item");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const formValues = watch();
      
      const response = await fetch("/api/download/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: selectedItems.map(id => ({ identifier: id })),
          destination: formValues.destination,
          formats: formValues.formats,
          priority: formValues.priority,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to add batch downloads to queue");
      }
      
      const result = await response.json();
      
      // Call the callback for each job
      if (result.jobs && Array.isArray(result.jobs)) {
        result.jobs.forEach((job: any) => {
          onDownloadAdded(job);
        });
      }
      
      // Reset form and selections
      setSelectedItems([]);
      setSearchResults([]);
      setValue("searchQuery", "");
      toast.success(`Added ${result.jobs.length} downloads to queue`);
    } catch (error) {
      console.error("Error adding batch downloads:", error);
      toast.error("Failed to add batch downloads");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle form submission for single download
  const onSubmit = async (data: DownloadFormData) => {
    try {
      setIsSubmitting(true);
      
      // Submit to API
      const response = await fetch("/api/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: data.url,
          destination: data.destination,
          formats: data.formats,
          priority: data.priority,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to add download to queue");
      }
      
      const result = await response.json();
      
      // Call the callback with the new download
      onDownloadAdded(result.job);
      
      // Reset form
      reset();
      toast.success("Download added to queue");
    } catch (error) {
      console.error("Error adding download:", error);
      toast.error("Failed to add download");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md mb-8 overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add New Download</h2>
      </div>
      
      <div className="p-6">
        {/* Batch download toggle */}
        <div className="mb-6">
          <div className="flex items-center">
            <input
              id="batch-download"
              type="checkbox"
              {...register("isBatchDownload")}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              onChange={(e) => setShowBatchOptions(e.target.checked)}
            />
            <label htmlFor="batch-download" className="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Batch Download
            </label>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Search and download multiple items at once
          </p>
        </div>
        
        {showBatchOptions ? (
          // Batch download form
          <div>
            <div className="mb-6">
              <label htmlFor="searchQuery" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search Internet Archive
              </label>
              <div className="flex">
                <input
                  id="searchQuery"
                  type="text"
                  {...register("searchQuery")}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md shadow-sm 
                           focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter search terms..."
                  disabled={isSearching || isSubmitting}
                />
                <button
                  type="button"
                  onClick={handleSearch}
                  className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                  disabled={isSearching || isSubmitting}
                >
                  {isSearching ? "Searching..." : "Search"}
                </button>
              </div>
            </div>
            
            {searchResults.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                  Search Results ({searchResults.length})
                </h3>
                <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                  <div className="max-h-60 overflow-y-auto">
                    {searchResults.map((item) => (
                      <div 
                        key={item.identifier}
                        className={`flex items-center p-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0 
                                  ${selectedItems.includes(item.identifier) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      >
                        <input
                          type="checkbox"
                          id={`item-${item.identifier}`}
                          checked={selectedItems.includes(item.identifier)}
                          onChange={() => toggleItemSelection(item.identifier)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label 
                          htmlFor={`item-${item.identifier}`}
                          className="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer flex-1"
                        >
                          <div className="font-medium">{item.title || item.identifier}</div>
                          {item.description && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                              {item.description}
                            </div>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="mt-3 flex justify-between items-center">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedItems.length} items selected
                  </div>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectedItems([])}
                      className="px-3 py-1 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 
                               focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedItems(searchResults.map(item => item.identifier))}
                      className="px-3 py-1 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 
                               focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                    >
                      Select All
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Single download form
          <div className="mb-6">
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Internet Archive URL
            </label>
            <input
              id="url"
              type="text"
              {...register("url")}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm 
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="https://archive.org/details/example"
              disabled={isSubmitting}
            />
            {errors.url && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.url.message}</p>
            )}
          </div>
        )}
        
        {/* Common form fields */}
        <div className="mb-6">
          <label htmlFor="destination" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Destination Path
          </label>
          <input
            id="destination"
            type="text"
            {...register("destination")}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm 
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            disabled={isSubmitting}
          />
          {errors.destination && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.destination.message}</p>
          )}
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Download Priority
          </label>
          <div className="flex space-x-4">
            <div className="flex items-center">
              <input
                id="priority-high"
                type="radio"
                value="high"
                {...register("priority")}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <label htmlFor="priority-high" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                High
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="priority-normal"
                type="radio"
                value="normal"
                {...register("priority")}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <label htmlFor="priority-normal" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Normal
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="priority-low"
                type="radio"
                value="low"
                {...register("priority")}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <label htmlFor="priority-low" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Low
              </label>
            </div>
          </div>
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            File Formats to Download
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Video formats */}
            <div className="flex items-center">
              <input
                id="format-mp4"
                type="checkbox"
                {...register("formats.mp4")}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="format-mp4" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                MP4
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="format-mov"
                type="checkbox"
                {...register("formats.mov")}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="format-mov" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                MOV
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="format-mkv"
                type="checkbox"
                {...register("formats.mkv")}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="format-mkv" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                MKV
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="format-avi"
                type="checkbox"
                {...register("formats.avi")}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="format-avi" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                AVI
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="format-webm"
                type="checkbox"
                {...register("formats.webm")}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="format-webm" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                WEBM
              </label>
            </div>
            
            {/* Audio formats */}
            <div className="flex items-center">
              <input
                id="format-mp3"
                type="checkbox"
                {...register("formats.mp3")}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="format-mp3" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                MP3
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="format-flac"
                type="checkbox"
                {...register("formats.flac")}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="format-flac" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                FLAC
              </label>
            </div>
          </div>
        </div>
        
        <div>
          {showBatchOptions ? (
            <button
              type="button"
              onClick={handleBatchDownload}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium 
                       text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 
                       focus:ring-blue-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || selectedItems.length === 0}
            >
              {isSubmitting ? "Adding to Queue..." : `Add ${selectedItems.length} Items to Queue`}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit(onSubmit)}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium 
                       text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 
                       focus:ring-blue-500 transition-colors duration-200"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Adding to Queue
                </span>
              ) : (
                "Add to Queue"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 