#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { LensRunner } = require('../_lens-lib');
const merge = require('@alexlafroscia/yaml-merge');

LensRunner.run({ exportTree: true }, async (runner) => {
    const {
        HOLOLENS_MKDOCS_VERSION,
        HOLOLENS_MKDOCS_REQUIREMENTS,
        HOLOLENS_MKDOCS_OUTPUT_DIR = 'site',
    } = process.env;

    // Look for mkdocs configuration overrides
    const configOverrides = fs.readdirSync('.')
        .filter(file => file.match(/^mkdocs\..+\.yml$/))
        .sort();

    if (configOverrides.length > 0) {
        console.error(`Merging mkdocs.yml overrides: ${configOverrides.join(' ')}`);

        try {
            // Merge all configuration files
            const mergedConfig = merge(
                path.resolve('mkdocs.yml'),
                ...configOverrides.map(f => path.resolve(f))
            );

            // Write merged configuration
            fs.writeFileSync('mkdocs.yml', mergedConfig);
            console.error('Successfully merged mkdocs.yml');
        } catch (error) {
            console.error('Failed to merge mkdocs.yml:', error.message);
            throw error;
        }
    }

    // Prepare mkdocs package specification
    const mkdocsPackage = HOLOLENS_MKDOCS_VERSION
        ? `mkdocs==${HOLOLENS_MKDOCS_VERSION}`
        : 'mkdocs';

    console.error('\nExecuting pip and mkdocs in a subshell');

    // Unset git environment variables before running Python/pip
    const cleanEnv = { ...process.env };
    delete cleanEnv.GIT_DIR;
    delete cleanEnv.GIT_WORK_TREE;
    delete cleanEnv.GIT_INDEX_FILE;

    // Create virtual environment
    console.error('Creating Python virtual environment');
    await runner.execCommand('python3', ['-m', 'venv', './.venv'], { env: cleanEnv });

    // Upgrade pip
    console.error('Upgrading pip');
    await runner.execCommand('./.venv/bin/pip', ['install', '--upgrade', 'pip'], { env: cleanEnv });

    // Install mkdocs and requirements
    if (HOLOLENS_MKDOCS_REQUIREMENTS) {
        // Install from comma-separated list
        const packages = [mkdocsPackage, ...HOLOLENS_MKDOCS_REQUIREMENTS.split(',').map(p => p.trim())];
        console.error(`Installing packages: ${packages.join(' ')}`);
        await runner.execCommand('./.venv/bin/pip', ['install', ...packages], { env: cleanEnv });
    } else if (fs.existsSync('requirements.txt')) {
        // Install from requirements.txt
        console.error('Installing from requirements.txt');
        await runner.execCommand('./.venv/bin/pip', ['install', '-r', 'requirements.txt'], { env: cleanEnv });
    } else {
        // Install just mkdocs
        console.error(`Installing ${mkdocsPackage}`);
        await runner.execCommand('./.venv/bin/pip', ['install', mkdocsPackage], { env: cleanEnv });
    }

    // Build the documentation site
    console.error('\nRunning mkdocs build');
    await runner.execCommand('./.venv/bin/mkdocs', ['build'], { env: cleanEnv });

    console.error('\nmkdocs build completed successfully');

    // Add output to git index
    await runner.addToIndex(HOLOLENS_MKDOCS_OUTPUT_DIR);

    // Output tree hash
    return await runner.writeTree(HOLOLENS_MKDOCS_OUTPUT_DIR);
});
