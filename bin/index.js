#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);

// run npm start in the project root
// use silent mode to suppress the > lines (to avoid breaking pipes and it looks neater)
// and pass through the args to the script
// escape the arguments to stop node whining
const command = `npm run start --silent -- ${args.map(a => `"${a}"`).join(" ")}`;
const child = spawn(command, {
    cwd: root,
    stdio: "inherit",
    shell: true,
});

child.on("exit", process.exit);
