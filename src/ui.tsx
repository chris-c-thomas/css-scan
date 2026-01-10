import React, { useState, useEffect } from 'react';
import { Text, Box, useApp } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import { scanCssCoverage } from './services/scanner.js';
import { AppState, CssUsageResult } from './types.js';

// --- Utility: Auto-scale Bytes ---
// accurately converts raw bytes to KB, MB, GB, etc.
function formatBytes(bytes: number, decimals = 2): string {
    if (!+bytes) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    // Calculate which index of 'sizes' we are at (log base 1024)
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

interface AppProps {
    initialUrl?: string;
}

export const App: React.FC<AppProps> = ({ initialUrl }) => {
    const { exit } = useApp();
    const [url, setUrl] = useState(initialUrl || '');
    const [state, setState] = useState<AppState>(initialUrl ? 'SCANNING' : 'IDLE');
    const [result, setResult] = useState<CssUsageResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (state === 'SCANNING') {
            const runScan = async () => {
                try {
                    const data = await scanCssCoverage(url);
                    setResult(data);
                    setState('SUCCESS');
                } catch (err: any) {
                    setError(err.message || 'An unknown error occurred');
                    setState('ERROR');
                }
            };
            runScan();
        }
    }, [state, url]);

    const handleSubmit = (inputUrl: string) => {
        if (!inputUrl.startsWith('http')) {
            setError('URL must start with http:// or https://');
            return;
        }
        setUrl(inputUrl);
        setError(null);
        setState('SCANNING');
    };

    // --- RENDER VIEWS ---

    if (state === 'IDLE') {
        return (
            <Box flexDirection="column" padding={1}>
                <Text color="cyan">Enter website URL to scan for unused CSS:</Text>
                <Box borderStyle="round" borderColor="blue" paddingX={1}>
                    <TextInput
                        value={url}
                        onChange={setUrl}
                        onSubmit={handleSubmit}
                        placeholder="https://example.com"
                    />
                </Box>
                {error && <Text color="red">Error: {error}</Text>}
            </Box>
        );
    }

    if (state === 'SCANNING') {
        return (
            <Box padding={1}>
                <Text color="yellow">
                    <Spinner type="dots" /> Scanning <Text bold>{url}</Text>...
                </Text>
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
        // Thresholds: > 50% unused is "bad" (red), < 50% is "good" (green)
        const statusColor = percentage > 50 ? 'red' : 'green';

        return (
            <Box flexDirection="column" padding={1} borderStyle="single" borderColor="gray">
                <Box marginBottom={1}>
                    <Text bold underline>CSS Usage Metrics For: {result.url}</Text>
                </Box>

                {/* 1. CSS Total */}
                <Box>
                    <Box width={20}>
                        <Text>CSS Total:</Text>
                    </Box>
                    <Text bold>{formatBytes(result.totalBytes)}</Text>
                </Box>

                {/* 2. CSS Used */}
                <Box>
                    <Box width={20}>
                        <Text>CSS Used:</Text>
                    </Box>
                    <Text bold color="green">{formatBytes(result.usedBytes)}</Text>
                </Box>

                {/* 3. CSS Unused */}
                <Box>
                    <Box width={20}>
                        <Text>CSS Unused:</Text>
                    </Box>
                    <Text bold color={statusColor}>{formatBytes(result.unusedBytes)}</Text>
                </Box>

                {/* 4. CSS Wasted */}
                <Box marginTop={1}>
                    <Box width={20}>
                        <Text>CSS Wasted:</Text>
                    </Box>
                    <Text bold color={statusColor} backgroundColor={percentage > 70 ? '#330000' : undefined}>
                        {result.unusedPercentage}%
                    </Text>
                </Box>


            </Box>
        );
    }

    return null;
};