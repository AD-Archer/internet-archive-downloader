"use client";

import { Toaster } from "react-hot-toast";

/**
 * Client component that renders the toast notifications
 */
export default function ToastContainer() {
  return (
    <Toaster 
      position="top-right" 
      toastOptions={{
        duration: 4000,
        style: {
          background: '#333',
          color: '#fff',
        },
      }}
    />
  );
} 