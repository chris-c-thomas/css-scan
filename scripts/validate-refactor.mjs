/**
 * Post-refactor validation script.
 * Run after generating output files to verify correctness.
 *
 * Usage: node scripts/validate-refactor.mjs
 */
import fs from 'node:fs';
import postcss from 'postcss';

let passed = 0;
let failed = 0;

function assert(condition, message) {
	if (condition) {
		console.log(`  PASS: ${message}`);
		passed++;
	} else {
		console.error(`  FAIL: ${message}`);
		failed++;
	}
}

console.log('Validating refactor output...\n');

// 1. Parse used.css with postcss — must not throw
console.log('1. Validating used.css is parseable CSS');
try {
	const usedCss = fs.readFileSync('used.css', 'utf-8');
	postcss.parse(usedCss);
	assert(true, 'used.css parses without errors');
} catch (e) {
	assert(false, `used.css parse error: ${e.message}`);
}

// 2. Parse unused.css with postcss — must not throw
console.log('2. Validating unused.css is parseable CSS');
try {
	const unusedCss = fs.readFileSync('unused.css', 'utf-8');
	postcss.parse(unusedCss);
	assert(true, 'unused.css parses without errors');
} catch (e) {
	assert(false, `unused.css parse error: ${e.message}`);
}

// 3. No rule should appear in BOTH files (selector + atRuleContext as key)
console.log('3. Checking for duplicate rules across files');
try {
	const usedCss = fs.readFileSync('used.css', 'utf-8');
	const unusedCss = fs.readFileSync('unused.css', 'utf-8');
	const usedRoot = postcss.parse(usedCss);
	const unusedRoot = postcss.parse(unusedCss);

	function collectSelectors(root) {
		const selectors = new Set();
		root.walkRules(rule => {
			// Build context chain
			let context = '';
			let parent = rule.parent;
			while (parent && parent.type !== 'root') {
				if (parent.type === 'atrule') {
					context = `@${parent.name} ${parent.params} > ${context}`;
				}
				parent = parent.parent;
			}
			selectors.add(`${context}${rule.selector}`);
		});
		return selectors;
	}

	const usedSelectors = collectSelectors(usedRoot);
	const unusedSelectors = collectSelectors(unusedRoot);

	let duplicates = 0;
	for (const sel of usedSelectors) {
		if (unusedSelectors.has(sel)) {
			duplicates++;
		}
	}

	assert(duplicates === 0, `No duplicate rules across files (found ${duplicates} duplicates)`);
} catch (e) {
	assert(false, `Duplicate check error: ${e.message}`);
}

// 4. ScanReport validates against expected structure
console.log('4. Validating JSON report structure');
try {
	const report = JSON.parse(fs.readFileSync('css-scan-report.json', 'utf-8'));

	assert(typeof report.url === 'string', 'report.url is a string');
	assert(typeof report.timestamp === 'string', 'report.timestamp is a string');
	assert(Array.isArray(report.pages), 'report.pages is an array');
	assert(Array.isArray(report.viewports), 'report.viewports is an array');
	assert(Array.isArray(report.stylesheets), 'report.stylesheets is an array');
	assert(typeof report.summary === 'object', 'report.summary is an object');

	// 5. summary.totalBytes === summary.usedBytes + summary.unusedBytes
	console.log('5. Validating byte count consistency');
	assert(
		report.summary.totalBytes === report.summary.usedBytes + report.summary.unusedBytes,
		`totalBytes (${report.summary.totalBytes}) === usedBytes (${report.summary.usedBytes}) + unusedBytes (${report.summary.unusedBytes})`,
	);

	// 6. summary.totalRules === summary.usedRules + summary.unusedRules
	console.log('6. Validating rule count consistency');
	assert(
		report.summary.totalRules === report.summary.usedRules + report.summary.unusedRules,
		`totalRules (${report.summary.totalRules}) === usedRules (${report.summary.usedRules}) + unusedRules (${report.summary.unusedRules})`,
	);
} catch (e) {
	assert(false, `JSON report validation error: ${e.message}`);
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
