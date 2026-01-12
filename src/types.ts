export interface CssUsageResult {
    url: string;
    totalBytes: number;
    usedBytes: number;
    unusedBytes: number;
    unusedPercentage: string;
    scannedViewports: string[];
    outputFile: string;
    unusedOutputFile: string;
    // New fields for multi-page stats
    totalPagesScanned: number;
    pagesList: string[];
}

export interface ScanOptions {
    depth: number;
    maxPages: number;
    onProgress?: (currentUrl: string, count: number) => void;
}

export type AppState = 'IDLE' | 'SCANNING' | 'SUCCESS' | 'ERROR';