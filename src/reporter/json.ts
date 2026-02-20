import fs from 'node:fs/promises';
import path from 'node:path';
import {type Reporter} from './index.js';

export const jsonReporter: Reporter = {
	name: 'json',
	async generate(report, options) {
		const outputPath = path.resolve(options.outputDir, 'css-scan-report.json');
		await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');
		return ['css-scan-report.json'];
	},
};
