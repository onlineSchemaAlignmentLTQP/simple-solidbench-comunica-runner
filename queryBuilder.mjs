import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from "path";

export async function buildQueries(queryFolderPath) {
    const queryFolder = await readdir(queryFolderPath);

    for (const query of queryFolder) {
        if (query === "parsed") {
            continue;
        }
        const file = join(queryFolderPath, query);
        const queryStrings = String(await readFile(file)).split("\n\n");
        let i = 0;
        const object = {};
        for (const queryString of queryStrings) {
            object[`v${i}`] = queryString;
            i += 1;
        }
        await writeFile(join(queryFolderPath, "parsed", `${query}.json`), JSON.stringify(object));
    }
}
