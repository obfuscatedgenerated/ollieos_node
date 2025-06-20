# OllieOS on Node.js

A terminal-based port of [OllieOS](https://github.com/obfuscatedgenerated/obfuscatedgenerated.github.io), running via a Node.js wrapper.

## Goals

- Provide a near-complete terminal version of the OllieOS website.
- Enable package testing and development within the environment.
- Integrate with the [real filesystem for seamless editing.](#editing-files)
- Polyfill browser features using Node.js, without full DOM emulation.

---

## Installation

```bash
git clone https://github.com/obfuscatedgenerated/ollieos_node.git
cd ollieos_node
npm install
```

## Running

Start the OS:

```bash
npm start
```

For best results, use a modern terminal with support for ANSI escape codes and Sixel graphics (e.g. Windows Terminal).

To start without clearing the terminal (useful for debugging):

```bash
npm run start:no-clear
```

---

## Node-Specific Programs

The Node.js wrapper provides additional utilities available within the OS:

- `appdata` – Opens the [app data directory](#editing-files).
- `update` – [Updates OllieOS](#updating-only-the-os) to the latest version (not the wrapper).

---

## Adding `ollieos` to Your PATH

Use `npm link` to make `ollieos` globally available:

```bash
npm link
```

Now you can run it from anywhere:

```bash
ollieos
```

Pass `--no-clear` to skip terminal clearing:

```bash
ollieos --no-clear
```

To remove the global link:

```bash
npm rm --global ollieos_node
```

---

## Updating

To update both the wrapper and OS:

```bash
git pull origin main
npm install
```

### Updating Only the OS

```bash
npm update ollieos
```

Or use the `update` program built into the OS and restart.

---

## Editing Files

OllieOS ships with the `RealFS` filesystem implementation. Files are stored in your real OS's app data directory:

- **Windows**: `%APPDATA%/ollieos`
- **macOS**: `~/Library/Application Support/ollieos`
- **Linux**: `~/.config/ollieos`

To open the `fs` directory in your file explorer from within OllieOS, use the `appdata` program.

You can directly edit these files, and changes will reflect in OllieOS.

**Note:** Files should use **CRLF** line endings. No conversion is done to avoid corrupting binary files.
