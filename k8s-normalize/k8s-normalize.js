#!/usr/bin/env node

const { Repo } = require('hologit');
const yaml = require('js-yaml');


outputResult(lensTree(process.argv[2]));

async function lensTree(treeHash) {

    // load env/input
    const repo = await Repo.getFromEnvironment();
    const tree = await repo.createTreeFromRef(treeHash);


    // init output
    const outputTree = repo.createTree();


    // check env/input
    if (!tree) {
        return outputTree;
    }

    if (!tree.isTree) {
        throw new Error('input must be a tree');
    }


    // configure js-yaml dump options
    const yamlDumpOptions = {
        sortKeys: true // could be a function to sort apiVersion, kind, metadata, spec, ...
    };


    // iterate input
    const blobs = await tree.getBlobMap();
    for (const blobPath in blobs) {
        const blob = blobs[blobPath];

        let objects;

        try {
            objects = yaml.safeLoadAll(await blob.read());
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
            await outputTree.writeChild(objectPath, yaml.safeDump(object, yamlDumpOptions))
            console.error(`${blobPath}→${objectPath}`);
            objectIndex++;
        }
    }


    return outputTree;
}


async function outputResult(result) {
    result = await result;

    if (result.isTree) {
        console.log(await result.write());
        process.exit(0);
        return;
    }

    console.error('no result');
    process.exit(1);
}
