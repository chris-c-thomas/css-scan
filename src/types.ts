import {z} from 'zod';

// ─── Zod Schemas (source of truth) ───

export const AnalyzedRuleSchema = z.object({
	/** The full selector text, e.g. ".header > .nav a" */
	selector: z.string(),
	/**
	 * Wrapping at-rule context chain if any.
	 * e.g. "@media (max-width: 768px)" or "@supports (display: grid)"
	 * null for top-level rules.
	 */
	atRuleContext: z.string().nullable(),
	/** Source stylesheet URL or identifier */
	stylesheet: z.string(),
	/** Original byte size of this complete rule (selector + declarations + braces) */
	bytes: z.number().int().nonnegative(),
	/** Whether any scanned page used this rule */
	used: z.boolean(),
	/** URLs of pages where this rule was triggered */
	usedOnPages: z.array(z.string()),
});

export const StylesheetAnalysisSchema = z.object({
	/** Stylesheet URL (or synthetic key for inline styles) */
	url: z.string(),
	totalBytes: z.number().int().nonnegative(),
	usedBytes: z.number().int().nonnegative(),
	unusedBytes: z.number().int().nonnegative(),
	/** Clean AST-generated CSS string for used rules */
	usedCss: z.string(),
	/** Clean AST-generated CSS string for unused rules */
	unusedCss: z.string(),
	rules: z.array(AnalyzedRuleSchema),
});

export const ScanReportSchema = z.object({
	/** The initial URL that was scanned */
	url: z.string().url(),
	/** ISO 8601 timestamp of when the scan completed */
	timestamp: z.string().datetime(),
	/** List of all page URLs that were scanned */
	pages: z.array(z.string()),
	/** Viewport labels used during scanning */
	viewports: z.array(z.string()),
	/** Per-stylesheet analysis results */
	stylesheets: z.array(StylesheetAnalysisSchema),
	summary: z.object({
		totalBytes: z.number().int().nonnegative(),
		usedBytes: z.number().int().nonnegative(),
		unusedBytes: z.number().int().nonnegative(),
		unusedPercentage: z.string(),
		totalRules: z.number().int().nonnegative(),
		usedRules: z.number().int().nonnegative(),
		unusedRules: z.number().int().nonnegative(),
	}),
});

// ─── Derived TypeScript types ───

export type AnalyzedRule = z.infer<typeof AnalyzedRuleSchema>;
export type StylesheetAnalysis = z.infer<typeof StylesheetAnalysisSchema>;
export type ScanReport = z.infer<typeof ScanReportSchema>;

// ─── Operational Types (not part of the report schema) ───

export interface ScanOptions {
	depth: number;
	maxPages: number;
	onProgress?: (currentUrl: string, count: number) => void;
}

/** Raw coverage data from Playwright, per stylesheet */
export interface RawCoverageEntry {
	url: string;
	text: string;
	ranges: Array<{start: number; end: number}>;
}

/** Aggregated coverage data across all pages and viewports */
export interface AggregatedCoverage {
	/** Map of stylesheet URL → { text, mergedRanges } */
	stylesheets: Map<string, {
		text: string;
		ranges: Array<{start: number; end: number}>;
	}>;
	/** All pages that were scanned */
	pages: string[];
	/** Viewport labels used */
	viewports: string[];
}

export type AppState = 'IDLE' | 'SCANNING' | 'SUCCESS' | 'ERROR';
