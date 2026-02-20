import fs from 'node:fs/promises';
import path from 'node:path';
import * as prettier from 'prettier';
import {type Reporter} from './index.js';

/**
 * Fallback formatter for CSS that Prettier can't handle.
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

async function formatAndWrite(filePath: string, content: string): Promise<void> {
	try {
		const formatted = await prettier.format(content, {parser: 'css'});
		await fs.writeFile(filePath, formatted, 'utf-8');
	} catch {
		// Prettier failed — fall back to basic formatting.
		// The content is already valid CSS from postcss, just not perfectly formatted.
		const formatted = formatFallback(content);
		await fs.writeFile(filePath, formatted, 'utf-8');
	}
}

export const cssReporter: Reporter = {
	name: 'css',
	async generate(report, options) {
		const usedParts: string[] = [];
		const unusedParts: string[] = [];

		for (const stylesheet of report.stylesheets) {
			if (stylesheet.usedCss) {
				usedParts.push(stylesheet.usedCss);
			}

			if (stylesheet.unusedCss) {
				unusedParts.push(stylesheet.unusedCss);
			}
		}

		const header = `/* css-scan report — ${report.url} — ${report.pages.length} page(s) — ${report.timestamp} */\n`;

		const usedContent = header + usedParts.join('\n');
		const unusedContent = header + unusedParts.join('\n');

		const usedPath = path.resolve(options.outputDir, 'used.css');
		const unusedPath = path.resolve(options.outputDir, 'unused.css');

		await Promise.all([
			formatAndWrite(usedPath, usedContent),
			formatAndWrite(unusedPath, unusedContent),
		]);

		return ['used.css', 'unused.css'];
	},
};
