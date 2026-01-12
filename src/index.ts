import "ollieos/src/load_global_externals";
import {wait_for_safe_close} from "./browser_polyfills";

// TODO: custom global interface
(globalThis as any).OLLIEOS_NODE = true;

import { ProgramRegistry } from "ollieos/src/kernel/prog_registry";
import type { Program } from "ollieos/src/types";

import * as programs from "ollieos/src/programs/@ALL";
import * as node_programs from "./node_programs/@ALL";

import { WrappedTerminal } from "ollieos/src/kernel/term_ctl";
import { Kernel } from "ollieos/src/kernel";

import { RealFS } from "./real_fs";
import { initial_fs_setup } from "ollieos/src/initial_fs_setup";

import {setup_keypress_events} from "./keyboard";

import { version } from "ollieos/package.json";

const main = async () => {
    // surpress console logs TODO: add command line flag to not do this. however they can use jsdbg once the os is running
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
    console.table = () => {};

    // create a program registry by importing all programs
    const prog_reg = new ProgramRegistry();
    for (const prog of Object.values(programs)) {
        await prog_reg.registerProgram({
            program: prog as Program<unknown>,
            built_in: true,
        });
    }

    // also inject our node specific programs
    for (const prog of Object.values(node_programs)) {
        await prog_reg.registerProgram({
            program: prog as Program<unknown>,
            built_in: true,
        });
    }


    // create a filesystem
    const oo_fs = new RealFS();

    // create initial files
    await initial_fs_setup(oo_fs);

    // create a terminal using the registry and filesystem
    const term = new WrappedTerminal({
        screenReaderMode: false,
        cursorBlink: true,
    });

    // create the kernel (sfx and window manager not yet supported)
    const kernel = new Kernel(term, oo_fs, prog_reg, undefined, undefined);
    kernel.set_env_info(version, "node");

    // now we run the custom logic to make it work with node!

    // // override term.execute to never set edit_doc_title to true
    // const old_execute = term.execute.bind(term);
    // term.execute = async (line) => {
    //     // always set edit_doc_title to false
    //     return old_execute(line, false);
    // };
    // TODO: shells exist now, need to change the strategy here (prob just override document.title)

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
    term.write = (data, callback) => {
        old_write(data);
        process.stdout.write(data);

        if (callback) {
            callback();
        }
    };

    const old_writeln = term.writeln.bind(term);
    term.writeln = (data, callback) => {
        old_writeln(data);
        process.stdout.write(data + "\n");

        if (callback) {
            callback();
        }
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

        // add keypress events
        setup_keypress_events(term);

        // boot the kernel and check for a false return (indicating boot failure). should probably never return true as the os should hopefully always run!
        const successful_finish = await kernel.boot();
        if (!successful_finish) {
            // restore cursor visibility just in case
            term.write(term.ansi.CURSOR.visible);

            process.exit(1);
        }
    } else {
        // being piped input

        // TODO: option to disable ANSI for piping stdout to a file

        console.log("Piped input temporarily not supported.");
        process.exit(1);

        // TODO: reimplement now we arent guaranteed to have the shell immediately run commands
        // // read in whole of stdin
        // let input = "";
        // process.stdin.on("data", async (chunk) => {
        //     input += chunk.toString();
        // });
        //
        // // got whole stdin
        // process.stdin.on("end", async () => {
        //     // execute each command split by newlines
        //     const split_input = input.split("\n");
        //     for (const line of split_input) {
        //         if (line.trim() === "") {
        //             continue; // skip empty lines
        //         }
        //
        //         await term.execute(line.trim());
        //     }
        //
        //     // then dispose the terminal
        //     term.dispose();
        // });
    }
}

main();
