import nodepath from "path";

// thanks https://stackoverflow.com/a/26227660/19678893
export const appdata_root = process.env.APPDATA || (process.platform == "darwin" ? process.env.HOME + "/Library/Application Support" : process.env.HOME + "/.config");

// returns the path relative to the appdata root directory
export const appdata = (path: string): string => {
    return nodepath.join(appdata_root, path);
}
