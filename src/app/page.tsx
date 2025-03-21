"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";  
import DownloadHistory from "../components/DownloadHistory";
import DownloadQueue from "../components/DownloadQueue";
import { useDownload } from "@/context/DownloadContext";
import QueueRepairTool from "@/components/QueueRepairTool";

// Form validation schema
const formSchema = z.object({
  url: z.string().url("Please enter a valid Internet Archive URL"),
  downloadPath: z.string()
    .min(1, "Download path is required")
    .refine(path => path !== "/", {
      message: "Root directory (/) is not allowed as a download path"
    }),
  fileTypes: z.array(z.string()).min(1, "Select at least one file type"),
  isPlaylist: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

/**
 * Home page component with download form and queue display
 */
export default function Home() {
  // Default download path from environment variable
  const defaultDownloadPath = process.env.DEFAULT_DOWNLOAD_PATH || "/mnt/jellyfin/downloads";
  
  const [isLoading, setIsLoading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Get addToQueue function from context
  const { addToQueue } = useDownload();
  
  // Available file types
  const fileTypeOptions = [
    { value: "mp4", label: "MP4" },
    { value: "mkv", label: "MKV" },
    { value: "avi", label: "AVI" },
    { value: "mov", label: "MOV" },
    { value: "webm", label: "WebM" },
    { value: "mp3", label: "MP3" },
    { value: "flac", label: "FLAC" },
    { value: "pdf", label: "PDF" },
  ];
  
  // Initialize form with react-hook-form
  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isValid } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      downloadPath: defaultDownloadPath,
      fileTypes: ["mp4", "mkv"],
      isPlaylist: false,
    },
  });
  
  // Watch for changes to form values
  const selectedFileTypes = watch("fileTypes");
  
  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    // Prevent multiple submissions
    if (isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      setIsLoading(true);
      setDownloadStatus("Starting download...");
      
      // Convert fileTypes array to formats object for the context
      const formats: Record<string, boolean> = {};
      data.fileTypes.forEach(type => {
        formats[type] = true;
      });
      
      // Add to download queue using context function
      await addToQueue(data.url, formats, data.isPlaylist);
      
      setDownloadStatus(`Added to download queue: ${data.url}`);
      
      // Reset form URL field for next submission
      reset({
        ...data,
        url: ''
      });
    } catch (error) {
      console.error("Download error:", error);
      
      let errorMessage = "Error starting download. Please try again.";
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setDownloadStatus(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setIsSubmitting(false);
    }
  };
  
  // Toggle file type selection
  const toggleFileType = (type: string) => {
    const currentTypes = selectedFileTypes || [];
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type];
    
    setValue("fileTypes", newTypes, { shouldValidate: true });
  };
  
  return (
    <div className="space-y-10">
      {/* Download Form Card */}
      <div className="card max-w-2xl mx-auto p-8">
        <h2 className="text-2xl font-bold mb-6 text-center">Download from Internet Archive</h2>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* URL Input */}
          <div>
            <label htmlFor="url" className="block text-sm font-medium mb-2">
              Internet Archive URL
            </label>
            <input
              id="url"
              type="text"
              placeholder="https://archive.org/details/example"
              className="w-full"
              disabled={isSubmitting}
              {...register("url")}
            />
            {errors.url && (
              <p className="mt-1 text-sm text-[var(--danger)]">{errors.url.message}</p>
            )}
          </div>
          
          {/* Download Path */}
          <div>
            <label htmlFor="downloadPath" className="block text-sm font-medium mb-2">
              Download Path
            </label>
            <input
              id="downloadPath"
              type="text"
              className="w-full"
              disabled={isSubmitting}
              {...register("downloadPath")}
            />
            {errors.downloadPath && (
              <p className="mt-1 text-sm text-[var(--danger)]">{errors.downloadPath.message}</p>
            )}
          </div>
          
          {/* File Types */}
          <div>
            <label className="block text-sm font-medium mb-3">
              File Types to Download
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {fileTypeOptions.map((type) => (
                <div 
                  key={type.value} 
                  className={`
                    flex items-center justify-center p-3 rounded-lg cursor-pointer border transition-all
                    ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
                    ${selectedFileTypes?.includes(type.value) 
                      ? 'bg-[var(--primary)] text-white border-[var(--primary)]' 
                      : 'bg-[var(--input-bg)] border-[var(--input-border)] hover:border-[var(--primary)]'}
                  `}
                  onClick={() => !isSubmitting && toggleFileType(type.value)}
                >
                  <span className="font-medium">{type.label}</span>
                </div>
              ))}
            </div>
            {errors.fileTypes && (
              <p className="mt-1 text-sm text-[var(--danger)]">{errors.fileTypes.message}</p>
            )}
          </div>
          
          {/* Playlist Option */}
          <div className="flex items-center p-4 bg-[var(--input-bg)] rounded-lg">
            <input
              id="isPlaylist"
              type="checkbox"
              className="h-5 w-5 accent-[var(--primary)]"
              disabled={isSubmitting}
              {...register("isPlaylist")}
            />
            <label htmlFor="isPlaylist" className="ml-3 text-sm font-medium">
              This is a playlist (download all items)
            </label>
          </div>
          
          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || isSubmitting || !isValid}
            className="btn btn-primary w-full mt-6"
          >
            {isLoading ? "Adding to Queue..." : "Add to Download Queue"}
          </button>
        </form>
        
        {/* Download Status */}
        {downloadStatus && (
          <div className={`mt-6 p-4 rounded-lg ${downloadStatus.includes("Error") ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>
            <p>{downloadStatus}</p>
          </div>
        )}
      </div>
      
      {/* Download Queue */}
      <div className="card max-w-5xl mx-auto p-8">
        <DownloadQueue />
      </div>
      
      {/* Download History */}
      <div className="card max-w-5xl mx-auto p-8">
        <DownloadHistory />
      </div>
      
      {/* Queue Repair Tool */}
      <div className="card max-w-5xl mx-auto p-8">
        <QueueRepairTool />
      </div>
    </div>
  );
}
