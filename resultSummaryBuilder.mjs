import { readFileSync, writeFileSync } from 'fs';

export function generateSummaryResults(resultFilePaths) {
    for (const [filePath, outPath] of resultFilePaths) {
        const summary = {};
        const data = JSON.parse(String(readFileSync(filePath)));
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
                const std = getStandardDeviation(allExecutionTime);
                summary[queryName][versionName]["execution_time"] = {
                    average,
                    min,
                    max,
                    std
                };
            }
        }
        const prettySummary = JSON.stringify(summary, null, 2);
        writeFileSync(outPath, prettySummary);
    }
}

// https://stackoverflow.com/a/53577159
function getStandardDeviation(array) {
    const n = array.length
    const mean = array.reduce((a, b) => a + b) / n
    return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)
}