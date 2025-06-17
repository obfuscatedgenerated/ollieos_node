import readline from "node:readline";
import type { WrappedTerminal } from "ollieos/src/term_ctl";

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

let block_global_keypress = false;

export const setup_keypress_events = (term: WrappedTerminal) => {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    process.stdin.on("keypress", (char: string, key: readline.Key) => {
        if (char === "\u0003") { // Ctrl+C
            // TODO: remove this but fix shutdown
            process.exit(0);
        }

        if (block_global_keypress) {
            return;
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

    // override term.wait_for_keypress to use readline rather than using the xterm disposables
    // TODO: somewhat broken with pasting
    term.wait_for_keypress = async () => {
        return new Promise((resolve) => {
            const key_pressed = (char: string, key: readline.Key) => {
                process.stdin.off("keypress", key_pressed);
                block_global_keypress = false;

                const dom_keyboard_event = make_keyboard_event(char, key);
                resolve({
                    key: char,
                    domEvent: dom_keyboard_event,
                });
            };

            block_global_keypress = true;
            process.stdin.on("keypress", key_pressed);
        });
    };
}
