import { appdata } from "./util";

(globalThis as any).window = globalThis;
// note that this breaks nodejs detection with typeof window, but we will provide a marker that it is running in node through a global and term variable

import { LocalStorage } from "node-localstorage";
globalThis.localStorage = new LocalStorage(appdata("ollieos/localstorage"));

import { Image, createCanvas } from "canvas";
import { resolveObjectURL } from "node:buffer";

// redefine src property setter to fix blobs into data urls (nodedata blob object urls don't work properly with Image.src)
const old_image_src_prop = Object.getOwnPropertyDescriptor(Image.prototype, "src")!;
Object.defineProperty(Image.prototype, "src", {
    set(value) {
        // if the value is a blob url, convert it to a data URL
        if (typeof value === "string" && value.startsWith("blob:")) {
            const blob = resolveObjectURL(value);

            if (blob) {
                // convert blob to base 64 with buffers and infer type
                blob.arrayBuffer().then((buffer) => {
                    const b64 = Buffer.from(buffer).toString("base64");
                    const mime = blob.type || "application/octet-stream";

                    const data_url = `data:${mime};base64,${b64}`;
                    old_image_src_prop.set!.call(this, data_url);
                });
            } else {
                throw new Error(`Failed to resolve blob URL: ${value}`);
            }
        } else {
            // otherwise, just set the src as is
            old_image_src_prop.set!.call(this, value);
        }
    },
    get: old_image_src_prop.get,
    configurable: true,
});

(globalThis as any).Image = Image;

(globalThis as any).document = {};
(globalThis as any).document.createElement = (tagName: string, options: any) => {
    if (tagName === "canvas") {
        return createCanvas(800, 600);
    }

    console.warn(`Creating element <${tagName}> is not supported in this environment.`);
    return null;
};

import open_path from "open";
import { URL } from "node:url";

let await_this_before_close: Promise<{on: (event: string, callback: (value: unknown) => void) => void}> | null = null;
export const wait_for_safe_close = async () => {
    if (await_this_before_close) {
        const child_process = await await_this_before_close;

        // set a timeout to ensure we don't wait forever
        // since we don't know what they're trying to open, it may not act as expected
        setTimeout(() => {
            if (await_this_before_close) {
                console.warn("Timed out waiting for child process to close its pipes.");
                await_this_before_close = null;
            }
        }, 5000);

        // wait for the child process to close its pipes
        // this hack primarily solves windows issues but i have no idea how it behaves on other platforms (please raise an issue if it gets stuck!)
        await new Promise((resolve) => {
            child_process.on("close", resolve);
        });

        await_this_before_close = null;
    }
}

// open urls in browser
(globalThis as any).location = {
    assign(url: string | URL) {
        if (!(url instanceof URL)) {
            // convert relative paths to urls of ollieg.codes
            url = new URL(url, "https://ollieg.codes/");
        }

        // this is a hack to ensure we actually open the applications requested before stopping the os
        // e.g. it fixes echo "repo" | ollieos
        // this would be so much simpler if location.assign was async... sigh
        await_this_before_close = open_path(url.toString());
    },

    replace(url: string | URL) {
        this.assign(url);
        process.exit(0);
    },

    reload() {
        // TODO: restart the app somehow?
        console.warn("Reload not supported, please run the program again to continue.");
        process.exit(0);
    }
}

Object.defineProperty(globalThis.location, "href", {
    get() {
        return "https://ollieg.codes";
    },
    set(value) {
        location.assign(value);
    }
});

globalThis.close = () => { process.exit(0); };

(globalThis as any).open = (url: string | URL, target?: string) => {
    location.assign(url);
}

import { DOMParser } from "linkedom";
(globalThis as any).DOMParser = DOMParser;
