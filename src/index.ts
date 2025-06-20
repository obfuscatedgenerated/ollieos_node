import "ollieos/src/load_global_externals";
import "./browser_polyfills";

globalThis.OLLIEOS_NODE = true;

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

    // override term.dispose for shutdown
    const old_dispose = term.dispose.bind(term);
    term.dispose = () => {
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

        // read stdin and write it to the terminal
        // TODO: would it be simpler to just wait for the whole stdin and do all the execution on end?
        //  the current way should be super quick but if it causes issues do this ^^^^
        let input = "";
        let have_leftover = false;
        let wait_for_finish = false;
        process.stdin.on("data", async (chunk) => {
            input += chunk.toString();

            // if got a newline, execute the command so far
            if (input.includes("\n")) {
                const split_command = input.split("\n");
                const current_command = split_command.shift() || "";
                const leftover = split_command.join("\n");

                // execute the command
                wait_for_finish = true;
                await term.execute(current_command.trim());
                wait_for_finish = false;

                // reset the input to the remaining part
                input = leftover;
                have_leftover = (leftover.trim() !== "");
            }
        });

        process.stdin.on("end", async () => {
            // if wait_for_finish is true, make sure to wait for it to be false so we don't interrupt the current command
            // (fixes out of order execution / early killing race conditions)
            while (wait_for_finish) {
                // make sure to yield to avoid blocking the event loop
                await new Promise(resolve => setTimeout(resolve, 20));
            }

            // if there is leftover input, execute it
            if (have_leftover) {
                await term.execute(input.trim());
            }

            // then dispose the terminal
            term.dispose();
        });
    }
}

main();
