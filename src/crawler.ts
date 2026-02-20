import {type Page} from 'playwright';

export interface CrawlOptions {
	depth: number;
	maxPages: number;
	onProgress?: (currentUrl: string, count: number) => void;
	onPage: (url: string) => Promise<void>;
}

export interface CrawlResult {
	/** Ordered list of page URLs discovered and visited */
	pages: string[];
}

const MAX_QUEUE_SIZE = 1000;

/**
 * Crawl a site starting from initialUrl, discovering internal links
 * up to the specified depth and maxPages limits.
 *
 * The caller provides a Playwright Page instance. The crawler navigates
 * it but does NOT manage coverage — that's the collector's job.
 *
 * The onPage callback fires for each discovered page, allowing the
 * orchestrator to perform coverage collection inside it.
 */
export async function crawlSite(
	page: Page,
	initialUrl: string,
	options: CrawlOptions,
): Promise<CrawlResult> {
	const queue: Array<{url: string; depth: number}> = [{url: initialUrl, depth: 0}];
	const visited = new Set<string>();
	const scannedPages: string[] = [];

	const getOrigin = (u: string) => new URL(u).origin;
	const initialOrigin = getOrigin(initialUrl);

	while (queue.length > 0 && visited.size < options.maxPages) {
		const {url, depth} = queue.shift()!;

		if (visited.has(url)) {
			continue;
		}

		// Skip if different origin
		try {
			if (getOrigin(url) !== initialOrigin) {
				continue;
			}
		} catch {
			// Malformed URL — skip
			continue;
		}

		visited.add(url);
		scannedPages.push(url);

		// Notify UI
		options.onProgress?.(url, visited.size);

		// Navigate to the page
		const response = await page.goto(url, {waitUntil: 'networkidle', timeout: 30_000}).catch(() => null);

		// Skip non-HTML responses
		if (response) {
			const contentType = response.headers()['content-type'] ?? '';
			if (contentType && !contentType.includes('text/html')) {
				continue;
			}
		}

		// Let the orchestrator collect coverage for this page
		await options.onPage(url);

		// Extract links for crawling (if depth allows)
		if (depth < options.depth) {
			const hrefs = await page.evaluate(() =>
				Array.from(document.querySelectorAll('a'))
					.map(a => a.href)
					.filter(href => href.startsWith('http')),
			);

			for (const href of hrefs) {
				try {
					// Normalize URL: strip fragments, keep query strings
					const parsed = new URL(href);
					parsed.hash = '';
					// Normalize trailing slashes
					const cleanHref = parsed.href;

					if (!visited.has(cleanHref) && queue.length < MAX_QUEUE_SIZE) {
						queue.push({url: cleanHref, depth: depth + 1});
					}
				} catch {
					// Malformed URL in href — skip
				}
			}
		}
	}

	return {pages: scannedPages};
}
