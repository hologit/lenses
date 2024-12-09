#!/usr/bin/env node

const fs = require('fs');
const yaml = require('js-yaml');
const { execSync } = require('child_process');

// Configuration from environment variables
const {
    GIT_WORK_TREE,
    HOLOLENS_HELM_OUTPUT_ROOT = 'output',
    HOLOLENS_HELM_OUTPUT_FILENAME = 'manifest.yaml',
    HOLOLENS_HELM_KUBE_VERSION = '1.22',
    HOLOLENS_HELM_KUBE_APIS = 'networking.k8s.io/v1/Ingress',
    HOLOLENS_HELM_CHART_PATH = '.',
    HOLOLENS_HELM_NAMESPACE,
    HOLOLENS_HELM_RELEASE_NAME,
    HOLOLENS_HELM_INCLUDE_CRDS,
    HOLOLENS_HELM_VALUE_FILES = '',
    HOLOLENS_HELM_NAMESPACE_FILL,
    HOLOLENS_HELM_NAMESPACE_OVERRIDE,
} = process.env;

const OUTPUT_PATH = `${HOLOLENS_HELM_OUTPUT_ROOT}/${HOLOLENS_HELM_OUTPUT_FILENAME}`;

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

function isNamespaced(kind) {
    kind = kind.toLowerCase();
    return namespacelessKinds.indexOf(kind) === -1
        && namespacelessKinds.indexOf(`${kind}s`) === -1;
}

async function patchNamespaces(yamlPath) {
    // read options
    const fill = HOLOLENS_HELM_NAMESPACE_FILL === 'true';
    const override = HOLOLENS_HELM_NAMESPACE_OVERRIDE === 'true';
    const defaultNamespace = HOLOLENS_HELM_NAMESPACE;

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
    console.error(`patched namespaces in ${yamlPath}`);
}

function buildManifest() {
    // Install helm dependencies
    console.error('executing: helm dependency update');
    execSync(`cd "${HOLOLENS_HELM_CHART_PATH}" && helm dependency update`, { stdio: 'inherit' });

    // Prepare helm template args
    const helmArgs = [];

    if (HOLOLENS_HELM_NAMESPACE) {
        helmArgs.push(`--namespace ${HOLOLENS_HELM_NAMESPACE}`);
    }

    if (HOLOLENS_HELM_RELEASE_NAME) {
        helmArgs.push(`--release-name ${HOLOLENS_HELM_RELEASE_NAME}`);
    }

    if (HOLOLENS_HELM_INCLUDE_CRDS === 'true') {
        helmArgs.push('--include-crds');
    }

    if (HOLOLENS_HELM_VALUE_FILES) {
        HOLOLENS_HELM_VALUE_FILES.split(',').forEach(file => {
            if (file.trim()) {
                helmArgs.push(`--values ${file.trim()}`);
            }
        });
    }

    if (HOLOLENS_HELM_KUBE_APIS) {
        HOLOLENS_HELM_KUBE_APIS.split(',').forEach(api => {
            if (api.trim()) {
                helmArgs.push(`--api-versions ${api.trim()}`);
            }
        });
    }

    helmArgs.push(`--kube-version ${HOLOLENS_HELM_KUBE_VERSION}`);

    // Create output directory
    fs.mkdirSync(HOLOLENS_HELM_OUTPUT_ROOT, { recursive: true });

    // Generate namespace document if needed
    let namespaceDoc = '';
    if (HOLOLENS_HELM_NAMESPACE) {
        namespaceDoc = `---
kind: Namespace
apiVersion: v1
metadata:
  name: "${HOLOLENS_HELM_NAMESPACE}"
`;
    }

    // Execute helm template
    console.error(`executing: helm template ${helmArgs.join(' ')}`);
    const helmOutput = execSync(
        `helm template ${helmArgs.join(' ')} "${HOLOLENS_HELM_CHART_PATH}"`,
        { encoding: 'utf8' }
    );

    // Write combined output
    fs.writeFileSync(OUTPUT_PATH, namespaceDoc + helmOutput);
}

async function main() {
    try {
        const inputTree = process.argv[2];
        if (!inputTree) {
            throw new Error('Input tree argument required');
        }

        // Run from Git work tree
        process.chdir(GIT_WORK_TREE);

        // Export git tree
        execSync(`git holo lens export-tree "${inputTree}"`, { stdio: 'inherit' });

        // Build manifest
        buildManifest();

        // Patch namespaces if needed
        if (HOLOLENS_HELM_NAMESPACE_FILL === 'true' || HOLOLENS_HELM_NAMESPACE_OVERRIDE === 'true') {
            await patchNamespaces(OUTPUT_PATH);
        }

        // Add output to git index
        execSync(`git add -f "${OUTPUT_PATH}"`, { stdio: 'inherit' });

        // Output tree hash
        const treeHash = execSync(
            `git write-tree --prefix="${HOLOLENS_HELM_OUTPUT_ROOT}"`,
            { encoding: 'utf8' }
        );
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
