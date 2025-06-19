#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);

// run npm start in the project root
const child = spawn("npm", ["run", "start", "--", args], {
    cwd: root,
    stdio: "inherit",
    shell: true,
});

child.on("exit", process.exit);
