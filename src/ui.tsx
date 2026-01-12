import React, { useState, useEffect } from 'react';
import { Text, Box, useApp } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import { scanCssCoverage } from './scanner.js';
import { AppState, CssUsageResult, ScanOptions } from './types.js';

function formatBytes(bytes: number, decimals = 2): string {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

interface AppProps {
    initialUrl?: string;
    depth?: number;
    maxPages?: number;
}

export const App: React.FC<AppProps> = ({ initialUrl, depth = 0, maxPages = 1 }) => {
    const { exit } = useApp();
    const [url, setUrl] = useState(initialUrl || '');
    const [state, setState] = useState<AppState>(initialUrl ? 'SCANNING' : 'IDLE');
    const [result, setResult] = useState<CssUsageResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Scanner progress state
    const [scanProgress, setScanProgress] = useState<{ current: string; count: number } | null>(null);

    useEffect(() => {
        if (state === 'SCANNING') {
            const runScan = async () => {
                try {
                    const options: ScanOptions = {
                        depth,
                        maxPages,
                        onProgress: (currentUrl, count) => {
                            setScanProgress({ current: currentUrl, count });
                        }
                    };

                    const data = await scanCssCoverage(url, options);
                    setResult(data);
                    setState('SUCCESS');
                } catch (err: any) {
                    setError(err.message || 'An unknown error occurred');
                    setState('ERROR');
                }
            };
            runScan();
        }
    }, [state, url, depth, maxPages]);

    const handleSubmit = (inputUrl: string) => {
        if (!inputUrl.startsWith('http')) {
            setError('URL must start with http:// or https://');
            return;
        }
        setUrl(inputUrl);
        setError(null);
        setState('SCANNING');
    };

    if (state === 'IDLE') {
        // Simple input only asks for URL. 
        // Advanced options (depth/max) are best handled via CLI flags for now, 
        // or you could add more inputs here.
        return (
            <Box flexDirection="column" padding={1}>
                <Text color="cyan">Enter a website URL to scan:</Text>
                <Box borderStyle="round" borderColor="blue" paddingX={1}>
                    <TextInput
                        value={url}
                        onChange={setUrl}
                        onSubmit={handleSubmit}
                        placeholder="https://example.com"
                    />
                </Box>
                <Text color="gray" dimColor>
                    (Tip: Use CLI flags --depth and --max-pages for crawling)
                </Text>
                {error && <Text color="red">Error: {error}</Text>}
            </Box>
        );
    }

    if (state === 'SCANNING') {
        return (
            <Box padding={1} flexDirection="column">
                <Text color="yellow">
                    <Spinner type="dots" /> Scanning...
                </Text>
                {scanProgress && (
                    <Box marginLeft={2} flexDirection="column">
                        <Text>Pages Scanned: <Text bold color="cyan">{scanProgress.count}</Text></Text>
                        <Text dimColor>Current: {scanProgress.current}</Text>
                    </Box>
                )}
            </Box>
        );
    }

    if (state === 'ERROR') {
        return (
            <Box flexDirection="column" padding={1}>
                <Text color="red" bold>❌ Scan Failed</Text>
                <Text>{error}</Text>
            </Box>
        );
    }

    if (state === 'SUCCESS' && result) {
        const percentage = parseFloat(result.unusedPercentage);
        const statusColor = percentage > 50 ? 'red' : 'green';

        return (
            <Box flexDirection="column" padding={1} borderStyle="single" borderColor="gray">
                <Box marginBottom={1}>
                    <Text bold underline>CSS Usage Metrics</Text>
                </Box>

                <Box marginBottom={1}>
                    <Text>Base URL: {result.url}</Text>
                </Box>

                <Box marginBottom={1} flexDirection="column">
                    <Text color="cyan">Pages Scanned: {result.totalPagesScanned}</Text>
                    <Text color="gray" dimColor>Depth: {depth} | Max: {maxPages}</Text>
                </Box>

                <Box>
                    <Box width={20}><Text>Used:</Text></Box>
                    <Text bold color="green">{formatBytes(result.usedBytes)}</Text>
                </Box>

                <Box>
                    <Box width={20}><Text>Unused:</Text></Box>
                    <Text bold color={statusColor}>{formatBytes(result.unusedBytes)}</Text>
                </Box>

                <Box>
                    <Box width={20}><Text>Total:</Text></Box>
                    <Text bold>{formatBytes(result.totalBytes)}</Text>
                </Box>

                <Box marginTop={1}>
                    <Box width={20}><Text>Percentage Unused:</Text></Box>
                    <Text bold color={statusColor}>
                        {result.unusedPercentage}%
                    </Text>
                </Box>

                <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor="green" paddingX={1}>
                    <Text>Exported Used CSS: <Text bold color="blue">{result.outputFile}</Text></Text>
                    <Text>Exported Unused CSS: <Text bold color="blue">{result.unusedOutputFile}</Text></Text>
                </Box>
            </Box>
        );
    }

    return null;
};