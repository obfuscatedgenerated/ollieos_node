import { LocalStorage } from "node-localstorage";
globalThis.localStorage = new LocalStorage("./ollieos_storage");

import { ProgramRegistry } from "ollieos/src/prog_registry";
import * as programs from "ollieos/src/programs/@ALL";

import { WrappedTerminal } from "ollieos/src/term_ctl";
import { LocalStorageFS } from "ollieos/src/fs_impl/localstorage";
import { initial_fs_setup } from "ollieos/src/initial_fs_setup";

import { version } from "ollieos/package.json";

import * as readline from "node:readline";

const key_to_code = (name: string | undefined) => {
    if (!name) {
        return "Unidentified";
    }

    // Handle letters
    if (/^[a-zA-Z]$/.test(name)) {
        return 'Key' + name.toUpperCase();
    }

    // Handle digits
    if (/^[0-9]$/.test(name)) {
        return 'Digit' + name;
    }

    // Common symbol and control keys
    // TODO: more jank, please someone make a library!!!
    const keyMap = {
        'Enter': 'Enter',
        'Backspace': 'Backspace',
        'Tab': 'Tab',
        ' ': 'Space',
        'Escape': 'Escape',
        'Esc': 'Escape',
        'Shift': 'ShiftLeft', // assume left
        'Control': 'ControlLeft',
        'Alt': 'AltLeft',
        'Meta': 'MetaLeft',
        'ArrowUp': 'ArrowUp',
        'ArrowDown': 'ArrowDown',
        'ArrowLeft': 'ArrowLeft',
        'ArrowRight': 'ArrowRight',
        '-': 'Minus',
        '=': 'Equal',
        '[': 'BracketLeft',
        ']': 'BracketRight',
        '\\': 'Backslash',
        ';': 'Semicolon',
        "'": 'Quote',
        ',': 'Comma',
        '.': 'Period',
        '/': 'Slash',
        '`': 'Backquote',
        'Delete': 'Delete',
    };

    return keyMap[name] || null;
}

const make_keyboard_event = (char: string, key: readline.Key) => {
    const key_code = char.charCodeAt(0);

    // put keyname in title case if not a single character
    // TODO: this is jank, someone needs to make a proper mapping for these
    if (key.name && key.name.length > 1) {
        key.name = key.name.charAt(0).toUpperCase() + key.name.slice(1);
    }

    const base = {
        key: key.name,
        code: key_to_code(key.name) || "Unidentified",
        keyCode: key_code,
        ctrlKey: key.ctrl,
        altKey: false,
        shiftKey: key.shift,
        metaKey: key.meta
    };

    return <KeyboardEvent>new Proxy(base, {
        get(target, prop) {
            if (prop in target) {
                return target[prop as keyof typeof target];
            }
            console.warn(`Attempt to access non-existent property '${String(prop)}' on fake KeyboardEvent`);
            return undefined;
        },
    });
}

const loaded = (term: WrappedTerminal) => {
    term.insert_preline();

    // set up keypress events
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    process.stdin.on("keypress", (char: string, key: readline.Key) => {
        if (char === "\u0003") { // Ctrl+C
            process.exit(0);
        }

        // TODO: hide unhandled key event console warning

        // handle special keys
        // TODO: JANK!
        if (key.name === "escape") {
            char = "\x1b";
        } else if (key.name === "delete") {
            char = "\x7f";
        } else if (key.name === "up") {
            key.name = "ArrowUp";
            char = "\x1b[A";
        } else if (key.name === "down") {
            key.name = "ArrowDown";
            char = "\x1b[B";
        } else if (key.name === "left") {
            key.name = "ArrowLeft";
            char = "\x1b[D";
        } else if (key.name === "right") {
            key.name = "ArrowRight";
            char = "\x1b[C";
        }

        if (!char) {
            char = ""; // prevent undefined from being sent
            console.warn("Improperly handled special key:", key.name);
        }

        const dom_keyboard_event = make_keyboard_event(char, key);

        term._enqueue_key_event({
            key: char,
            domEvent: dom_keyboard_event,
        });
    });
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
    const oo_fs = new LocalStorageFS();

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

    // finalise the init process now our changes are made
    term.initialise(loaded);

    // read the version variable ($VERSION)
    console.log("OllieOS Version:", version);
    term.set_variable("VERSION", version);
}

main();
