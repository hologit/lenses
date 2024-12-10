#!/usr/bin/env node

const fs = require('fs');
const { LensRunner } = require('@hologit/lens-lib');
const { K8sManifestHandler } = require('@hologit/lens-lib-k8s');

LensRunner.run({ exportTree: true }, async (runner) => {
    const k8s = new K8sManifestHandler(runner);

    const {
        HOLOLENS_HELM_OUTPUT_ROOT = 'output',
        HOLOLENS_HELM_OUTPUT_FILENAME = 'manifest.yaml',
        HOLOLENS_HELM_CHART_PATH = '.',
        HOLOLENS_HELM_NAMESPACE,
        HOLOLENS_HELM_KUBE_VERSION = '1.22',
        HOLOLENS_HELM_KUBE_APIS = 'networking.k8s.io/v1/Ingress',
        HOLOLENS_HELM_RELEASE_NAME,
        HOLOLENS_HELM_INCLUDE_CRDS,
        HOLOLENS_HELM_VALUE_FILES = '',
        HOLOLENS_HELM_NAMESPACE_FILL,
        HOLOLENS_HELM_NAMESPACE_OVERRIDE,
    } = process.env;

    const outputPath = `${HOLOLENS_HELM_OUTPUT_ROOT}/${HOLOLENS_HELM_OUTPUT_FILENAME}`;

    // Install helm dependencies
    await runner.execCommand('helm', ['dependency', 'update', HOLOLENS_HELM_CHART_PATH]);

    // Create output directory
    fs.mkdirSync(HOLOLENS_HELM_OUTPUT_ROOT, { recursive: true });

    // Prepare helm template args
    const helmArgs = ['template'];

    if (HOLOLENS_HELM_NAMESPACE) {
        helmArgs.push('--namespace', HOLOLENS_HELM_NAMESPACE);
    }

    if (HOLOLENS_HELM_RELEASE_NAME) {
        helmArgs.push('--release-name', HOLOLENS_HELM_RELEASE_NAME);
    }

    if (HOLOLENS_HELM_INCLUDE_CRDS === 'true') {
        helmArgs.push('--include-crds');
    }

    if (HOLOLENS_HELM_VALUE_FILES) {
        HOLOLENS_HELM_VALUE_FILES.split(',').forEach(file => {
            if (file.trim()) {
                helmArgs.push('--values', file.trim());
            }
        });
    }

    if (HOLOLENS_HELM_KUBE_APIS) {
        HOLOLENS_HELM_KUBE_APIS.split(',').forEach(api => {
            if (api.trim()) {
                helmArgs.push('--api-versions', api.trim());
            }
        });
    }

    helmArgs.push('--kube-version', HOLOLENS_HELM_KUBE_VERSION);
    helmArgs.push(HOLOLENS_HELM_CHART_PATH);

    // Execute helm template
    const helmOutput = await runner.captureCommand('helm', helmArgs);

    // Write manifest with optional namespace doc
    const namespaceDoc = k8s.generateNamespaceManifest(HOLOLENS_HELM_NAMESPACE);
    fs.writeFileSync(outputPath, namespaceDoc + helmOutput);

    // Patch namespaces if needed
    if (HOLOLENS_HELM_NAMESPACE_FILL === 'true' ||
        HOLOLENS_HELM_NAMESPACE_OVERRIDE === 'true') {
        await k8s.patchNamespaces(outputPath, {
            namespace: HOLOLENS_HELM_NAMESPACE,
            fill: HOLOLENS_HELM_NAMESPACE_FILL === 'true',
            override: HOLOLENS_HELM_NAMESPACE_OVERRIDE === 'true'
        });
    }

    // Add output to git index
    await runner.addToIndex(outputPath);

    // Output tree hash
    return await runner.writeTree(HOLOLENS_HELM_OUTPUT_ROOT);
});
