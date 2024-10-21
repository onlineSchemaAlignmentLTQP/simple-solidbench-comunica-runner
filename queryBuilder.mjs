import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from "path";

export function buildQueries(queryFolderPath) {
    const queryFolder = readdirSync(queryFolderPath);

    for (const query of queryFolder) {
        if (query === "parsed") {
            continue;
        }
        const file = join(queryFolderPath, query);
        const queryStrings = String(readFileSync(file)).split("\n\n");
        let i = 0;
        const object = {};
        for (const queryString of queryStrings) {
            object[`v${i}`] = queryString;
            i += 1;
        }
        writeFileSync(join(queryFolderPath, "parsed", `${query}.json`), JSON.stringify(object));
    }
}
