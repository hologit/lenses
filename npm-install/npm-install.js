#!/usr/bin/env node

const { LensRunner } = require('@hologit/lens-lib');

const runner = new LensRunner();

runner.run(async () => {
    const {
        HOLOLENS_NPM_INSTALL_COMMAND = 'npm ci',
        HOLOLENS_NPM_INSTALL_ENV = 'production',
    } = process.env;

    // Set up environment
    runner.overrideEnv({
        CI: 'true',
        NODE_ENV: HOLOLENS_NPM_INSTALL_ENV
    });

    // Execute npm install
    console.error(`\nRunning: ${HOLOLENS_NPM_INSTALL_COMMAND}`);
    await runner.execCommand(
        HOLOLENS_NPM_INSTALL_COMMAND.split(' ')[0],
        HOLOLENS_NPM_INSTALL_COMMAND.split(' ').slice(1)
    );

    // Add node_modules to git index
    await runner.addToIndex('node_modules/');

    // Output tree hash
    return await runner.writeTree();
});
