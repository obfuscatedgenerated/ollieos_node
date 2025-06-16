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
