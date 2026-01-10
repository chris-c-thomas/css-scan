export interface CssUsageResult {
    url: string;
    totalBytes: number;
    usedBytes: number;
    unusedBytes: number;
    unusedPercentage: string;
    scannedViewports: string[];
    outputFile: string; // New field for the filename
}

export type AppState = 'IDLE' | 'SCANNING' | 'SUCCESS' | 'ERROR';