#!/usr/bin/env node

const fs = require('fs');
const yaml = require('js-yaml');
const { execFile } = require('child_process');

// Configuration from environment variables
const {
    GIT_WORK_TREE,
    HOLOLENS_KUSTOMIZE_OUTPUT_ROOT = 'output',
    HOLOLENS_KUSTOMIZE_OUTPUT_FILENAME = 'manifest.yaml',
    HOLOLENS_KUSTOMIZE_DIRECTORY = '.',
    HOLOLENS_KUSTOMIZE_NAMESPACE,
    HOLOLENS_KUSTOMIZE_NAMESPACE_FILL,
    HOLOLENS_KUSTOMIZE_NAMESPACE_OVERRIDE,
} = process.env;

const OUTPUT_PATH = `${HOLOLENS_KUSTOMIZE_OUTPUT_ROOT}/${HOLOLENS_KUSTOMIZE_OUTPUT_FILENAME}`;

// List of kinds that don't support namespaces
const namespacelessKinds = [
    'apiservices',
    'bgpconfigurations',
    'bgppeers',
    'blockaffinities',
    'certificatesigningrequests',
    'clusterinformations',
    'clusterissuers',
    'clusterrolebindings',
    'clusterroles',
    'componentstatuses',
    'csidrivers',
    'csinodeinfos',
    'csinodes',
    'customresourcedefinitions',
    'felixconfigurations',
    'globalnetworkpolicies',
    'globalnetworksets',
    'hostendpoints',
    'ipamblocks',
    'ipamconfigs',
    'ipamhandles',
    'ippools',
    'mutatingwebhookconfigurations',
    'namespaces',
    'nodes',
    'persistentvolumes',
    'podsecuritypolicies',
    'priorityclasses',
    'runtimeclasses',
    'selfsubjectaccessreviews',
    'selfsubjectrulesreviews',
    'storageclasses',
    'subjectaccessreviews',
    'tokenreviews',
    'validatingwebhookconfigurations',
    'volumeattachments',
];

function captureCommand(cmd, args = [], options = {}) {
    return execCommand(cmd, args, { ...options, $captureOutput: true});
}

function execCommand(cmd, args = [], options = {}) {
    console.error(`executing: ${cmd} ${args.join(' ')}`);

    return new Promise((resolve, reject) => {
        const child = execFile(cmd, args, options);
        let stdout = '';

        child.stdout.on('data', (data) => {
            if (options.$captureOutput) {
                stdout += data;
            } else {
                console.error('::'+data.toString().trimEnd().replace(/\n/, '::\n'));
            }
        });

        child.stderr.on('data', (data) => {
            console.error('::'+data.toString().trimEnd().replace(/\n/, '::\n'));
        });

        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) {
                resolve(options.$captureOutput ? stdout : null);
            } else {
                reject(new Error(`Command failed with code ${code}`));
            }
        });
    });
}

function isNamespaced(kind) {
    kind = kind.toLowerCase();
    return namespacelessKinds.indexOf(kind) === -1
        && namespacelessKinds.indexOf(`${kind}s`) === -1;
}

async function patchNamespaces(yamlPath) {
    console.error('Patching namespaces...');

    // read options
    const fill = HOLOLENS_KUSTOMIZE_NAMESPACE_FILL === 'true';
    const override = HOLOLENS_KUSTOMIZE_NAMESPACE_OVERRIDE === 'true';
    const defaultNamespace = HOLOLENS_KUSTOMIZE_NAMESPACE;

    if (!yamlPath) {
        throw new Error('yaml-path required');
    }

    if (!fill && !override) {
        console.error('neither namespace_fill or namespace_override is enabled, doing nothing');
        return;
    }

    // load objects
    const objects = yaml.loadAll(fs.readFileSync(yamlPath, 'utf8'));

    // patch namespaces
    let patchedCount = 0;
    for (const object of objects) {
        // null values indicate empty documents
        if (!object) {
            continue;
        }

        if (!object.metadata) {
            throw new Error('encountered object with no metadata');
        }

        const { kind, metadata: { name, namespace } } = object;

        if (!name) {
            throw new Error('encountered object with no name');
        }

        // some kinds don't have namespaces
        if (!isNamespaced(kind)) {
            continue;
        }

        if (override || (fill && !namespace)) {
            object.metadata.namespace = defaultNamespace;
            console.error(`namespacing ${defaultNamespace}/${kind}/${name}`);
            patchedCount++;
        }
    }

    // save changes
    fs.writeFileSync(
        yamlPath,
        objects
            .filter(obj => obj !== null)
            .map(object => yaml.dump(object))
            .join('\n---\n\n')
    );
    console.error(`patched ${patchedCount} namespaces in ${yamlPath}`);
}

async function buildManifest() {
    // Create output directory
    fs.mkdirSync(HOLOLENS_KUSTOMIZE_OUTPUT_ROOT, { recursive: true });

    // Generate namespace document if needed
    let namespaceDoc = '';
    if (HOLOLENS_KUSTOMIZE_NAMESPACE) {
        namespaceDoc = `---
kind: Namespace
apiVersion: v1
metadata:
  name: "${HOLOLENS_KUSTOMIZE_NAMESPACE}"
`;
    }

    // Execute kustomize build
    const kustomizeOutput = await captureCommand('kustomize', ['build', HOLOLENS_KUSTOMIZE_DIRECTORY]);

    // Write combined output
    fs.writeFileSync(OUTPUT_PATH, namespaceDoc + kustomizeOutput);
}

async function main() {
    try {
        const inputTree = process.argv[2];
        if (!inputTree) {
            throw new Error('Input tree argument required');
        }

        // Log HOLO environment variables
        Object.entries(process.env)
            .filter(([key]) => key.startsWith('HOLO'))
            .forEach(([key, value]) => console.error(`${key}=${value}`));

        // Run from Git work tree
        process.chdir(GIT_WORK_TREE);

        // Export git tree
        await execCommand('git', ['holo', 'lens', 'export-tree', inputTree]);

        // Build manifest
        await buildManifest();

        // Patch namespaces if needed
        if (HOLOLENS_KUSTOMIZE_NAMESPACE_FILL === 'true' || HOLOLENS_KUSTOMIZE_NAMESPACE_OVERRIDE === 'true') {
            await patchNamespaces(OUTPUT_PATH);
        }

        // Add output to git index
        await execCommand('git', ['add', '-f', OUTPUT_PATH]);

        // Output tree hash
        const treeHash = await captureCommand('git', ['write-tree', '--prefix=' + HOLOLENS_KUSTOMIZE_OUTPUT_ROOT]);
        process.stdout.write(treeHash);

    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
