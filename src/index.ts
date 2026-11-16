import {set_location_url_opener} from "./browser_polyfills";

// TODO: custom global interface
(globalThis as any).OLLIEOS_NODE = true;

import type { KernelFuncs, Program, ThreadFuncs } from "ollieos/src/types";

import * as builtin_modules from "ollieos/src/programs/@ALL";
import * as node_modules from "./node_programs/@ALL";

import { Kernel, type VirtualProgram } from "ollieos/src/kernel";
import { ANSI } from "ollieos/src/lib/ansi";

import { RealFS } from "./real_fs";
import { initial_fs_setup } from "ollieos/src/initial_fs_setup";

import { NodeTerminal } from "./node_terminal";
import { NodePlatformAPI } from "./node_platform";
import {setup_keypress_events} from "./keyboard";

import { version } from "ollieos/package.json";

const main = async () => {
    // surpress console logs TODO: add command line flag to not do this. however they can use jsdbg once the os is running
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
    console.table = () => {};
    console.debug = () => {};
    console.info = () => {};

    // construct virtual programs (inline kernel funcs) from the builtins, and our node specific programs
    const builtin_programs: Record<string, Program> = {};
    const virtual_programs = new Map<string, VirtualProgram>();

    for (const [name, module] of Object.entries({...builtin_modules, ...node_modules})) {
        const program = module.default as Program;

        // some builtins only make sense in a browser
        if (program.node_opt_out) {
            continue;
        }

        const {kernel_funcs, threads} = module as {kernel_funcs?: KernelFuncs, threads?: ThreadFuncs};

        builtin_programs[name] = program;
        virtual_programs.set(name, {...program, kernel_funcs, threads});
    }

    // create a filesystem
    const oo_fs = new RealFS();

    // create initial files
    await initial_fs_setup(oo_fs, builtin_programs);

    // create a terminal that draws to stdout
    const term = new NodeTerminal();

    // opening urls (including from the few places still using location) goes through the platform api
    const platform = new NodePlatformAPI();
    set_location_url_opener((url) => platform.open_url(url));

    // create the kernel (window manager, network and isothreads not yet supported)
    const kernel = new Kernel({
        term,
        fs: oo_fs,
        platform,
        virtual_programs,
    });
    kernel.set_env_info(version, "node");

    // now we run the custom logic to make it work with node!

    // override term.dispose for shutdown
    const old_dispose = term.dispose.bind(term);
    term.dispose = async () => {
        // wait for anything still being opened to hand off before exiting
        // this hack primarily solves windows issues but i have no idea how it behaves on other platforms (please raise an issue if it gets stuck!)
        await platform.wait_for_pending_opens();

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
            term.write(ANSI.CURSOR.visible);

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
