#!/usr/bin/env node

const { LensRunner } = require('../_lens-lib');
const { loadYaml, dumpYaml } = require('../_lens-lib-k8s');
const { Repo } = require('hologit');
const vm = require('vm');

LensRunner.run({}, async (runner, inputTree) => {
    // load env/input
    runner.requireEnv('HOLOLENS_K8S_PATCH_SCRIPT');
    const { HOLOLENS_K8S_PATCH_SCRIPT } = process.env;
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
    const patchFunction = vm.runInNewContext(HOLOLENS_K8S_PATCH_SCRIPT);

    // iterate input
    const blobs = await tree.getBlobMap();
    for (const blobPath in blobs) {
        const blob = blobs[blobPath];

        // skip non-YAML files
        if (!blobPath.endsWith('.yaml') && !blobPath.endsWith('.yml')) {
            await outputTree.writeChild(blobPath, blob);
            continue;
        }

        let objects;

        try {
            objects = loadYaml(await blob.read());
        } catch (err) {
            console.error(`Failed to parse: ${blobPath}\n\n${err}`);
            process.exit(1);
        }

        // patch objects
        console.error(`patching objects in ${blobPath}`);
        for (const object of objects) {
            // null values indicate empty documents
            if (!object) {
                continue;
            }

            if (object.kind == 'ConfigMapList') {
                objects.push(...object.items);
                continue;
            }

            if (!object.metadata) {
                throw new Error('encountered object with no metadata');
            }

            const { kind, metadata: { name, namespace } } = object;

            if (!name) {
                throw new Error('encountered object with no name');
            }

            // apply patch script
            console.error(`patching object ${namespace || '_'}/${kind}/${name}`);
            patchFunction(object);
        }

        // write patched YAML back
        const patchedYaml = objects
            .map(object => dumpYaml(object))
            .join('\n---\n\n');

        await outputTree.writeChild(blobPath, patchedYaml);
    }

    // Write tree and return hash
    return await outputTree.write();
});
