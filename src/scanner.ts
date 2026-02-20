import {chromium} from 'playwright';
import {crawlSite} from './crawler.js';
import {collectPageCoverage, mergeCoverage, finalizeAggregatedCoverage, VIEWPORTS} from './collector.js';
import {analyzeCoverage} from './analyzer.js';
import {type ScanOptions, type ScanReport} from './types.js';

export async function scanCssCoverage(
	initialUrl: string,
	options: ScanOptions,
): Promise<ScanReport> {
	const browser = await chromium.launch({headless: true});

	try {
		const page = await browser.newPage();
		const globalCoverage = new Map<string, {text: string; ranges: Array<{start: number; end: number}>}>();
		const pages: string[] = [];

		// Crawl + Collect (interleaved via onPage callback)
		await crawlSite(page, initialUrl, {
			depth: options.depth,
			maxPages: options.maxPages,
			onProgress: options.onProgress,
			async onPage(url: string) {
				pages.push(url);
				const entries = await collectPageCoverage(page);
				mergeCoverage(globalCoverage, entries);
			},
		});

		// Finalize raw coverage
		const aggregated = finalizeAggregatedCoverage(globalCoverage, pages, VIEWPORTS);

		// Analyze with postcss AST
		const report = analyzeCoverage(aggregated, initialUrl);

		return report;
	} finally {
		await browser.close();
	}
}
