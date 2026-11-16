import fs from "node:fs";
import Module from "node:module";
import { appdata } from "./util";

// the os bundler imports some files as raw text with a ?raw query (e.g. xterm's css for windowed terminals), which node would otherwise try to run as code
const original_load = (Module as any)._load;
(Module as any)._load = function (request: unknown, parent: NodeJS.Module, is_main: boolean) {
    if (typeof request === "string" && request.endsWith("?raw")) {
        const file_path = (Module as any)._resolveFilename(request.slice(0, -"?raw".length), parent, is_main);
        return fs.readFileSync(file_path, "utf8");
    }

    return original_load.apply(this, arguments);
};

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

import { DOMParser } from "linkedom";
(globalThis as any).DOMParser = DOMParser;

// opening urls goes through the platform api now, but a few builtins (legacy, recovery) and the kernel's reboot still use location directly
let open_url: ((url: string) => Promise<void>) | null = null;

export const set_location_url_opener = (opener: (url: string) => Promise<void>) => {
    open_url = opener;
};

(globalThis as any).location = {
    assign(url: string | URL) {
        if (!open_url) {
            console.warn("Can't open URLs before the platform API is ready.");
            return;
        }

        // relative paths are relative to the website
        open_url(new URL(url, "https://ollieg.codes/").toString());
    },

    reload() {
        // TODO: restart the app somehow?
        console.warn("Reload not supported, please run the program again to continue.");
        process.exit(0);
    },
};
