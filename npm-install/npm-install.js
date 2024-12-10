#!/usr/bin/env node

const { execFile } = require('child_process');

// Configuration from environment variables
const {
    GIT_WORK_TREE,
    HOLOLENS_NPM_INSTALL_COMMAND = 'npm ci',
    HOLOLENS_NPM_INSTALL_ENV = 'production'
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

        // Set up environment
        process.env.CI = 'true';
        process.env.NODE_ENV = HOLOLENS_NPM_INSTALL_ENV;

        // Run from Git work tree
        process.chdir(GIT_WORK_TREE);

        // Export git tree
        console.error(`Exporting input tree to scratch directory: ${inputTree}`);
        await execCommand('git', ['holo', 'lens', 'export-tree', inputTree]);

        // Execute npm install
        console.error(`\nRunning: ${HOLOLENS_NPM_INSTALL_COMMAND}`);
        await execCommand(HOLOLENS_NPM_INSTALL_COMMAND.split(' ')[0], HOLOLENS_NPM_INSTALL_COMMAND.split(' ').slice(1));

        // Add node_modules to git index
        await execCommand('git', ['add', '-f', 'node_modules/']);

        // Output tree hash
        const treeHash = await captureCommand('git', ['write-tree']);
        process.stdout.write(treeHash);

    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
