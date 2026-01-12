import {AbstractFileSystem, NonRecursiveDirectoryError, PathNotFoundError} from "ollieos/src/kernel/filesystem";

import fs from "node:fs";
import nodepath from "node:path";

import { appdata } from "./util";

const root_dir = nodepath.resolve(appdata("ollieos/fs"));
const readonly_list_path = nodepath.resolve(appdata("ollieos/fs_readonly_list.json"));

const resolve_real_path = (in_path: string): string => {
    const stripped_input = in_path.replace(/^[/\\]+/, "")
    const resolved_path = nodepath.resolve(root_dir, stripped_input);

    // traversal if the resolved path does not start with the root directory with separator (or is not the root directory itself without the separator)
    if (!resolved_path.startsWith(root_dir + nodepath.sep) && resolved_path !== root_dir) {
        throw new Error(`Path traversal detected: ${in_path}`);
    }

    return resolved_path;
}

export class RealFS extends AbstractFileSystem {
    _watcher: fs.FSWatcher | null = null;

    get_unique_fs_type_name(): string {
        return "real";
    }

    async is_ready() {
        return true;
    }

    constructor() {
        super();

        // ensure the root directory exists
        if (!fs.existsSync(root_dir)) {
            fs.mkdirSync(root_dir, { recursive: true });
        }

        // ensure the readonly list exists
        if (!fs.existsSync(readonly_list_path)) {
            fs.writeFileSync(readonly_list_path, "[]");
        }

        // set up a watcher so that if any files in the root directory are changed, we clear the cache
        this._watcher = fs.watch(root_dir, { recursive: true }, (_type, filename) => {
            if (filename) {
                const filename_forward_slash = filename.replace(/\\/g, "/");
                const filename_rooted = "/" + filename_forward_slash;

                // TODO: how should line ending conversion be handled? or not at all?

                this.force_remove_from_cache(filename_rooted);
            }
        });
    }

    async erase_all() {
        // stop watcher
        if (this._watcher) {
            this._watcher.close();
            this._watcher = null;
        }

        // delete the fake root directory
        if (fs.existsSync(root_dir)) {
            fs.rmSync(root_dir, { recursive: true, force: true });
        }

        // delete the readonly list
        if (fs.existsSync(readonly_list_path)) {
            fs.rmSync(readonly_list_path, { force: true });
        }
    }

    async delete_dir_direct(path: string, recursive: boolean) {
        const resolved_path = resolve_real_path(path);

        // check exists and is dir
        if (!fs.existsSync(resolved_path) || !fs.lstatSync(resolved_path).isDirectory()) {
            throw new PathNotFoundError(path);
        }

        // if recursive is false but there are directories inside, throw error
        if (!recursive && fs.readdirSync(resolved_path).length > 0) {
            throw new NonRecursiveDirectoryError(path);
        }

        // delete the directory
        fs.rmSync(resolved_path, { recursive, force: true });
    }

    async delete_file_direct(path: string) {
        const resolved_path = resolve_real_path(path);

        // check exists and is file
        if (!fs.existsSync(resolved_path) || !fs.lstatSync(resolved_path).isFile()) {
            throw new PathNotFoundError(path);
        }

        // delete the file
        fs.rmSync(resolved_path, { force: true });
    }

    async dir_exists(path: string) {
        const resolved_path = resolve_real_path(path);
        return fs.existsSync(resolved_path) && fs.lstatSync(resolved_path).isDirectory();
    }

    async exists_direct(path: string) {
        const resolved_path = resolve_real_path(path);
        return fs.existsSync(resolved_path);
    }

    async list_dir(path: string, dirs_first?: boolean) {
        const resolved_path = resolve_real_path(path);

        // check if the path exists and is a directory
        if (!fs.existsSync(resolved_path) || !fs.lstatSync(resolved_path).isDirectory()) {
            throw new PathNotFoundError(path);
        }

        // read the directory contents
        const entries = fs.readdirSync(resolved_path, { withFileTypes: true });

        // filter and sort the entries
        let files = entries.filter(entry => entry.isFile()).map(entry => entry.name);
        let dirs = entries.filter(entry => entry.isDirectory()).map(entry => entry.name);

        if (dirs_first) {
            return [...dirs, ...files];
        } else {
            return [...files, ...dirs];
        }
    }

    async make_dir(path: string) {
        const resolved_path = resolve_real_path(path);

        // check if the directory already exists
        if (fs.existsSync(resolved_path)) {
            return;
        }

        // create the directory
        fs.mkdirSync(resolved_path, { recursive: true });
    }

    async move_dir_direct(src: string, dest: string, move_inside: boolean) {
        // TODO: is this implemented as its meant to be?

        const src_resolved = resolve_real_path(src);
        const dest_resolved = resolve_real_path(dest);

        // check if the source directory exists
        if (!fs.existsSync(src_resolved) || !fs.lstatSync(src_resolved).isDirectory()) {
            throw new PathNotFoundError(src);
        }

        fs.renameSync(src_resolved, dest_resolved);
    }

    async move_file_direct(src: string, new_path: string) {
        const src_resolved = resolve_real_path(src);
        const new_path_resolved = resolve_real_path(new_path);

        // check if the source file exists
        if (!fs.existsSync(src_resolved) || !fs.lstatSync(src_resolved).isFile()) {
            throw new PathNotFoundError(src);
        }

        fs.renameSync(src_resolved, new_path_resolved);
    }

    async read_file_direct(path: string, as_uint: boolean) {
        const resolved_path = resolve_real_path(path);

        // check if the file exists
        if (!fs.existsSync(resolved_path) || !fs.lstatSync(resolved_path).isFile()) {
            throw new PathNotFoundError(path);
        }

        // read the file
        const data = fs.readFileSync(resolved_path);
        return as_uint ? new Uint8Array(data) : data.toString();
    }

    async is_readonly_direct(path: string) {
        const readonly_list = JSON.parse(fs.readFileSync(readonly_list_path, "utf-8")) as string[];
        return readonly_list.includes(path);
    }

    async set_readonly_direct(path: string, readonly: boolean) {
        const readonly_list = JSON.parse(fs.readFileSync(readonly_list_path, "utf-8")) as string[];

        if (readonly) {
            // add to readonly list if not already present
            if (!readonly_list.includes(path)) {
                readonly_list.push(path);
                fs.writeFileSync(readonly_list_path, JSON.stringify(readonly_list, null, 2));
            }
        } else {
            // remove from readonly list if present
            const index = readonly_list.indexOf(path);
            if (index !== -1) {
                readonly_list.splice(index, 1);
                fs.writeFileSync(readonly_list_path, JSON.stringify(readonly_list, null, 2));
            }
        }
    }

    async write_file_direct(path: string, data: string | Uint8Array) {
        const resolved_path = resolve_real_path(path);

        // ensure the directory exists
        const dir = nodepath.dirname(resolved_path);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // write the file
        fs.writeFileSync(resolved_path, data);
    }
}