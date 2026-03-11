#!/usr/bin/env node

const { LensRunner } = require('../_lens-lib');

LensRunner.run({ exportTree: true }, async (runner) => {
    console.error('\nCompiling SASS with Compass');

    // Run compass compile from the sass/ directory (matches original lens behavior)
    await runner.execCommand('compass', ['compile'], {
        cwd: `${process.env.GIT_WORK_TREE}/sass`
    });

    // Add compiled CSS to git index
    await runner.addToIndex('css');

    // Return only the css subtree
    return await runner.writeTree('css');
});
