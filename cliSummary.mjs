import { join } from "path";
import { Command } from 'commander';
import { generateSummaryResults } from './resultSummaryBuilder.mjs';

const program = new Command();
program
    .name('evaluation')
    .description('CLI program to run a SPARQL query using Comunica for the context of benchmarking')
    .version('0.0.0')

    .requiredOption('-c, --configFilePath <string>', 'Path of a config file containing a JSON array of the format {"data":[[${config Path}, ${name of the config}]]} to be executed')
    .requiredOption('-o, --output <string>', 'result folder')
    .parse(process.argv);

const options = program.opts();
const configFileText = (await readFile(options.configFilePath)).toString();
const configPaths = JSON.parse(configFileText).data;
const RESULT_FOLDER = options.output;

const resultFilePaths = configPaths.map((x) => [join('./', RESULT_FOLDER, `${x[1]}_result.json`), join('./', RESULT_FOLDER, `summary_${x[1]}_result.json`)]);
await generateSummaryResults(resultFilePaths);
