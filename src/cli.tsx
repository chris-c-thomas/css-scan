#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import { App } from './ui.js';

const cli = meow(
    `
	Usage
	  $ css-scan

	Options
	  --url, -u       The URL to scan immediately
	  --depth, -d     Crawling depth (default: 0 - single page)
	  --max-pages, -m Maximum pages to scan (default: 1)

	Examples
	  $ css-scan
	  $ css-scan --url https://google.com
	  $ css-scan -u https://mysite.com -d 2 -m 10
`,
    {
        importMeta: import.meta,
        flags: {
            url: {
                type: 'string',
                shortFlag: 'u',
            },
            depth: {
                type: 'number',
                shortFlag: 'd',
                default: 0
            },
            maxPages: {
                type: 'number',
                shortFlag: 'm',
                default: 1
            }
        },
    },
);

render(
    <App
        initialUrl={cli.flags.url}
        depth={cli.flags.depth}
        maxPages={cli.flags.maxPages}
    />
);