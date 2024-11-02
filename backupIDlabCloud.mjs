import { exec } from 'child_process';

export function backUpExperiment(experimentName, experimentfolder, cloudfolder) {
    const compressFileExperiments = `/tmp/${experimentName}-${Date.now()}.tar.gz`;
    const command = `
    tar -chzvf ${compressFileExperiments} ${experimentfolder}
    ./cloudsend.sh ${compressFileExperiments} ${cloudfolder}
    rm -rf ${compressFileExperiments}
    `;
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing command: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`stderr: ${stderr}`);
            return;
        }
        console.log(`Experiment backed up: ${stdout}`);
    });
}