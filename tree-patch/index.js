#!/usr/bin/env node

const { LensRunner } = require('../_lens-lib');
const { Repo } = require('hologit');
const vm = require('vm');

LensRunner.run({}, async (runner, inputTree) => {
    // load env/input
    runner.requireEnv('HOLOLENS_TREE_PATCH_SCRIPT');
    const { HOLOLENS_TREE_PATCH_SCRIPT } = process.env;
    const repo = await Repo.getFromEnvironment();
    const tree = await repo.createTreeFromRef(inputTree);

    // init output
    const outputTree = repo.createTree();

    // check env/input
    if (!tree) {
        return outputTree;
    }

    if (!tree.isTree) {
        throw new Error('input must be a tree');
    }

    // compile patch script
    const patchFunction = vm.runInNewContext(HOLOLENS_TREE_PATCH_SCRIPT);

    // iterate input
    const blobs = await tree.getBlobMap();
    for (const blobPath in blobs) {
        const blob = blobs[blobPath];

        // read content and apply patch function
        const content = await blob.read();
        console.error(`patching ${blobPath}`);

        let result;
        try {
            result = patchFunction(content, blobPath);
        } catch (err) {
            console.error(`Error patching ${blobPath}: ${err}`);
            process.exit(1);
        }

        // write result: pass through original blob if content unchanged
        if (result === content) {
            await outputTree.writeChild(blobPath, blob);
        } else {
            await outputTree.writeChild(blobPath, result);
        }
    }

    // write tree and return hash
    return await outputTree.write();
});
