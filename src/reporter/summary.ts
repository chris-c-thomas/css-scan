import {type ScanReport} from '../types.js';

export interface ScanSummary {
	url: string;
	totalPagesScanned: number;
	totalBytes: number;
	usedBytes: number;
	unusedBytes: number;
	unusedPercentage: string;
	totalRules: number;
	usedRules: number;
	unusedRules: number;
	outputFiles: string[];
}

export function buildSummary(report: ScanReport, outputFiles: string[]): ScanSummary {
	return {
		url: report.url,
		totalPagesScanned: report.pages.length,
		totalBytes: report.summary.totalBytes,
		usedBytes: report.summary.usedBytes,
		unusedBytes: report.summary.unusedBytes,
		unusedPercentage: report.summary.unusedPercentage,
		totalRules: report.summary.totalRules,
		usedRules: report.summary.usedRules,
		unusedRules: report.summary.unusedRules,
		outputFiles,
	};
}
