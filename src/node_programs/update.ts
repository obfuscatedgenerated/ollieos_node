import type { Program } from "ollieos/src/types";

import { ANSI, NEWLINE } from "ollieos/src/kernel/term_ctl";

import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

export default {
    name: "update",
    description: "[Node tools] Updates the OS via npm.",
    usage_suffix: "",
    arg_descriptions: {},
    main: async (data) => {
        // extract from data to make code less verbose
        const { term } = data;

        // extract from ansi to make code less verbose
        const { PREFABS, STYLE, FG } = ANSI;

        // get real life working directory
        const cwd = process.cwd();

        // if working directory is not where the code lives, change it
        const code = path.join(__dirname, "..", "..");
        if (cwd !== code) {
            process.chdir(code);
        }

        term.writeln("Updating OllieOS...");

        // run the update command
        const exec_async = promisify(exec);
        try {
            const { stdout, stderr } = await exec_async("npm update ollieos");

            term.writeln(stdout);
            if (stderr) {
                term.writeln(`${PREFABS.error}${stderr}${STYLE.reset_all}`);
            }

            term.write(FG.green);
            term.writeln("OllieOS updated successfully.");
            term.writeln("Please restart the terminal to apply the changes.");
            term.write(STYLE.reset_all);

            // restore working directory
            process.chdir(cwd);

            return 0;
        } catch (error) {
            term.writeln(`${PREFABS.error}Error updating OllieOS:${NEWLINE}${error}${STYLE.reset_all}`);

            // restore working directory
            process.chdir(cwd);

            return 1;
        }
    }
} as Program;
