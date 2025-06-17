globalThis.window = globalThis;
// note that this breaks nodejs detection with typeof window, but we will provide a marker that it is running in node through a global and term variable

import { LocalStorage } from "node-localstorage";
globalThis.localStorage = new LocalStorage("./ollieos_storage/localstorage");

import { Image, createCanvas } from "canvas";
globalThis.Image = Image;

globalThis.document = {};
globalThis.document.createElement = (tagName, options) => {
    if (tagName === "canvas") {
        return createCanvas(800, 600);
    }

    console.warn(`Creating element <${tagName}> is not supported in this environment.`);
    return null;
};
