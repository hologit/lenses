#!/usr/bin/env node

const { LensRunner } = require('@hologit/lens-lib');

const runner = new LensRunner();

runner.run(async () => {
    // Set up environment
    runner.setupEnv({
        CI: 'true',
        NODE_ENV: runner.getEnv('HOLOLENS_NPM_INSTALL_ENV', 'production')
    });

    // Execute npm install
    const installCommand = runner.getEnv('HOLOLENS_NPM_INSTALL_COMMAND', 'npm ci');
    console.error(`\nRunning: ${installCommand}`);
    await runner.execCommand(
        installCommand.split(' ')[0],
        installCommand.split(' ').slice(1)
    );

    // Add node_modules to git index
    await runner.addToIndex('node_modules/');

    // Output tree hash
    return await runner.writeTree();
});
