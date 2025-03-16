"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

/**
 * Component that runs startup checks when the application loads
 */
export default function StartupCheck() {
  const [hasRun, setHasRun] = useState(false);
  const [isHealthy, setIsHealthy] = useState(false);

  useEffect(() => {
    // Only run once
    if (hasRun) return;
    
    const runStartupChecks = async () => {
      try {
        // First check if the API server is healthy
        try {
          const healthResponse = await axios.get("/api/health");
          if (healthResponse.data.status === "ok") {
            setIsHealthy(true);
            console.log("API server is healthy");
          } else {
            console.error("API server health check failed:", healthResponse.data);
            return; // Don't proceed with other checks if health check fails
          }
        } catch (healthError) {
          console.error("Error checking API health:", healthError);
          // Don't show toast for health check errors
          return; // Don't proceed with other checks if health check fails
        }
        
        // Only proceed with startup checks if the server is healthy
        if (isHealthy) {
          try {
            const response = await axios.get("/api/startup");
            
            if (response.data.queueFileRepaired) {
              toast.success("Queue file was automatically repaired");
            }
          } catch (startupError) {
            console.error("Error running startup checks:", startupError);
            // Don't show toast for startup errors
          }
        }
        
        setHasRun(true);
      } catch (error) {
        console.error("Error in startup checks:", error);
        // Don't show error toast to users, just log it
      }
    };
    
    // Run startup checks
    runStartupChecks();
  }, [hasRun, isHealthy]);

  // This component doesn't render anything
  return null;
} 