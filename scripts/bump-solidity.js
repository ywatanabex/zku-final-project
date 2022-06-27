const fs = require("fs");
const solidityRegex = /pragma solidity \^\d+\.\d+\.\d+/
const files = fs.readdirSync('./contracts').filter(fn => fn.match(/.*\.sol/));

for (let fn of files) {
    console.log(`Overwriting Solidity version of ./contracts/${fn} to ^0.8.0`);
    let content = fs.readFileSync(`./contracts/${fn}`, { encoding: 'utf-8' });
    let bumped = content.replace(solidityRegex, 'pragma solidity ^0.8.0');
    fs.writeFileSync(`./contracts/${fn}`, bumped);
}

