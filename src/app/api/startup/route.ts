import { NextRequest, NextResponse } from "next/server";
import { checkAndRepairQueueFile } from "@/utils/queueRepair";

// This endpoint is called on application startup to perform maintenance tasks
export async function GET() {
  try {
    // Check and repair queue file if needed
    const wasRepaired = await checkAndRepairQueueFile();
    
    return NextResponse.json({
      success: true,
      queueFileRepaired: wasRepaired,
      message: wasRepaired ? "Queue file was repaired" : "Queue file is valid"
    });
  } catch (error) {
    console.error("Error during startup tasks:", error);
    return NextResponse.json({
      success: false,
      message: "Error during startup tasks",
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 