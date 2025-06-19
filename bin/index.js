#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);

// determine script based on if passed --no-clear
// yes, we could just run tsx directly here and have it pass the argv, but if we change how npm start works, we'd have to change this too
const script = args.includes("--no-clear") ? "start-no-clear" : "start";

// run npm start in the project root
const child = spawn("npm", ["run", script, ...args.slice(1)], {
    cwd: root,
    stdio: "inherit",
    shell: true,
});

child.on("exit", process.exit);
