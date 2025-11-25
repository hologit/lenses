#!/usr/bin/env node

const { LensRunner } = require('../_lens-lib');
const { loadYaml, dumpYaml } = require('../_lens-lib-k8s');
const { Repo } = require('hologit');

LensRunner.run({}, async (runner, inputTree) => {
    // load env/input
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

    // iterate input
    const blobs = await tree.getBlobMap();
    for (const blobPath in blobs) {
        const blob = blobs[blobPath];

        let objects;

        try {
            objects = loadYaml(await blob.read());
        } catch (err) {
            console.error(`Failed to parse: ${blobPath}\n\n${err}`);
            process.exit(1);
        }

        let objectIndex = 1;
        for (const object of objects) {
            if (!object) {
                // null values indicate empty documents
                continue;
            }

            const { kind, metadata } = object;

            if (!kind) {
                console.error(`Object ${objectIndex} in ${blobPath} is missing property: kind`);
                process.exit(1);
            }

            if (kind == 'ConfigMapList') {
                objects.push(...object.items);
                continue;
            }

            if (!metadata) {
                console.error(`Object ${objectIndex} in ${blobPath} is missing property: metadata`);
                process.exit(1);
            }

            const { name, namespace } = metadata;

            if (!name) {
                console.error(`Object ${objectIndex} in ${blobPath} is missing property: metadata.name`);
                process.exit(1);
            }

            const objectPath = `${namespace || '_'}/${kind}/${name}.yaml`;
            await outputTree.writeChild(objectPath, dumpYaml(object, { sortKeys: true }));
            console.error(`${blobPath}→${objectPath}`);
            objectIndex++;
        }
    }

    // Write tree and return hash
    return await outputTree.write();
});
