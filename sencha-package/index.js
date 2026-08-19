#!/usr/bin/env node

const path = require('path');
const { LensRunner } = require('../_lens-lib');

LensRunner.run({ exportTree: true }, async (runner, inputTree) => {
    // Validate required env (config key [hololens.sencha] pkg → HOLOLENS_SENCHA_PKG)
    runner.requireEnv('HOLOLENS_SENCHA_PKG');
    const senchaPkg = process.env.HOLOLENS_SENCHA_PKG;
    const senchaWorkspace = process.env.HOLOLENS_SENCHA_WORKSPACE || '.';
    const pkgPath = path.join(senchaWorkspace, 'packages', senchaPkg);

    // Validate the package subtree exists in the input tree
    try {
        const type = (await runner.captureCommand('git', ['cat-file', '-t', `${inputTree}:${pkgPath}`])).trim();
        if (type !== 'tree') throw new Error('not a tree');
    } catch (e) {
        throw new Error(`hololens.sencha.pkg '${senchaPkg}' does not match packages/${senchaPkg} under the workspace in the input tree`);
    }

    const workTree = process.env.GIT_WORK_TREE;
    const pkgDir = path.join(workTree, pkgPath);

    // Build the package with Sencha CMD (mirrors the habitat lens: `sencha ant build`)
    console.error(`\nBuilding Sencha package ${senchaPkg}`);
    await runner.execCommand('sencha', ['ant', 'build'], { cwd: pkgDir });

    // Add the build output and return only its subtree
    const buildPath = path.join(pkgPath, 'build');
    await runner.addToIndex(buildPath);
    return await runner.writeTree(buildPath.replace(/^\.\//, ''));
});
