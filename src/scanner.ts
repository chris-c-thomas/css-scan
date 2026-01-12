import { chromium, Page } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as prettier from 'prettier';
import { CssUsageResult, ScanOptions } from './types.js';

const VIEWPORTS = [
    { width: 1920, height: 1080, label: 'Desktop (1920x1080)' },
    { width: 768, height: 1024, label: 'Tablet (768x1024)' },
    { width: 375, height: 667, label: 'Mobile (375x667)' },
];

/**
 * Fallback formatter for invalid CSS syntax.
 */
function formatFallback(css: string): string {
    return css
        .replace(/\s*([{}])\s*/g, ' $1\n')
        .replace(/;\s*/g, ';\n  ')
        .replace(/\s*{\s*/g, ' {\n  ')
        .replace(/\n\s*}\s*/g, '\n}\n')
        .replace(/,\s*/g, ', ')
        .replace(/\n\s*\n/g, '\n');
}

async function writeCssFile(filename: string, content: string, header: string = ''): Promise<string> {
    let openBraces = 0;
    for (const char of content) {
        if (char === '{') openBraces++;
        if (char === '}') openBraces--;
    }

    let balancedContent = content;
    while (openBraces > 0) {
        balancedContent += '}\n';
        openBraces--;
    }
    while (openBraces < 0) {
        balancedContent = '{\n' + balancedContent;
        openBraces++;
    }

    if (header) balancedContent = header + balancedContent;
    const outputPath = path.resolve(process.cwd(), filename);

    try {
        const formattedCss = await prettier.format(balancedContent, { parser: 'css' });
        await fs.writeFile(outputPath, formattedCss, 'utf-8');
    } catch {
        const readableCss = formatFallback(balancedContent);
        await fs.writeFile(outputPath, readableCss, 'utf-8');
    }

    return filename;
}

/**
 * Merges overlapping or adjacent ranges.
 * e.g. [0, 10] and [5, 15] becomes [0, 15]
 */
function mergeRanges(ranges: { start: number; end: number }[]) {
    if (ranges.length === 0) return [];

    // Sort by start position
    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    const merged = [sorted[0]];

    for (const current of sorted) {
        const previous = merged[merged.length - 1];
        if (current.start <= previous.end) {
            // Overlapping or adjacent
            previous.end = Math.max(previous.end, current.end);
        } else {
            merged.push(current);
        }
    }
    return merged;
}

export async function scanCssCoverage(initialUrl: string, options: ScanOptions): Promise<CssUsageResult> {
    const browser = await chromium.launch({ headless: true });

    // Global map to store merged coverage: URL -> { text, ranges[] }
    const globalCoverage = new Map<string, { text: string; ranges: { start: number; end: number }[] }>();

    // Crawler state
    const queue: { url: string; depth: number }[] = [{ url: initialUrl, depth: 0 }];
    const visited = new Set<string>();
    const scannedPages: string[] = [];

    // normalize helper
    const getOrigin = (u: string) => new URL(u).origin;
    const initialOrigin = getOrigin(initialUrl);

    try {
        const page = await browser.newPage();

        while (queue.length > 0 && visited.size < options.maxPages) {
            const { url, depth } = queue.shift()!;

            // Skip if visited or diff origin (optional, but safer for CSS scanning)
            if (visited.has(url)) continue;
            // Simple validation to ensure we stick to the site
            try {
                if (getOrigin(url) !== initialOrigin) continue;
            } catch { continue; }

            visited.add(url);
            scannedPages.push(url);

            // Notify UI
            options.onProgress?.(url, visited.size);

            // --- Start Coverage for this page ---
            await page.coverage.startCSSCoverage({ resetOnNavigation: false });

            // Process Viewports
            for (const viewport of VIEWPORTS) {
                await page.setViewportSize(viewport);
                if (viewport === VIEWPORTS[0]) {
                    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => { });
                }
                await page.waitForTimeout(200);
                await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                await page.waitForTimeout(200);
                await page.evaluate(() => window.scrollTo(0, 0));
            }

            const coverage = await page.coverage.stopCSSCoverage();

            // --- Merge Coverage ---
            for (const entry of coverage) {
                // We use the CSS url (or a hash if you prefer) as the key. 
                // Inline styles often have empty URLs or unique IDs; merging them is harder, 
                // so we might treat them as unique entries or skip if 'url' is empty.
                const key = entry.url || `inline-${visited.size}-${entry.text.length}`;

                if (!globalCoverage.has(key)) {
                    globalCoverage.set(key, { text: entry.text, ranges: entry.ranges });
                } else {
                    const existing = globalCoverage.get(key)!;
                    // Combine ranges
                    existing.ranges = mergeRanges([...existing.ranges, ...entry.ranges]);
                }
            }

            // --- Extract Links for Crawler (if depth allows) ---
            if (depth < options.depth) {
                const hrefs = await page.evaluate(() => {
                    return Array.from(document.querySelectorAll('a'))
                        .map(a => a.href)
                        .filter(href => href.startsWith('http'));
                });

                for (const href of hrefs) {
                    // Normalize URL (strip hash/query if desired)
                    const cleanHref = href.split('#')[0];
                    if (!visited.has(cleanHref)) {
                        queue.push({ url: cleanHref, depth: depth + 1 });
                    }
                }
            }
        }

        // --- Calculate Final Stats ---
        let totalBytes = 0;
        let usedBytes = 0;
        let usedCssBuffer = '';
        let unusedCssBuffer = '';

        for (const [key, data] of globalCoverage) {
            const entryLength = data.text.length;
            totalBytes += entryLength;

            // Ensure ranges are clean and sorted
            const ranges = mergeRanges(data.ranges);

            let cursor = 0;
            for (const range of ranges) {
                usedBytes += range.end - range.start;

                // Unused part
                if (range.start > cursor) {
                    unusedCssBuffer += data.text.slice(cursor, range.start) + '\n';
                }
                // Used part
                usedCssBuffer += data.text.slice(range.start, range.end) + '\n';

                cursor = range.end;
            }
            // Tail unused
            if (cursor < entryLength) {
                unusedCssBuffer += data.text.slice(cursor, entryLength) + '\n';
            }
        }

        const outputFile = await writeCssFile('used.css', usedCssBuffer, `/* used.css - scanned ${visited.size} pages */\n`);
        const unusedOutputFile = await writeCssFile('unused.css', unusedCssBuffer, `/* unused.css - scanned ${visited.size} pages */\n`);

        const unusedBytes = totalBytes - usedBytes;
        const unusedPercentage = totalBytes > 0
            ? ((unusedBytes / totalBytes) * 100).toFixed(2)
            : '0';

        return {
            url: initialUrl,
            totalBytes,
            usedBytes,
            unusedBytes,
            unusedPercentage,
            scannedViewports: VIEWPORTS.map(v => v.label),
            outputFile,
            unusedOutputFile,
            totalPagesScanned: visited.size,
            pagesList: scannedPages
        };

    } catch (error) {
        throw error;
    } finally {
        await browser.close();
    }
}