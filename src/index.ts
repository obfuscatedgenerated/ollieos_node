import "ollieos/src/load_global_externals";
import {wait_for_safe_close} from "./browser_polyfills";

// TODO: custom global interface
(globalThis as any).OLLIEOS_NODE = true;

import { ProgramRegistry } from "ollieos/src/prog_registry";
import * as programs from "ollieos/src/programs/@ALL";
import * as node_programs from "./node_programs/@ALL";

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
    // surpress console logs TODO: add command line flag to not do this. however they can use jsdbg once the os is running
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
    console.table = () => {};

    // create a program registry by importing all programs
    const prog_reg = new ProgramRegistry();
    for (const prog of Object.values(programs)) {
        prog_reg.registerProgram({
            program: prog,
            built_in: true,
        });
    }

    // also inject our node specific programs
    for (const prog of Object.values(node_programs)) {
        prog_reg.registerProgram({
            program: prog,
            built_in: true,
        });
    }


    // create a filesystem
    const oo_fs = new RealFS();

    // create initial files
    await initial_fs_setup(oo_fs);

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

    // override term.dispose for shutdown
    const old_dispose = term.dispose.bind(term);
    term.dispose = async () => {
        // check that browser polyfills is happy to close, wait if not
        // this is a hack to fix "open" from being async, but location.assign having to be sync
        // such that if a program was trying to open something but we are closing, it will wait for the open to finish
        // this hack primarily solves windows issues but i have no idea how it behaves on other platforms (please raise an issue if it gets stuck!)
        await wait_for_safe_close();

        old_dispose();
        process.exit(0);
    };

    term.set_variable("VERSION", version);
    term.set_variable("ENV", "node");

    if (process.stdin.isTTY) {
        // interactive tty

        // set terminal size
        term.resize(process.stdout.columns, process.stdout.rows);

        // listen for SIGWINCH to resize the terminal
        process.on("SIGWINCH", () => {
            term.resize(process.stdout.columns, process.stdout.rows);
        });

        // clear the console if --no-clear is not set (looks cleaner)
        if (!process.argv.includes("--no-clear")) {
            console.clear();
        }

        // finalise the init process as usual
        term.initialise(loaded);
    } else {
        // being piped input

        // TODO: option to disable ANSI for piping stdout to a file

        // only mount usr bin, do not load .ollie_profile and .ollierc as the initialise function does
        await term._mount_usr_bin();

        // read in whole of stdin
        let input = "";
        process.stdin.on("data", async (chunk) => {
            input += chunk.toString();
        });

        // got whole stdin
        process.stdin.on("end", async () => {
            // execute each command split by newlines
            const split_input = input.split("\n");
            for (const line of split_input) {
                if (line.trim() === "") {
                    continue; // skip empty lines
                }

                await term.execute(line.trim());
            }

            // then dispose the terminal
            term.dispose();
        });
    }
}

main();
