import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from "path";
import { spawnSync } from 'node:child_process';
import { Command } from 'commander';
import { buildQueries } from './queryBuilder.mjs'
import { generateSummaryResults } from './resultSummaryBuilder.mjs';

const RESULT_REGEX = /response start\n(.*)\nresponse end/u;
const HTTP_REQUEST_IDENTIFIER = "INFO: Requesting";

const program = new Command();
program
    .name('evaluation')
    .description('CLI program to run a SPARQL query using Comunica for the context of benchmarking')
    .version('0.0.0')

    .requiredOption('-c, --configFilePath <string>', 'Path of a config file containing a JSON array of the format {"data":[[${config Path}, ${name of the config}]]} to be executed')
    .requiredOption('-e, --runnerCommand <string>', 'command of the runner to be executed. It must accept the flags -q, -c, -t and -hdt being a query, the config a timeout and an option to run an HDT benchmark with path to a fragmentation')
    .requiredOption('-o, --output <string>', 'result folder')

    .option('-s, --sourceFile <string>', 'path of the source file', undefined)
    .option('-q, --queryFolderPath <string>', 'path of the query to be executed', './queries')
    .option('-t, --timeout <number>', 'Timeout of the query in second', 120)
    .option('-m, --memorySize <number>', 'Timeout of the query in second', 8192 * 1.5)
    .option('-r, --repetition <number>', 'number of repetition of each queries', 50)
    .option('-hdt, --pathFragmentationFolder <string>', 'The path of the dataset folder for querying over HDT. When not specified, it will execute an LTQP query.')

    .parse(process.argv);

const options = program.opts();
const queryFolderPath = options.queryFolderPath;
const timeout = Number(options.timeout) * 1000;
const memorySize = options.memorySize;
const configFileText = (await readFile(options.configFilePath)).toString();
const configPaths = JSON.parse(configFileText).data;
const nRepetition = options.repetition;
const runnerCommand = options.runnerCommand;
const pathFragmentationFolder = options.pathFragmentationFolder;
const sourceFile = options.sourceFile;

const RESULT_FOLDER = options.output;

const resultFilePaths = configPaths.map((x) => [join('./', RESULT_FOLDER, `${x[1]}_result.json`), join('./', RESULT_FOLDER, `summary_${x[1]}_result.json`)]);

await buildQueries(queryFolderPath);
await executeBenchmark(queryFolderPath, timeout, memorySize, configPaths, nRepetition, runnerCommand, pathFragmentationFolder, sourceFile);
await generateSummaryResults(resultFilePaths);

async function executeBenchmark(queryFolderPath, timeout, memorySize, configPaths, nRepetition, runnerCommand, pathFragmentationFolder, sourceFile) {
    const queryFolder = join(queryFolderPath, "parsed");
    const queriesFile = await readdir(queryFolder);
    let sources = undefined;
    const queries = [];
    for (const file of queriesFile) {
        if (file.includes(".gitkeep")) {
            continue;
        }
        const fileCompletePath = join(queryFolder, file);
        const queryName = file.replace(/\.[^/.]+$/, "").replace(/\.[^/.]+$/, "");
        queries.push([JSON.parse(await readFile(fileCompletePath)), queryName]);
    }

    if (sourceFile !== undefined) {
        sources = JSON.parse(await readFile(sourceFile))
    }


    for (const [configPath, name] of configPaths) {
        const results = {};
        for (const [queryObject, queryName] of queries) {
            const currentResult = {};
            for (const [version, query] of Object.entries(queryObject)) {
                currentResult[version] = [];
                for (let i = 0; i < nRepetition; ++i) {
                    console.log(`New query started repetition(s) ${i} index ${queryName} version ${version} with engine ${configPath}`);
                    let effectiveSources = undefined;
                    if (sources !== undefined) {
                        effectiveSources = sources[queryName] === undefined ? undefined : sources[queryName][version];
                    }
                    if (effectiveSources !== undefined && !Array.isArray(effectiveSources)) {
                        continue;
                    }
                    const command = createCommand(
                        runnerCommand,
                        configPath,
                        query,
                        memorySize,
                        pathFragmentationFolder,
                        timeout,
                        effectiveSources
                    );
                    try {
                        const { stdout, stderr, error } = spawnSync(command[0], command[1], { timeout: timeout + 2000, maxBuffer: undefined });
                        if (error && error.code === 'ETIMEDOUT') {
                            currentResult[version] = {
                                timeout: timeout,
                            };
                            results[queryName] = currentResult;
                            const resultFile = `${name}_result.json`;
                            await writeFile(join(RESULT_FOLDER, resultFile), JSON.stringify({ data: results }, null, 2));
                            break;
                        }
                        const stdoutSerialized = JSON.parse(RESULT_REGEX.exec(String(stdout))[1]);
                        stdoutSerialized["n_results"] = stdoutSerialized["results"].length;
                        stdoutSerialized["n_http_requests"] = getInformationFromLog(String(stderr));
                        currentResult[version].push(stdoutSerialized);
                        await sleep(5000);
                    } catch (err) {
                        console.log("error happen");
                        console.log(command);
                        console.error(String(err));
                        currentResult[version] = {
                            error: String(err),
                        };
                        results[queryName] = currentResult;
                        const resultFile = `${name}_result.json`;
                        await writeFile(join(RESULT_FOLDER, resultFile), JSON.stringify({ data: results }, null, 2));
                        break;
                    }

                    results[queryName] = currentResult;
                    const resultFile = `${name}_result.json`;
                    await writeFile(join(RESULT_FOLDER, resultFile), JSON.stringify({ data: results }, null, 2));
                }

            }
        }
    }
}

function createCommand(runnerCommand, configPath, query, memorySize, pathFragmentationFolder, timeout, sources) {
    const command = "node";
    const formattedQuery = query.replace(/(\r\n|\n|\r)/gm, " ");

    const args = [
        `--max-old-space-size=${memorySize}`,
        runnerCommand,
        '-c', configPath,
        '-q', formattedQuery,
        '-t', timeout.toString(),
        '-w', String(10)
    ];
    if (pathFragmentationFolder !== undefined) {
        args.push("-hdt");
        args.push(pathFragmentationFolder);
    }
    if (sources !== undefined) {
        args.push("-s");
        args.push(JSON.stringify(sources));
    }
    return [command, args];
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getInformationFromLog(content) {
    let numberHttpRequest = 0;
    console.log(content);
    for (const line of content.split('\n')) {
        numberHttpRequest += fetchNumberOfHttpRequest(line);
    }
    return numberHttpRequest;
}

function fetchNumberOfHttpRequest(line) {
    return line.includes(HTTP_REQUEST_IDENTIFIER) ? 1 : 0;
}