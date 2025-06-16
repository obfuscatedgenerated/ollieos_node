import { LocalStorage } from "node-localstorage";
globalThis.localStorage = new LocalStorage("./ollieos_storage/localstorage");

import "ollieos/src/load_global_externals";

import { ProgramRegistry } from "ollieos/src/prog_registry";
import * as programs from "ollieos/src/programs/@ALL";

import { WrappedTerminal } from "ollieos/src/term_ctl";
import { RealFS } from "./real_fs";
import { initial_fs_setup } from "ollieos/src/initial_fs_setup";

import { version } from "ollieos/package.json";

import {setup_keypress_events} from "./keyboard";

const loaded = (term: WrappedTerminal) => {
    term.insert_preline();
    setup_keypress_events(term);
}

const main = async () => {
    // create a program registry by importing all programs
    const prog_reg = new ProgramRegistry();
    for (const prog of Object.values(programs)) {
        prog_reg.registerProgram({
            program: prog,
            built_in: true,
        });
    }


    // create a filesystem
    const oo_fs = new RealFS();

    // create initial files
    initial_fs_setup(oo_fs);

    // create a terminal using the registry and filesystem
    const term = new WrappedTerminal(oo_fs, prog_reg, undefined, {
        screenReaderMode: false,
        cursorBlink: true,
    });

    // now we run the custom logic to make it work with node!

    // override term.execute to never set edit_doc_title to true
    const old_execute = term.execute.bind(term);
    term.execute = async (line) => {
        // always set edit_doc_title to false
        return old_execute(line, false);
    };

    // override term.reset
    const old_reset = term.reset.bind(term);
    term.reset = () => {
        old_reset();
        console.clear();
    };

    // // push xterm stdout to the terminal
    // term.onData((data: string) => {
    //     process.stdout.write(data);
    // });
    // seemingly not working, just override write and writeln instead (less stable)
    const old_write = term.write.bind(term);
    term.write = (data: string) => {
        old_write(data);
        process.stdout.write(data);
    };

    const old_writeln = term.writeln.bind(term);
    term.writeln = (data: string) => {
        old_writeln(data);
        process.stdout.write(data + "\n");
    };

    // set terminal size
    term.resize(process.stdout.columns, process.stdout.rows);

    // listen for SIGWINCH to resize the terminal
    process.on("SIGWINCH", () => {
        term.resize(process.stdout.columns, process.stdout.rows);
    });

    // finalise the init process now our changes are made
    term.initialise(loaded);

    // read the version variable ($VERSION)
    term.set_variable("VERSION", version);
}

main();
