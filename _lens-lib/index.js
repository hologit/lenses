const { execFile } = require('child_process');

class LensRunner {
    constructor(options = {}) {
        this.workTree = process.env.GIT_WORK_TREE;
        this.options = options;
    }

    // Execute command and optionally capture output
    async execCommand(cmd, args = [], options = {}) {
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

    // Execute command and capture output
    async captureCommand(cmd, args = [], options = {}) {
        return this.execCommand(cmd, args, { ...options, $captureOutput: true });
    }

    // Export git tree
    async exportTree(treeHash) {
        console.error(`Exporting tree to scratch directory: ${treeHash}`);
        await this.execCommand('git', ['holo', 'lens', 'export-tree', treeHash]);
    }

    // Add files to git index
    async addToIndex(path, force = true) {
        const args = ['add'];
        if (force) args.push('-f');
        args.push(path);
        await this.execCommand('git', args);
    }

    // Write tree and get hash
    async writeTree(prefix) {
        const args = ['write-tree'];
        if (prefix) args.push('--prefix=' + prefix);
        return await this.captureCommand('git', args);
    }

    // Log environment variables starting with HOLO
    logHoloEnv() {
        Object.entries(process.env)
            .filter(([key]) => key.startsWith('HOLO'))
            .forEach(([key, value]) => console.error(`${key}=${value}`));
    }

    // Helper to override environment variables
    overrideEnv(envVars) {
        Object.entries(envVars).forEach(([key, value]) => {
            if (value !== undefined) {
                process.env[key] = value;
            }
        });
    }

    // Helper to ensure required environment variables exist
    requireEnv(...vars) {
        vars.forEach(varName => {
            if (!process.env[varName]) {
                throw new Error(`${varName} environment variable is required`);
            }
        });
    }

    // Run the lens with common setup and error handling
    static async run({ exportTree = false } = {}, callback) {
        const runner = new LensRunner();

        try {
            const inputTree = process.argv[2];
            if (!inputTree) {
                throw new Error('Input tree argument required');
            }

            // Log HOLO environment variables
            runner.logHoloEnv();

            // Change to work tree directory
            process.chdir(runner.workTree);

            // Export git tree if needed
            if (exportTree) {
                await runner.exportTree(inputTree);
            }

            // Run the lens-specific logic
            const result = await callback(runner, inputTree);

            // Output result
            if (typeof result === 'string') {
                process.stdout.write(result);
            }

        } catch (error) {
            console.error(error);
            process.exit(1);
        }
    }
}

module.exports = {
    LensRunner
};
