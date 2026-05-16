import { parseArgs, runImport } from "./lib/import-foundry-core.js";

const options = parseArgs(process.argv);
runImport(options)
    .then((result) => {
        console.log(
            `Import complete: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors`,
        );
    })
    .catch((error) => {
        console.error("Import failed:", error);
        process.exit(1);
    });
