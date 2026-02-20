import * as crypto from 'node:crypto';
import {type Page} from 'playwright';
import {type RawCoverageEntry, type AggregatedCoverage} from './types.js';

export const VIEWPORTS = [
	{width: 1920, height: 1080, label: 'Desktop (1920x1080)'},
	{width: 768, height: 1024, label: 'Tablet (768x1024)'},
	{width: 375, height: 667, label: 'Mobile (375x667)'},
] as const;

/**
 * Merges overlapping or adjacent ranges.
 * e.g. [0, 10] and [5, 15] becomes [0, 15]
 */
export function mergeRanges(ranges: Array<{start: number; end: number}>): Array<{start: number; end: number}> {
	if (ranges.length === 0) {
		return [];
	}

	const sorted = [...ranges].sort((a, b) => a.start - b.start);
	const merged = [sorted[0]];

	for (const current of sorted) {
		const previous = merged[merged.length - 1];
		if (current.start <= previous.end) {
			previous.end = Math.max(previous.end, current.end);
		} else {
			merged.push(current);
		}
	}

	return merged;
}

/**
 * Collect CSS coverage for a single page across all viewports.
 * Assumes the page has already been navigated to the target URL.
 */
export async function collectPageCoverage(
	page: Page,
): Promise<RawCoverageEntry[]> {
	await page.coverage.startCSSCoverage({resetOnNavigation: false});

	for (const viewport of VIEWPORTS) {
		try {
			await page.setViewportSize(viewport);
		} catch {
			// Viewport resize failed — skip this viewport
			continue;
		}

		await page.waitForTimeout(200);
		await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
		await page.waitForTimeout(200);
		await page.evaluate(() => window.scrollTo(0, 0));
	}

	const coverage = await page.coverage.stopCSSCoverage();

	return coverage
		.filter((entry): entry is typeof entry & {text: string} => Boolean(entry.text))
		.map(entry => ({
			url: entry.url,
			text: entry.text,
			ranges: entry.ranges.map(r => ({
				start: r.start,
				// Clamp range end to text length (known Chromium edge case)
				end: Math.min(r.end, entry.text.length),
			})),
		}));
}

/**
 * Generate a content-based hash key for inline styles (no URL).
 */
function hashContent(text: string): string {
	return crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);
}

/**
 * Merge new coverage entries into an existing global coverage map.
 * Handles overlapping and adjacent range merging across pages.
 */
export function mergeCoverage(
	global: Map<string, {text: string; ranges: Array<{start: number; end: number}>}>,
	entries: RawCoverageEntry[],
): void {
	for (const entry of entries) {
		// Skip empty stylesheets
		if (!entry.text) {
			continue;
		}

		const key = entry.url || `inline-${hashContent(entry.text)}`;

		if (!global.has(key)) {
			global.set(key, {text: entry.text, ranges: [...entry.ranges]});
		} else {
			const existing = global.get(key)!;
			existing.ranges = mergeRanges([...existing.ranges, ...entry.ranges]);
		}
	}
}

/**
 * Convert the global coverage map to the AggregatedCoverage format
 * for consumption by the analyzer.
 */
export function finalizeAggregatedCoverage(
	global: Map<string, {text: string; ranges: Array<{start: number; end: number}>}>,
	pages: string[],
	viewports: typeof VIEWPORTS,
): AggregatedCoverage {
	return {
		stylesheets: global,
		pages,
		viewports: viewports.map(v => v.label),
	};
}
