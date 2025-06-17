globalThis.window = globalThis;
// note that this breaks nodejs detection with typeof window, but we will provide a marker that it is running in node through a global and term variable

import { LocalStorage } from "node-localstorage";
globalThis.localStorage = new LocalStorage("./ollieos_storage/localstorage");

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

globalThis.Image = Image;

globalThis.document = {};
globalThis.document.createElement = (tagName, options) => {
    if (tagName === "canvas") {
        return createCanvas(800, 600);
    }

    console.warn(`Creating element <${tagName}> is not supported in this environment.`);
    return null;
};

import open from "open";
import { URL } from "node:url";

// open urls in browser
globalThis.location = {
    assign(url) {
        if (!(url instanceof URL)) {
            // convert relative paths to urls of ollieg.codes
            url = new URL(url, "https://ollieg.codes/");
        }

        open(url.toString());
    },

    replace(url: string | URL) {
        this.assign(url);
        process.exit(0);
    },

    reload() {
        // TODO: restart the app somehow?
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

globalThis.open = (url: string | URL, target?: string) => {
    location.assign(url);
}
