import postcss, {type Root, type ChildNode, type AtRule, type Rule} from 'postcss';
import {
	type AggregatedCoverage,
	type ScanReport,
	type StylesheetAnalysis,
	type AnalyzedRule,
	ScanReportSchema,
} from './types.js';

const MAX_NESTING_DEPTH = 20;

/**
 * Check if a node's byte range overlaps with any "used" range from Playwright.
 * Defaults to "used" when source positions are unavailable (safety invariant).
 */
function isNodeUsed(
	node: ChildNode,
	usedRanges: Array<{start: number; end: number}>,
): boolean {
	const nodeStart = node.source?.start?.offset;
	const nodeEnd = node.source?.end?.offset;

	// If postcss couldn't determine source positions, assume used (safe default)
	if (nodeStart === undefined || nodeEnd === undefined) {
		return true;
	}

	return usedRanges.some(range =>
		nodeStart < range.end && nodeEnd > range.start,
	);
}

/**
 * Get the byte size of a node based on its source positions.
 * Falls back to stringified length if positions are unavailable.
 */
function getNodeBytes(node: ChildNode): number {
	const start = node.source?.start?.offset;
	const end = node.source?.end?.offset;
	if (start !== undefined && end !== undefined) {
		return end - start;
	}

	return node.toString().length;
}

/**
 * Build the at-rule context string for a node (e.g. "@media (max-width: 768px)").
 */
function getAtRuleContext(node: ChildNode): string | null {
	const contexts: string[] = [];
	// Walk up the parent chain manually
	let current: ChildNode | Root | undefined = node;
	while (current?.parent) {
		const p = current.parent;
		if (p.type === 'root') {
			break;
		}

		if (p.type === 'atrule') {
			const atRule = p as AtRule;
			contexts.unshift(`@${atRule.name} ${atRule.params}`);
		}

		current = p as ChildNode;
	}

	return contexts.length > 0 ? contexts.join(' > ') : null;
}

/**
 * Recursively classify nodes in an at-rule, distributing children
 * into usedRoot and unusedRoot with proper at-rule wrappers.
 */
function classifyAtRule(
	atRule: AtRule,
	usedRanges: Array<{start: number; end: number}>,
	usedParent: Root | AtRule,
	unusedParent: Root | AtRule,
	rules: AnalyzedRule[],
	stylesheet: string,
	depth: number,
): void {
	if (depth > MAX_NESTING_DEPTH) {
		// Pathologically deep nesting — treat as used (safe default)
		usedParent.append(atRule.clone());
		return;
	}

	let usedWrapper: AtRule | undefined;
	let unusedWrapper: AtRule | undefined;

	for (const child of atRule.nodes ?? []) {
		if (child.type === 'atrule') {
			// Nested at-rule — recurse
			const childAtRule = child as AtRule;

			// Lazily create wrappers
			if (!usedWrapper) {
				usedWrapper = postcss.atRule({name: atRule.name, params: atRule.params});
			}

			if (!unusedWrapper) {
				unusedWrapper = postcss.atRule({name: atRule.name, params: atRule.params});
			}

			classifyAtRule(childAtRule, usedRanges, usedWrapper, unusedWrapper, rules, stylesheet, depth + 1);
		} else if (child.type === 'rule') {
			const rule = child as Rule;
			const used = isNodeUsed(rule, usedRanges);

			rules.push({
				selector: rule.selector,
				atRuleContext: getAtRuleContext(rule),
				stylesheet,
				bytes: getNodeBytes(rule),
				used,
				usedOnPages: [], // Populated later if per-page tracking is added
			});

			if (used) {
				if (!usedWrapper) {
					usedWrapper = postcss.atRule({name: atRule.name, params: atRule.params});
				}

				usedWrapper.append(rule.clone());
			} else {
				if (!unusedWrapper) {
					unusedWrapper = postcss.atRule({name: atRule.name, params: atRule.params});
				}

				unusedWrapper.append(rule.clone());
			}
		} else if (child.type === 'decl') {
			// Bare declarations inside at-rules (e.g. @font-face, @page)
			// These are handled at the at-rule level, not individually
		}
	}

	if (usedWrapper && usedWrapper.nodes && usedWrapper.nodes.length > 0) {
		usedParent.append(usedWrapper);
	}

	if (unusedWrapper && unusedWrapper.nodes && unusedWrapper.nodes.length > 0) {
		unusedParent.append(unusedWrapper);
	}
}

/**
 * Check if any at-rule name indicates a structural/always-used at-rule.
 */
function isAlwaysUsedAtRule(name: string): boolean {
	const lower = name.toLowerCase();
	return lower === 'charset' || lower === 'import';
}

/**
 * Check if an at-rule is a block that should default to "used" for safety.
 * @font-face and @keyframes are included as used by default in v1.
 */
function isSafeDefaultUsedAtRule(name: string): boolean {
	const lower = name.toLowerCase();
	return lower === 'font-face' || lower === 'keyframes' || lower === '-webkit-keyframes' || lower === '-moz-keyframes';
}

