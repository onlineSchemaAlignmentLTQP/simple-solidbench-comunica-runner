import { join } from "path";
import { Command } from 'commander';
import { generateSummaryResults } from './resultSummaryBuilder.mjs';

const program = new Command();
program
    .name('evaluation')
    .description('CLI program to run a SPARQL query using Comunica for the context of benchmarking')
    .version('0.0.0')

    .requiredOption('-f, --files <string...>', 'raw result file in the result folder not full path')
    .requiredOption('-o, --output <string>', 'result folder')
    .parse(process.argv);

const options = program.opts();
const files = options.files;
const RESULT_FOLDER = options.output;

const resultFilePaths = files.map((file) => [join(RESULT_FOLDER, file), join(RESULT_FOLDER, `summary_${file}`)]);
await generateSummaryResults(resultFilePaths);
