import { readFile, writeFile } from 'node:fs/promises';

export async function generateSummaryResults(resultFilePaths) {
    for (const [filePath, outPath] of resultFilePaths) {
        const summary = {};
        try {
            const data = JSON.parse(String(await readFile(filePath)));
            for (const [queryName, queries] of Object.entries(data["data"])) {
                summary[queryName] = {};
                for (const [versionName, version] of Object.entries(queries)) {
                    if (version["timeout"] !== undefined) {
                        summary[queryName][versionName] = version;
                        continue;
                    }
                    const allExecutionTime = [];
                    summary[queryName][versionName] = {};
                    for (const { execution_time, n_results, n_http_requests } of Object.values(version)) {
                        summary[queryName][versionName]["n_results"] = n_results;
                        summary[queryName][versionName]["n_http_requests"] = n_http_requests;
                        allExecutionTime.push(execution_time);
                    }

                    const average = allExecutionTime.reduce((a, b) => a + b, 0) / allExecutionTime.length;
                    const min = Math.min(...allExecutionTime);
                    const max = Math.max(...allExecutionTime);
                    const std = Math.sqrt(allExecutionTime.reduce((acc, current) => acc + Math.pow(current - average, 2)) / (allExecutionTime.length - 1));
                    summary[queryName][versionName]["execution_time"] = {
                        average,
                        min,
                        max,
                        std
                    };
                }
            }
            const prettySummary = JSON.stringify(summary, null, 2);
            await writeFile(outPath, prettySummary);
        } catch (e) {
            console.error(e);
        }

    }
}
