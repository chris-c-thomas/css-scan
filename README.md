# CSS Scan

[![Version](https://img.shields.io/badge/Release-v1.1.0-blue?style=for-the-badge)](https://github.com/chris-c-thomas/css-scan/releases)
[![License](https://img.shields.io/github/license/chris-c-thomas/css-scan?style=for-the-badge)](LICENSE)
[![Open PRs](https://img.shields.io/github/issues-pr/chris-c-thomas/css-scan?style=for-the-badge)](https://github.com/chris-c-thomas/css-scan/pulls)
[![Issues](https://img.shields.io/github/issues/chris-c-thomas/css-scan?style=for-the-badge)](https://github.com/chris-c-thomas/css-scan/issues)

A CLI tool to scan websites and identify unused CSS. Uses Playwright to simulate real browser rendering across multiple viewport sizes and pages, providing accurate, merged CSS coverage analysis.

## Features

- **Multi-Page Scanning**: Crawl internal links to generate a global "used CSS" file for your entire site.
- **Viewport Coverage**: Scans across desktop, tablet, and mobile viewports for every page.
- **Smart Merging**: automatically combines usage data from multiple pages to prevent deleting CSS used on one page but not another.
- **Exports**: Generates `used.css` and `unused.css` files.
- **Interactive UI**: Terminal interface with real-time crawling progress.
- **Prettier**: Automatically formats the output CSS.

## Requirements

- Node.js 18+
- Playwright (installed automatically with dependencies)

## Installation

```bash
npm install -g css-scan

```

Or run directly with npx:

```bash
npx css-scan

```

## Usage

### Interactive Mode

```bash
css-scan

```

You will be prompted to enter a URL. By default, this runs a single-page scan.

### CLI Arguments

You can pass arguments to skip the interactive prompt and enable advanced crawling.

| Flag | Alias | Description | Default |
| --- | --- | --- | --- |
| `--url` | `-u` | The starting URL to scan | `null` |
| `--depth` | `-d` | How many levels of links to crawl | `0` (Single Page) |
| `--max-pages` | `-m` | Maximum number of pages to scan | `1` |

### Examples

**Scan a single page:**

```bash
css-scan -u [https://example.com](https://example.com)

```

**Scan a page and its immediate children (Depth 1), up to 5 pages total:**

```bash
css-scan -u [https://example.com](https://example.com) --depth 1 --max-pages 5

```

**Deep crawl (Depth 2) of a documentation site:**

```bash
css-scan --url [https://docs.example.com](https://docs.example.com) -d 2 -m 20

```

## Output

The tool generates two files in your current working directory:

| File | Description |
| --- | --- |
| `used.css` | Combined CSS rules used across *all* scanned pages |
| `unused.css` | CSS rules that were not used on *any* scanned page |

Console output includes:

- Number of pages scanned
- Total Bytes Processed
- Used vs. Unused Bytes
- Final Unused Percentage

## Viewport Coverage

CSS coverage is collected across the following viewport configurations for **every page scanned**:

- Desktop: 1920x1080
- Tablet: 768x1024
- Mobile: 375x667

This ensures media queries and responsive styles are properly evaluated.

## How It Works

1. **Launch**: Starts a headless Chromium browser via Playwright.
2. **Crawl**: Visits the target URL. If `--depth` is > 0, it extracts internal links and adds them to a queue.
3. **Scan**: For each page in the queue (up to `--max-pages`):

- Cycles through Desktop, Tablet, and Mobile viewports.
- Scrolls to trigger lazy-loaded elements.
- Captures CSS coverage data.

1. **Merge**: Intelligently merges CSS ranges. If a class is used on Page A but not Page B, it is marked as **Used**.
2. **Write**: Outputs the final, formatted CSS files to disk.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally
npm start

```

## License

MIT
