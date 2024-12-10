#!/usr/bin/env node

const { LensRunner } = require('@hologit/lens-lib');

const runner = new LensRunner();

runner.run(async () => {
    // Validate required environment variables
    runner.requireEnv('HOLOLENS_NPM_RUN_COMMAND');

    // Set up environment
    runner.setupEnv({
        CI: 'true',
        NODE_ENV: runner.getEnv('HOLOLENS_NPM_RUN_ENV', 'production')
    });

    // Execute npm install
    const installCommand = runner.getEnv('HOLOLENS_NPM_RUN_INSTALL', 'npm ci');
    console.error(`\nRunning: ${installCommand}`);
    await runner.execCommand(
        installCommand.split(' ')[0],
        installCommand.split(' ').slice(1)
    );

    // Execute configured command
    const runCommand = runner.getEnv('HOLOLENS_NPM_RUN_COMMAND');
    console.error(`\nRunning: npm run ${runCommand}`);
    const commandOutput = await runner.captureCommand('npm', ['run', '--silent', runCommand]);
    console.error(`\n${runCommand} completed successfully`);

    // Handle output directory if specified
    const outputDir = runner.getEnv('HOLOLENS_NPM_RUN_OUTPUT_DIR');
    if (outputDir) {
        await runner.addToIndex(outputDir);
        return await runner.writeTree('--prefix=' + outputDir);
    }

    // Otherwise return command output
    return commandOutput;
});
