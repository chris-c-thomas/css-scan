export interface CssUsageResult {
    url: string;
    totalBytes: number;
    usedBytes: number;
    unusedBytes: number;
    unusedPercentage: string;
    scannedViewports: string[];
    outputFile: string;       // For used.css
    unusedOutputFile: string; // For unused.css
}

export type AppState = 'IDLE' | 'SCANNING' | 'SUCCESS' | 'ERROR';