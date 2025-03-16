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
  }) => void;
}

/**
 * Form component for adding new downloads
 */
export default function DownloadForm({ onDownloadAdded }: DownloadFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form setup with validation
  const {
    register,
    handleSubmit,
    reset,
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
      }
    },
  });

  // Handle form submission
  const onSubmit = async (data: DownloadFormData) => {
    try {
      setIsSubmitting(true);
      
      // Submit to API
      const response = await fetch("/api/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
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
      
      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
        <div>
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
        
        <div>
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
        
        <div>
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
          <button
            type="submit"
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
                Adding...
              </span>
            ) : (
              "Add to Queue"
            )}
          </button>
        </div>
      </form>
    </div>
  );
} 