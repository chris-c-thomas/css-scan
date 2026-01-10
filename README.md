# CSS Scan

[![Version](https://img.shields.io/badge/Release-v1.0.0-blue?style=for-the-badge)](https://github.com/chris-c-thomas/css-scan/releases)
[![License](https://img.shields.io/github/license/chris-c-thomas/css-scan?style=for-the-badge)](LICENSE)
[![Open PRs](https://img.shields.io/github/issues-pr/chris-c-thomas/css-scan?style=for-the-badge)](https://github.com/chris-c-thomas/css-scan/pulls)
[![Issues](https://img.shields.io/github/issues/chris-c-thomas/css-scan?style=for-the-badge)](https://github.com/chris-c-thomas/css-scan/issues)

A CLI tool to scan websites and identify unused CSS. Uses Playwright to simulate real browser rendering across multiple viewport sizes, providing accurate CSS coverage analysis.

## Features

- Scans CSS coverage across desktop, tablet, and mobile viewports
- Exports both used and unused CSS to separate files
- Interactive terminal UI with real-time feedback
- Supports direct URL input via command-line flags
- Formats output CSS with Prettier

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

You will be prompted to enter a URL to scan.

### Direct URL

```bash
css-scan --url https://www.google.com
# or
css-scan -u https://www.google.com
```

## Output

The tool generates two files in your current working directory:

| File          | Description                                       |
|---------------|---------------------------------------------------|
| `used.css`    | CSS rules that were applied during page render    |
| `unused.css`  | CSS rules that were not applied                   |

Console output includes the following CSS metrics:

- Used Size
- Unused Size
- Total Size
- Percentage of Unused CSS

## Viewport Coverage

CSS coverage is collected across the following viewport configurations by default:

- Desktop: 1920x1080
- Tablet: 768x1024
- Mobile: 375x667

This ensures media queries and responsive styles are properly evaluated.

## How It Works

1. Launches a headless Chromium browser via Playwright
2. Enables CSS coverage instrumentation
3. Loads the target URL and cycles through viewport sizes
4. Scrolls the page to trigger any lazy-loaded styles
5. Collects coverage data and calculates used vs unused ranges
6. Writes formatted CSS files to disk

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
