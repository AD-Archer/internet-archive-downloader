"use client";

import React, { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { useDownload } from '@/context/DownloadContext';

/**
 * Component for submitting download requests
 */
export default function DownloadForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    addToQueue,
    isAdding,
    error
  } = useDownload();
  
  // Form state
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isPlaylist, setIsPlaylist] = useState(false);
  
  // Format options
  const [formats, setFormats] = useState({
    mp3: true,
    flac: false,
    mp4: true,
    h264: false,
    pdf: true,
    epub: false,
    text: false,
    images: false,
    all: false
  });
  
  // Handle URL from query params
  useEffect(() => {
    const urlParam = searchParams.get('url');
    if (urlParam) {
      setUrl(urlParam);
    }
  }, [searchParams]);
  
  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      toast.error('Please enter a URL');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Validate URL format
      if (!url.includes('archive.org')) {
        toast.error('URL must be from archive.org');
        setIsSubmitting(false);
        return;
      }
      
      // Check if at least one format is selected
      const hasSelectedFormat = Object.values(formats).some(value => value === true);
      if (!hasSelectedFormat) {
        toast.error('Please select at least one format');
        setIsSubmitting(false);
        return;
      }
      
      // Submit the download request
      await addToQueue(url, formats, isPlaylist);
      
      // Clear form
      setUrl('');
      
      // Navigate to queue page
      router.push('/queue');
    } catch (error) {
      console.error('Error submitting download:', error);
      toast.error('Failed to submit download');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Toggle all formats
  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      // Enable all formats
      setFormats({
        mp3: true,
        flac: true,
        mp4: true,
        h264: true,
        pdf: true,
        epub: true,
        text: true,
        images: true,
        all: true
      });
    } else {
      // Reset to defaults
      setFormats({
        mp3: true,
        flac: false,
        mp4: true,
        h264: false,
        pdf: true,
        epub: false,
        text: false,
        images: false,
        all: false
      });
    }
  };
  
  // Handle format change
  const handleFormatChange = (format: string, checked: boolean) => {
    if (format === 'all') {
      // If "all" is checked/unchecked, update all formats
      handleToggleAll(checked);
      return;
    }
    
    setFormats(prev => {
      const newFormats = { ...prev, [format]: checked };
      
      // Ensure at least one format is selected
      const hasAnyFormat = Object.entries(newFormats)
        .some(([key, value]) => key !== 'all' && value);
      
      if (!hasAnyFormat) {
        // If no formats are selected, keep the current one selected
        return { ...prev };
      }
      
      // Update "all" checkbox based on other selections
      const allSelected = 
        newFormats.mp3 && 
        newFormats.flac && 
        newFormats.mp4 && 
        newFormats.h264 && 
        newFormats.pdf && 
        newFormats.epub && 
        newFormats.text && 
        newFormats.images;
      
      return { ...newFormats, all: allSelected };
    });
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Download from Internet Archive</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* URL Input */}
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Archive.org URL
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <input
              type="text"
              id="url"
              name="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://archive.org/details/example"
              className="block w-full rounded-md border-gray-300 dark:border-gray-600 
                        shadow-sm focus:border-blue-500 focus:ring-blue-500 
                        dark:bg-gray-700 dark:text-white sm:text-sm
                        py-3 px-4"
              disabled={isSubmitting}
            />
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Enter a URL from archive.org (e.g., https://archive.org/details/example)
          </p>
        </div>
        
        {/* Playlist Option */}
        <div className="flex items-center">
          <input
            id="isPlaylist"
            name="isPlaylist"
            type="checkbox"
            checked={isPlaylist}
            onChange={(e) => setIsPlaylist(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
          />
          <label htmlFor="isPlaylist" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
            This is a playlist (download all items)
          </label>
        </div>
        
        {/* Advanced Options Toggle */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 focus:outline-none"
          >
            {showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
          </button>
        </div>
        
        {/* Advanced Options */}
        {showAdvanced && (
          <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Format Options</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* All Formats */}
                <div className="flex items-center">
                  <input
                    id="format-all"
                    name="format-all"
                    type="checkbox"
                    checked={formats.all}
                    onChange={(e) => handleFormatChange('all', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <label htmlFor="format-all" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    All Formats
                  </label>
                </div>
                
                {/* Audio Formats */}
                <div className="flex items-center">
                  <input
                    id="format-mp3"
                    name="format-mp3"
                    type="checkbox"
                    checked={formats.mp3}
                    onChange={(e) => handleFormatChange('mp3', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <label htmlFor="format-mp3" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    MP3
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    id="format-flac"
                    name="format-flac"
                    type="checkbox"
                    checked={formats.flac}
                    onChange={(e) => handleFormatChange('flac', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <label htmlFor="format-flac" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    FLAC
                  </label>
                </div>
                
                {/* Video Formats */}
                <div className="flex items-center">
                  <input
                    id="format-mp4"
                    name="format-mp4"
                    type="checkbox"
                    checked={formats.mp4}
                    onChange={(e) => handleFormatChange('mp4', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <label htmlFor="format-mp4" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    MP4
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    id="format-h264"
                    name="format-h264"
                    type="checkbox"
                    checked={formats.h264}
                    onChange={(e) => handleFormatChange('h264', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <label htmlFor="format-h264" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    H.264
                  </label>
                </div>
                
                {/* Document Formats */}
                <div className="flex items-center">
                  <input
                    id="format-pdf"
                    name="format-pdf"
                    type="checkbox"
                    checked={formats.pdf}
                    onChange={(e) => handleFormatChange('pdf', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <label htmlFor="format-pdf" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    PDF
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    id="format-epub"
                    name="format-epub"
                    type="checkbox"
                    checked={formats.epub}
                    onChange={(e) => handleFormatChange('epub', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <label htmlFor="format-epub" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    EPUB
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    id="format-text"
                    name="format-text"
                    type="checkbox"
                    checked={formats.text}
                    onChange={(e) => handleFormatChange('text', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <label htmlFor="format-text" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Text
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    id="format-images"
                    name="format-images"
                    type="checkbox"
                    checked={formats.images}
                    onChange={(e) => handleFormatChange('images', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <label htmlFor="format-images" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Images
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Submit Button */}
        <div>
          <button
            type="submit"
            disabled={isSubmitting || !url.trim()}
            className="w-full flex justify-center py-3 px-4 border border-transparent 
                     rounded-md shadow-sm text-sm font-medium text-white 
                     bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 
                     focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 
                     disabled:cursor-not-allowed disabled:bg-blue-400"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              'Add to Download Queue'
            )}
          </button>
        </div>
      </form>
    </div>
  );
} 