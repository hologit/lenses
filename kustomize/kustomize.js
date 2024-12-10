#!/usr/bin/env node

const fs = require('fs');
const { LensRunner } = require('@hologit/lens-lib');
const { generateNamespaceManifest, patchNamespaces } = require('@hologit/lens-lib-k8s');

LensRunner.run({ exportTree: true }, async (runner) => {
    const {
        HOLOLENS_KUSTOMIZE_OUTPUT_ROOT = 'output',
        HOLOLENS_KUSTOMIZE_OUTPUT_FILENAME = 'manifest.yaml',
        HOLOLENS_KUSTOMIZE_DIRECTORY = '.',
        HOLOLENS_KUSTOMIZE_NAMESPACE,
        HOLOLENS_KUSTOMIZE_NAMESPACE_FILL,
        HOLOLENS_KUSTOMIZE_NAMESPACE_OVERRIDE,
    } = process.env;

    const outputPath = `${HOLOLENS_KUSTOMIZE_OUTPUT_ROOT}/${HOLOLENS_KUSTOMIZE_OUTPUT_FILENAME}`;

    // Create output directory
    fs.mkdirSync(HOLOLENS_KUSTOMIZE_OUTPUT_ROOT, { recursive: true });

    // Execute kustomize build
    const kustomizeOutput = await runner.captureCommand('kustomize', ['build', HOLOLENS_KUSTOMIZE_DIRECTORY]);

    // Write manifest with optional namespace doc
    const namespaceDoc = generateNamespaceManifest(HOLOLENS_KUSTOMIZE_NAMESPACE);
    fs.writeFileSync(outputPath, namespaceDoc + kustomizeOutput);

    // Patch namespaces if needed
    if (HOLOLENS_KUSTOMIZE_NAMESPACE_FILL === 'true' ||
        HOLOLENS_KUSTOMIZE_NAMESPACE_OVERRIDE === 'true') {
        await patchNamespaces(outputPath, {
            namespace: HOLOLENS_KUSTOMIZE_NAMESPACE,
            fill: HOLOLENS_KUSTOMIZE_NAMESPACE_FILL === 'true',
            override: HOLOLENS_KUSTOMIZE_NAMESPACE_OVERRIDE === 'true'
        });
    }

    // Add output to git index
    await runner.addToIndex(outputPath);

    // Output tree hash
    return await runner.writeTree(HOLOLENS_KUSTOMIZE_OUTPUT_ROOT);
});
