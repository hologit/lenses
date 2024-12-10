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

class K8sManifestHandler {
    constructor(runner, options = {}) {
        this.runner = runner;
        this.options = options;
    }

    // Check if a kind supports namespaces
    isNamespaced(kind) {
        kind = kind.toLowerCase();
        return namespacelessKinds.indexOf(kind) === -1
            && namespacelessKinds.indexOf(`${kind}s`) === -1;
    }

    // Generate namespace manifest
    generateNamespaceManifest(namespace) {
        if (!namespace) return '';

        return `---
kind: Namespace
apiVersion: v1
metadata:
  name: "${namespace}"
`;
    }

    // Patch namespaces in a manifest file
    async patchNamespaces(yamlPath, envPrefix = 'HOLOLENS') {
        console.error('Patching namespaces...');

        // read options
        const fill = this.runner.getEnv(`${envPrefix}_NAMESPACE_FILL`) === 'true';
        const override = this.runner.getEnv(`${envPrefix}_NAMESPACE_OVERRIDE`) === 'true';
        const defaultNamespace = this.runner.getEnv(`${envPrefix}_NAMESPACE`);

        if (!yamlPath) {
            throw new Error('yaml-path required');
        }

        if (!fill && !override) {
            console.error('neither namespace_fill or namespace_override is enabled, doing nothing');
            return;
        }

        // load objects
        const objects = yaml.loadAll(await this.runner.readFile(yamlPath));

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
            if (!this.isNamespaced(kind)) {
                continue;
            }

            if (override || (fill && !namespace)) {
                object.metadata.namespace = defaultNamespace;
                console.error(`namespacing ${defaultNamespace}/${kind}/${name}`);
                patchedCount++;
            }
        }

        // save changes
        await this.runner.writeFile(
            yamlPath,
            objects
                .filter(obj => obj !== null)
                .map(object => yaml.dump(object))
                .join('\n---\n\n')
        );
        console.error(`patched ${patchedCount} namespaces in ${yamlPath}`);
    }
}

module.exports = {
    K8sManifestHandler,
    namespacelessKinds
};
