const fs = require('fs');
const { yaml } = require('../lens-lib');

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

// Check if a kind supports namespaces
function isNamespaced(kind) {
    kind = kind.toLowerCase();
    return namespacelessKinds.indexOf(kind) === -1
        && namespacelessKinds.indexOf(`${kind}s`) === -1;
}

// Generate namespace manifest
function generateNamespaceManifest(namespace) {
    if (!namespace) return '';

    return `---
kind: Namespace
apiVersion: v1
metadata:
  name: "${namespace}"
`;
}

// Patch namespaces in a manifest file
async function patchNamespaces(yamlPath, {
    namespace,
    fill = false,
    override = false
}) {
    console.error('Patching namespaces...');

    if (!yamlPath) {
        throw new Error('yaml-path required');
    }

    if (!fill && !override) {
        console.error('neither namespace_fill or namespace_override is enabled, doing nothing');
        return;
    }

    // load objects
    const objects = yaml.safeLoadAll(fs.readFileSync(yamlPath, 'utf8'));

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

        const { kind, metadata: { name, namespace: currentNamespace } } = object;

        if (!name) {
            throw new Error('encountered object with no name');
        }

        // some kinds don't have namespaces
        if (!isNamespaced(kind)) {
            continue;
        }

        if (override || (fill && !currentNamespace)) {
            object.metadata.namespace = namespace;
            console.error(`namespacing ${namespace}/${kind}/${name}`);
            patchedCount++;
        }
    }

    // save changes
    fs.writeFileSync(
        yamlPath,
        objects
            .filter(obj => obj !== null)
            .map(object => yaml.safeDump(object))
            .join('\n---\n\n')
    );
    console.error(`patched ${patchedCount} namespaces in ${yamlPath}`);
}

module.exports = {
    namespacelessKinds,
    isNamespaced,
    generateNamespaceManifest,
    patchNamespaces,

    // Export common utilities that might be needed by lenses
    yaml
};
