#!/usr/bin/env node

const { execFile } = require('child_process');

// Configuration from environment variables
const {
    GIT_WORK_TREE,
    HOLOLENS_DATA,
    HOLOLENS_NPM_RUN_COMMAND,
    HOLOLENS_NPM_RUN_INSTALL = 'npm ci',
    HOLOLENS_NPM_RUN_ENV = 'production',
    HOLOLENS_NPM_RUN_OUTPUT_DIR
} = process.env;

function captureCommand(cmd, args = [], options = {}) {
    return execCommand(cmd, args, { ...options, $captureOutput: true});
}

function execCommand(cmd, args = [], options = {}) {
    console.error(`executing: ${cmd} ${args.join(' ')}`);

    return new Promise((resolve, reject) => {
        const child = execFile(cmd, args, {
            ...options,
            env: {
                ...process.env,
                ...options.env
            }
        });
        let stdout = '';

        child.stdout.on('data', (data) => {
            if (options.$captureOutput) {
                stdout += data;
            } else {
                console.error('::'+data.toString().trimEnd().replace(/\n/, '::\n'));
            }
        });

        child.stderr.on('data', (data) => {
            console.error('::'+data.toString().trimEnd().replace(/\n/, '::\n'));
        });

        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) {
                resolve(options.$captureOutput ? stdout : null);
            } else {
                reject(new Error(`Command failed with code ${code}`));
            }
        });
    });
}

async function main() {
    try {
        const inputTree = process.argv[2];
        if (!inputTree) {
            throw new Error('Input tree argument required');
        }

        // Log HOLO environment variables
        Object.entries(process.env)
            .filter(([key]) => key.startsWith('HOLO'))
            .forEach(([key, value]) => console.error(`${key}=${value}`));

        // Validate required environment variables
        if (!HOLOLENS_NPM_RUN_COMMAND) {
            throw new Error('HOLOLENS_NPM_RUN_COMMAND environment variable is required');
        }

        // Set up environment
        process.env.CI = 'true';
        process.env.NODE_ENV = HOLOLENS_NPM_RUN_ENV;

        // Run from Git work tree
        process.chdir(GIT_WORK_TREE);

        // Export git tree
        const dataTree = HOLOLENS_DATA || inputTree;
        console.error(`Exporting data tree to scratch directory: ${dataTree}`);
        await execCommand('git', ['holo', 'lens', 'export-tree', dataTree]);

        // Execute npm install
        console.error(`\nRunning: ${HOLOLENS_NPM_RUN_INSTALL}`);
        await execCommand(HOLOLENS_NPM_RUN_INSTALL.split(' ')[0], HOLOLENS_NPM_RUN_INSTALL.split(' ').slice(1));

        // Execute configured command
        console.error(`\nRunning: npm run ${HOLOLENS_NPM_RUN_COMMAND}`);
        const commandOutput = await captureCommand('npm', ['run', '--silent', HOLOLENS_NPM_RUN_COMMAND]);
        console.error(`\n${HOLOLENS_NPM_RUN_COMMAND} completed successfully`);

        // Add output to git index if OUTPUT_DIR is declared
        if (HOLOLENS_NPM_RUN_OUTPUT_DIR) {
            await execCommand('git', ['add', '-f', HOLOLENS_NPM_RUN_OUTPUT_DIR]);

            // Output tree hash for output directory
            const treeHash = await captureCommand('git', ['write-tree', '--prefix=' + HOLOLENS_NPM_RUN_OUTPUT_DIR]);
            process.stdout.write(treeHash);
        } else {
            // Output command result directly
            process.stdout.write(commandOutput);
        }

    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
