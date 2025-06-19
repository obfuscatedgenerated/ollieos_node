# OllieOS on Node.js

A port of my website, OllieOS to a real terminal environment via a Node.js wrapper.

Aims:
- Provide an almost complete port of the OllieOS website to a terminal environment.
- Have it be suitable for package testing and development.
- Interface with the real filesystem for easy editing.
- Polyfill browser features with Node.js equivalents, whilst avoiding full DOM emulation.

(WIP)

## Installing

```
git clone https://github.com/obfuscatedgenerated/ollieos_node.git
cd ollieos_node
npm i
```

## Running

`npm start`

For best results, use a modern terminal with support for a variety of ANSI escape codes and Sixel graphics, such as Windows Terminal.

You can also run `npm run start -- -- --no-clear` to disable the initial terminal clear, which may be useful for debugging.

## Node specific programs

The following additional programs are provided by the wrapper and registered in the OS:
- `appdata`: Opens the [app data directory.](#editing-files)
- `update`: [Updates the OS](#updating-only-os) to the latest version (not the wrapper).

## Adding OllieOS to your PATH

`npm link`

This uses a symlink, so updates to the cloned repository will be reflected in the global command.

The OS can now be run from anywhere by typing `ollieos` in your terminal. You can pass `--no-clear` to disable the initial terminal clear.

You can remove this link with:

`npm rm --global ollieos_node`

## Updating wrapper (and OS)

```
git pull origin main
npm i
```

## Updating only OS

`npm update ollieos`

## Editing files

The program ships with the `RealFS` filesystem implementation. 

The OS stores files in your app data directory:

- Windows: `%appdata%/ollieos`
- Mac OS: `~/Library/Application Support/ollieos`
- Linux: `~/.config/ollieos`

You can access the fs directory easily by running `appdata` in the OllieOS terminal.

You can edit these files directly, and they will be reflected in the OS.

Line endings should be **CRLF** and **will not be converted** to avoid breaking binary files.
