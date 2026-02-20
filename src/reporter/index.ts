import {type ScanReport} from '../types.js';
import {cssReporter} from './css.js';
import {jsonReporter} from './json.js';

export interface ReporterOptions {
	outputDir: string;
}

export interface Reporter {
	name: string;
	generate(report: ScanReport, options: ReporterOptions): Promise<string[]>;
}

export type ReporterFormat = 'css' | 'json';

export function createReporter(format: ReporterFormat): Reporter {
	switch (format) {
		case 'css': {
			return cssReporter;
		}

		case 'json': {
			return jsonReporter;
		}

		default: {
			throw new Error(`Unknown reporter format: ${format as string}`);
		}
	}
}
