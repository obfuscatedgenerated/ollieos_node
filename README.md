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

## Updating wrapper

`git pull origin main`

## Updating OS

`npm update ollieos`

## Editing files

The program ships with the `RealFS` filesystem implementation. This means the OS stores files to `ollieos_storage` in the directory you run the program from. You can edit these files directly, and they will be reflected in the OS.

Line endings should be **CRLF** and **will not be converted** to avoid breaking binary files.
