#!/usr/bin/env node
const program = require('commander')

var currentNodeVersion = process.versions.node;
var semver = currentNodeVersion.split('.');
var major = semver[0];

if (major < 10) {
    console.error(
        'You are running Node ' +
        currentNodeVersion +
        '.\n' +
        'Create SFx App requires Node 10 or higher. \n' +
        'Please update your version of Node.'
    );
    process.exit(1);
}

require('./createSfxApp.js');