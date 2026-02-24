#!/usr/bin/env node

const { LensRunner } = require('../_lens-lib');
const { Repo } = require('hologit');
const vm = require('vm');

LensRunner.run({}, async (runner, inputTree) => {
    // load env/input
    runner.requireEnv('HOLOLENS_TREE_PATCH_SCRIPT');
    const { HOLOLENS_TREE_PATCH_SCRIPT, HOLOLENS_TREE_PATCH_PATH_SCRIPT } = process.env;
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

    // compile scripts
    const patchFunction = vm.runInNewContext(HOLOLENS_TREE_PATCH_SCRIPT);
    const pathFunction = HOLOLENS_TREE_PATCH_PATH_SCRIPT
        ? vm.runInNewContext(HOLOLENS_TREE_PATCH_PATH_SCRIPT)
        : null;

    // iterate input
    const blobs = await tree.getBlobMap();
    for (const blobPath in blobs) {
        const blob = blobs[blobPath];

        // apply path renaming
        let outputPath = blobPath;
        if (pathFunction) {
            try {
                outputPath = pathFunction(blobPath);
            } catch (err) {
                console.error(`Error renaming ${blobPath}: ${err}`);
                process.exit(1);
            }
        }

        // read content and apply patch function
        const content = await blob.read();

        if (outputPath !== blobPath) {
            console.error(`patching ${blobPath} -> ${outputPath}`);
        } else {
            console.error(`patching ${blobPath}`);
        }

        let result;
        try {
            result = patchFunction(content, blobPath);
        } catch (err) {
            console.error(`Error patching ${blobPath}: ${err}`);
            process.exit(1);
        }

        // write result: pass through original blob if content unchanged
        if (result === content) {
            await outputTree.writeChild(outputPath, blob);
        } else {
            await outputTree.writeChild(outputPath, result);
        }
    }

    // write tree and return hash
    return await outputTree.write();
});
