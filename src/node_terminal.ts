import { Terminal } from "@xterm/xterm";
import { AbstractTerminal, type KeyEvent } from "ollieos/src/kernel/term_ctl";
import { notify_mirror_change } from "ollieos/src/kernel/rpc";

/**
 * A terminal that draws to the real one (stdout). An in-memory xterm is written to as well, to keep track of the size and cursor.
 * Keys come in through {@link NodeTerminal.handle_key}.
 */
export class NodeTerminal extends AbstractTerminal {
    readonly #xterm: Terminal;

    #input_enabled = true;
    #input_paused = false;

    // wait_for_keypress pauses normal input and takes the next key directly
    readonly #raw_key_waiters: ((event: KeyEvent) => void)[] = [];

    write(data: string | Uint8Array, callback?: () => void) {
        this.#xterm.write(data);
        process.stdout.write(data);

        if (callback) {
            callback();
        }
    }

    writeln(data: string | Uint8Array, callback?: () => void) {
        this.#xterm.writeln(data);
        process.stdout.write(data);
        process.stdout.write("\n");

        if (callback) {
            callback();
        }
    }

    clear() {
        this.#xterm.clear();
        console.clear();
    }

    reset() {
        this.#xterm.reset();
        console.clear();
    }

    // the real terminal handles selection, copying and pasting itself
    get_selection(): string {
        return "";
    }

    clear_selection() {}

    has_selection(): boolean {
        return false;
    }

    copy() {}

    paste() {}

    focus() {}

    dispose() {
        this.#xterm.dispose();
    }

    get input_enabled() {
        return this.#input_enabled;
    }

    set input_enabled(enabled: boolean) {
        this.#input_enabled = enabled;
    }

    pause_input_processing() {
        this.#input_paused = true;
    }

    resume_input_processing() {
        this.#input_paused = false;
    }

    protected async _read_raw_key(): Promise<KeyEvent> {
        return new Promise((resolve) => {
            this.#raw_key_waiters.push(resolve);
        });
    }

    /**
     * Passes a key from stdin to the terminal.
     */
    handle_key(event: KeyEvent) {
        const raw_key_waiter = this.#raw_key_waiters.shift();
        if (raw_key_waiter) {
            raw_key_waiter(event);
            return;
        }

        if (this.#input_paused || !this.#input_enabled) {
            return;
        }

        this._enqueue_key_event(event);
    }

    resize(cols: number, rows: number) {
        this.#xterm.resize(cols, rows);
        notify_mirror_change(this);
    }

    get cols(): number {
        return this.#xterm.cols;
    }

    get rows(): number {
        return this.#xterm.rows;
    }

    get cursor_x(): number {
        return this.#xterm.buffer.active.cursorX;
    }

    get cursor_y(): number {
        return this.#xterm.buffer.active.cursorY;
    }

    get_custom_flag(_flag: string): unknown {
        return undefined;
    }

    set_custom_flag(_flag: string, _value: unknown) {}

    supports_custom_flag(_flag: string): boolean {
        return false;
    }

    constructor() {
        super();

        this.#xterm = new Terminal();
    }
}
