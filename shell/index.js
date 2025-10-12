#!/usr/bin/env node

const { LensRunner } = require('../_lens-lib');

LensRunner.run({ exportTree: true }, async (runner) => {
    // Validate required environment variable
    runner.requireEnv('HOLOLENS_SHELL_SCRIPT');
    const { HOLOLENS_SHELL_SCRIPT } = process.env;

    // Execute shell script
    console.error('\nRunning shell script');
    await runner.execCommand('bash', ['-c', HOLOLENS_SHELL_SCRIPT]);

    console.error('\nShell script completed successfully');

    // Add all files to git index
    await runner.addToIndex('.');

    // Return tree hash
    return await runner.writeTree();
});
