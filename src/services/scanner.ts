import { chromium } from 'playwright';
import { CssUsageResult } from '../types.js';

export async function scanCssCoverage(url: string): Promise<CssUsageResult> {
    // Launch the browser instance
    const browser = await chromium.launch({
        headless: true, // Run in background
    });

    try {
        const page = await browser.newPage();

        // 1. Start CSS Coverage
        await page.coverage.startCSSCoverage();

        // 2. Navigate to the URL
        // waitUntil: 'networkidle' ensures we wait until network activity settles
        // so we capture dynamically loaded CSS.
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        // 3. Stop Coverage and get results
        const coverage = await page.coverage.stopCSSCoverage();

        // 4. Calculate Usage
        let totalBytes = 0;
        let usedBytes = 0;

        for (const entry of coverage) {
            // FIX: Check if text exists before accessing length. 
            // Playwright types mark text as optional (string | undefined).
            const entryLength = entry.text ? entry.text.length : 0;

            totalBytes += entryLength;

            for (const range of entry.ranges) {
                usedBytes += range.end - range.start;
            }
        }

        const unusedBytes = totalBytes - usedBytes;

        // Safety check to avoid division by zero
        const unusedPercentage = totalBytes > 0
            ? ((unusedBytes / totalBytes) * 100).toFixed(2)
            : '0';

        return {
            url,
            totalBytes,
            usedBytes,
            unusedBytes,
            unusedPercentage
        };

    } catch (error) {
        // Propagate error to be handled by the UI
        throw error;
    } finally {
        // Always close the browser to prevent zombie processes
        await browser.close();
    }
}