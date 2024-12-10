#!/usr/bin/env node

const { LensRunner } = require('@hologit/lens-lib');
const { K8sManifestHandler } = require('@hologit/lens-lib-k8s');

const runner = new LensRunner();
const k8s = new K8sManifestHandler(runner);

runner.run(async () => {
    const outputRoot = runner.getEnv('HOLOLENS_KUSTOMIZE_OUTPUT_ROOT', 'output');
    const outputFilename = runner.getEnv('HOLOLENS_KUSTOMIZE_OUTPUT_FILENAME', 'manifest.yaml');
    const outputPath = `${outputRoot}/${outputFilename}`;
    const kustomizeDir = runner.getEnv('HOLOLENS_KUSTOMIZE_DIRECTORY', '.');
    const namespace = runner.getEnv('HOLOLENS_KUSTOMIZE_NAMESPACE');

    // Create output directory
    await runner.createOutputDir(outputRoot);

    // Execute kustomize build
    const kustomizeOutput = await runner.captureCommand('kustomize', ['build', kustomizeDir]);

    // Write manifest with optional namespace doc
    const namespaceDoc = k8s.generateNamespaceManifest(namespace);
    await runner.writeFile(outputPath, namespaceDoc + kustomizeOutput);

    // Patch namespaces if needed
    if (runner.getEnv('HOLOLENS_KUSTOMIZE_NAMESPACE_FILL') === 'true' ||
        runner.getEnv('HOLOLENS_KUSTOMIZE_NAMESPACE_OVERRIDE') === 'true') {
        await k8s.patchNamespaces(outputPath, 'HOLOLENS_KUSTOMIZE');
    }

    // Add output to git index
    await runner.addToIndex(outputPath);

    // Output tree hash
    return await runner.writeTree(outputRoot);
});