/**
 * Analyze a single stylesheet's CSS using postcss AST.
 */
function analyzeStylesheet(
	url: string,
	text: string,
	usedRanges: Array<{start: number; end: number}>,
): StylesheetAnalysis {
	let root: Root;
	try {
		root = postcss.parse(text);
	} catch {
		// CSS parse error — treat entire stylesheet as used (safety invariant)
		return {
			url,
			totalBytes: text.length,
			usedBytes: text.length,
			unusedBytes: 0,
			usedCss: text,
			unusedCss: '',
			rules: [],
		};
	}

	const usedRoot = postcss.root();
	const unusedRoot = postcss.root();
	const rules: AnalyzedRule[] = [];

	for (const node of root.nodes) {
		if (node.type === 'comment') {
			// Discard comments from both outputs
			continue;
		}

		if (node.type === 'atrule') {
			const atRule = node as AtRule;

			// @charset and @import always go to used
			if (isAlwaysUsedAtRule(atRule.name)) {
				usedRoot.append(atRule.clone());
				continue;
			}

			// @font-face and @keyframes default to used (safe default for v1)
			if (isSafeDefaultUsedAtRule(atRule.name)) {
				usedRoot.append(atRule.clone());
				rules.push({
					selector: `@${atRule.name}`,
					atRuleContext: null,
					stylesheet: url,
					bytes: getNodeBytes(atRule),
					used: true,
					usedOnPages: [],
				});
				continue;
			}

			// @media, @supports, @layer, etc. — recurse into children
			if (atRule.nodes && atRule.nodes.length > 0) {
				classifyAtRule(atRule, usedRanges, usedRoot, unusedRoot, rules, url, 0);
			} else {
				// At-rule with no children (e.g. @layer name;) — treat as used
				usedRoot.append(atRule.clone());
			}

			continue;
		}

		if (node.type === 'rule') {
			const rule = node as Rule;
			const used = isNodeUsed(rule, usedRanges);

			rules.push({
				selector: rule.selector,
				atRuleContext: null,
				stylesheet: url,
				bytes: getNodeBytes(rule),
				used,
				usedOnPages: [],
			});

			if (used) {
				usedRoot.append(rule.clone());
			} else {
				unusedRoot.append(rule.clone());
			}

			continue;
		}

		// Declaration or other node at root level — treat as used (safe default)
		usedRoot.append(node.clone());
	}

	const usedCss = usedRoot.toString();
	const unusedCss = unusedRoot.toString();

	const usedBytes = rules.filter(r => r.used).reduce((sum, r) => sum + r.bytes, 0);
	const unusedBytes = rules.filter(r => !r.used).reduce((sum, r) => sum + r.bytes, 0);
	const totalBytes = usedBytes + unusedBytes;

	return {
		url,
		totalBytes,
		usedBytes,
		unusedBytes,
		usedCss,
		unusedCss,
		rules,
	};
}

/**
 * Analyze aggregated coverage data using postcss AST parsing.
 * Produces a complete ScanReport with per-rule classification.
 */
export function analyzeCoverage(
	coverage: AggregatedCoverage,
	initialUrl: string,
): ScanReport {
	const stylesheets: StylesheetAnalysis[] = [];

	for (const [url, data] of Array.from(coverage.stylesheets.entries())) {
		const analysis = analyzeStylesheet(url, data.text, data.ranges);
		stylesheets.push(analysis);
	}

	const totalBytes = stylesheets.reduce((sum, s) => sum + s.totalBytes, 0);
	const usedBytes = stylesheets.reduce((sum, s) => sum + s.usedBytes, 0);
	const unusedBytes = stylesheets.reduce((sum, s) => sum + s.unusedBytes, 0);
	const totalRules = stylesheets.reduce((sum, s) => sum + s.rules.length, 0);
	const usedRules = stylesheets.reduce((sum, s) => sum + s.rules.filter(r => r.used).length, 0);
	const unusedRules = stylesheets.reduce((sum, s) => sum + s.rules.filter(r => !r.used).length, 0);

	// Assert internal consistency
	if (totalBytes !== usedBytes + unusedBytes) {
		throw new Error(`Byte count mismatch: total=${totalBytes} !== used=${usedBytes} + unused=${unusedBytes}`);
	}

	if (totalRules !== usedRules + unusedRules) {
		throw new Error(`Rule count mismatch: total=${totalRules} !== used=${usedRules} + unused=${unusedRules}`);
	}

	const report: ScanReport = {
		url: initialUrl,
		timestamp: new Date().toISOString(),
		pages: coverage.pages,
		viewports: coverage.viewports,
		stylesheets,
		summary: {
			totalBytes,
			usedBytes,
			unusedBytes,
			unusedPercentage: totalBytes > 0
				? ((unusedBytes / totalBytes) * 100).toFixed(2)
				: '0',
			totalRules,
			usedRules,
			unusedRules,
		},
	};

	// Validate against Zod schema — loud errors during development
	ScanReportSchema.parse(report);

	return report;
}
