#!/usr/bin/env node

const { LensRunner } = require('../_lens-lib');

// Container port of the habitat holo/lens-composer-install package: runs
// `composer install` against the exported input tree and returns the input
// tree plus the resulting vendor/ directory.
LensRunner.run({ exportTree: true }, async (runner) => {
    const {
        // [hololens.composer] args = [...] arrives comma-joined; plain
        // space-separated strings are accepted too
        HOLOLENS_COMPOSER_ARGS = '',
    } = process.env;

    const args = [
        'install',
        ...HOLOLENS_COMPOSER_ARGS.split(/[,\s]+/).filter(Boolean),
        // fixed flags carried over unchanged from the habitat lens
        '--no-interaction',
        '--ignore-platform-reqs',
        '--no-plugins',
        '--no-scripts',
        '--prefer-dist',
        '--no-progress',
    ];

    // Keep the lens repo's git environment away from composer: a dist that
    // falls back to a source (git clone) install must not write into /repo
    const composerEnv = {
        GIT_DIR: undefined,
        GIT_WORK_TREE: undefined,
        GIT_INDEX_FILE: undefined,
        COMPOSER_HOME: '/tmp/composer',
        COMPOSER_NO_INTERACTION: '1',
        COMPOSER_ALLOW_SUPERUSER: '1',
    };

    console.error(`\nRunning: composer ${args.join(' ')}`);
    await runner.execCommand('composer', args, { env: composerEnv });
    console.error('\ncomposer completed successfully');

    // Add vendor/ to git index
    await runner.addToIndex('vendor');

    // Output tree hash
    return await runner.writeTree();
});
