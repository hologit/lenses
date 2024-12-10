#!/usr/bin/env node

const fs = require('fs');
const { LensRunner } = require('@hologit/lens-lib');
const { K8sManifestHandler } = require('@hologit/lens-lib-k8s');

const runner = new LensRunner();
const k8s = new K8sManifestHandler(runner);

runner.run(async () => {
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
    const namespaceDoc = k8s.generateNamespaceManifest(HOLOLENS_KUSTOMIZE_NAMESPACE);
    fs.writeFileSync(outputPath, namespaceDoc + kustomizeOutput);

    // Patch namespaces if needed
    if (HOLOLENS_KUSTOMIZE_NAMESPACE_FILL === 'true' ||
        HOLOLENS_KUSTOMIZE_NAMESPACE_OVERRIDE === 'true') {
        await k8s.patchNamespaces(outputPath, {
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
