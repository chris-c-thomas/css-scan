// Define the shape of our data so the UI and Service can speak the same language
export interface CssUsageResult {
    url: string;
    totalBytes: number;
    usedBytes: number;
    unusedBytes: number;
    unusedPercentage: string;
}

export type AppState = 'IDLE' | 'SCANNING' | 'SUCCESS' | 'ERROR';