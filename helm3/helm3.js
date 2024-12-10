#!/usr/bin/env node

const { LensRunner } = require('@hologit/lens-lib');
const { K8sManifestHandler } = require('@hologit/lens-lib-k8s');

const runner = new LensRunner();
const k8s = new K8sManifestHandler(runner);

runner.run(async () => {
    const outputRoot = runner.getEnv('HOLOLENS_HELM_OUTPUT_ROOT', 'output');
    const outputFilename = runner.getEnv('HOLOLENS_HELM_OUTPUT_FILENAME', 'manifest.yaml');
    const outputPath = `${outputRoot}/${outputFilename}`;
    const chartPath = runner.getEnv('HOLOLENS_HELM_CHART_PATH', '.');
    const namespace = runner.getEnv('HOLOLENS_HELM_NAMESPACE');
    const kubeVersion = runner.getEnv('HOLOLENS_HELM_KUBE_VERSION', '1.22');
    const kubeApis = runner.getEnv('HOLOLENS_HELM_KUBE_APIS', 'networking.k8s.io/v1/Ingress');
    const releaseName = runner.getEnv('HOLOLENS_HELM_RELEASE_NAME');
    const includeCrds = runner.getEnv('HOLOLENS_HELM_INCLUDE_CRDS');
    const valueFiles = runner.getEnv('HOLOLENS_HELM_VALUE_FILES', '');

    // Install helm dependencies
    await runner.execCommand('helm', ['dependency', 'update', chartPath]);

    // Create output directory
    await runner.createOutputDir(outputRoot);

    // Prepare helm template args
    const helmArgs = ['template'];

    if (namespace) {
        helmArgs.push('--namespace', namespace);
    }

    if (releaseName) {
        helmArgs.push('--release-name', releaseName);
    }

    if (includeCrds === 'true') {
        helmArgs.push('--include-crds');
    }

    if (valueFiles) {
        valueFiles.split(',').forEach(file => {
            if (file.trim()) {
                helmArgs.push('--values', file.trim());
            }
        });
    }

    if (kubeApis) {
        kubeApis.split(',').forEach(api => {
            if (api.trim()) {
                helmArgs.push('--api-versions', api.trim());
            }
        });
    }

    helmArgs.push('--kube-version', kubeVersion);
    helmArgs.push(chartPath);

    // Execute helm template
    const helmOutput = await runner.captureCommand('helm', helmArgs);

    // Write manifest with optional namespace doc
    const namespaceDoc = k8s.generateNamespaceManifest(namespace);
    await runner.writeFile(outputPath, namespaceDoc + helmOutput);

    // Patch namespaces if needed
    if (runner.getEnv('HOLOLENS_HELM_NAMESPACE_FILL') === 'true' ||
        runner.getEnv('HOLOLENS_HELM_NAMESPACE_OVERRIDE') === 'true') {
        await k8s.patchNamespaces(outputPath, 'HOLOLENS_HELM');
    }

    // Add output to git index
    await runner.addToIndex(outputPath);

    // Output tree hash
    return await runner.writeTree(outputRoot);
});
