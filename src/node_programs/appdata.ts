import type { Program } from "ollieos/src/types";

import { appdata } from "../util";
import open from "open";

export default {
    name: "appdata",
    description: "[Node tools] Opens the app data directory for the RealFS.",
    usage_suffix: "",
    arg_descriptions: {},
    main: async (data) => {
        // extract from data to make code less verbose
        const { term } = data;

        await open(appdata("ollieos/fs"));

        term.writeln("Opened app data directory.");

        return 0;
    }
} as Program;
