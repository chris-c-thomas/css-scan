#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import { App } from './ui.js';

// Setup CLI help text and flags
const cli = meow(
    `
	Usage
	  $ css-scan

	Options
	  --url, -u  The URL to scan immediately

	Examples
	  $ css-scan
	  $ css-scan --url https://google.com
`,
    {
        importMeta: import.meta,
        flags: {
            url: {
                type: 'string',
                shortFlag: 'u',
            },
        },
    },
);

// Render the Ink App
render(<App initialUrl={cli.flags.url} />);