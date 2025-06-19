#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");

// run npm start in the project root
const child = spawn("npm", ["start", ...process.argv.slice(2)], {
    cwd: root,
    stdio: "inherit",
    shell: true,
});

child.on("exit", process.exit);
