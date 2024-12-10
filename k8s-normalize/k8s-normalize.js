#!/usr/bin/env node

const { LensRunner } = require('@hologit/lens-lib');
const { K8sManifestHandler, yaml } = require('@hologit/lens-lib-k8s');

const runner = new LensRunner();

runner.run(async () => {
    // Create output directory for normalized manifests
    const outputRoot = 'normalized';
    await runner.createOutputDir(outputRoot);

    // Read and process all yaml files
    const yamlFiles = await runner.captureCommand('find', ['.', '-type', 'f', '-name', '*.yaml', '-o', '-name', '*.yml']);
    const files = yamlFiles.split('\n').filter(Boolean);

    for (const file of files) {
        const content = await runner.readFile(file);
        let objects;

        try {
            objects = yaml.loadAll(content);
        } catch (err) {
            console.error(`Failed to parse: ${file}\n\n${err}`);
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
                console.error(`Object ${objectIndex} in ${file} is missing property: kind`);
                process.exit(1);
            }

            if (kind == 'ConfigMapList') {
                objects.push(...object.items);
                continue;
            }

            if (!metadata) {
                console.error(`Object ${objectIndex} in ${file} is missing property: metadata`);
                process.exit(1);
            }

            const { name, namespace } = metadata;

            if (!name) {
                console.error(`Object ${objectIndex} in ${file} is missing property: metadata.name`);
                process.exit(1);
            }

            // Write normalized manifest
            const objectPath = `${outputRoot}/${namespace || '_'}/${kind}/${name}.yaml`;
            await runner.writeFile(objectPath, yaml.dump(object, { sortKeys: true }));
            console.error(`${file}→${objectPath}`);
            objectIndex++;
        }
    }

    // Add output to git index
    await runner.addToIndex(outputRoot);

    // Output tree hash
    return await runner.writeTree(outputRoot);
});
