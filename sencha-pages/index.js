#!/usr/bin/env node

const { LensRunner } = require('../_lens-lib');

LensRunner.run({ exportTree: true }, async (runner) => {
    console.error('\nCompiling Sencha pages');

    // Run build-pages from the work tree root
    await runner.execCommand('build-pages', [], {
        cwd: process.env.GIT_WORK_TREE
    });

    // Add build output to git index
    await runner.addToIndex('build');

    // Return only the build subtree
    return await runner.writeTree('build');
});
