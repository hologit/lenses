#!/usr/bin/env node

const { LensRunner } = require('@hologit/lens-lib');

LensRunner.run({ exportTree: true }, async (runner) => {
    const {
        HOLOLENS_NPM_RUN_INSTALL = 'npm ci',
        HOLOLENS_NPM_RUN_ENV = 'production',
        HOLOLENS_NPM_RUN_OUTPUT_DIR,
    } = process.env;

    // Validate required environment variables
    runner.requireEnv('HOLOLENS_NPM_RUN_COMMAND');
    const { HOLOLENS_NPM_RUN_COMMAND } = process.env;

    // Set up environment
    runner.overrideEnv({
        CI: 'true',
        NODE_ENV: HOLOLENS_NPM_RUN_ENV
    });

    // Execute npm install
    console.error(`\nRunning: ${HOLOLENS_NPM_RUN_INSTALL}`);
    await runner.execCommand(
        HOLOLENS_NPM_RUN_INSTALL.split(' ')[0],
        HOLOLENS_NPM_RUN_INSTALL.split(' ').slice(1)
    );

    // Execute configured command
    console.error(`\nRunning: npm run ${HOLOLENS_NPM_RUN_COMMAND}`);
    const commandOutput = await runner.captureCommand('npm', ['run', '--silent', HOLOLENS_NPM_RUN_COMMAND]);
    console.error(`\n${HOLOLENS_NPM_RUN_COMMAND} completed successfully`);

    // Handle output directory if specified
    if (HOLOLENS_NPM_RUN_OUTPUT_DIR) {
        await runner.addToIndex(HOLOLENS_NPM_RUN_OUTPUT_DIR);
        return await runner.writeTree('--prefix=' + HOLOLENS_NPM_RUN_OUTPUT_DIR);
    }

    // Otherwise return command output
    return commandOutput;
});
