const fs = require('fs');
const yaml = require('js-yaml');

// Create a custom int type that handles both regular ints and octals
const CustomIntType = new yaml.Type('tag:yaml.org,2002:int', {
    kind: 'scalar',
    resolve: function (data) {
        if (data === null || data === undefined) return false;

        // Check for octal pattern first
        const octalPattern = /^0[0-7]+$/;
        if (octalPattern.test(data)) {
            return true;
        }

        // Otherwise check for regular int patterns
        const intPattern = /^[-+]?[0-9]+$/;
        const hexPattern = /^0x[0-9a-fA-F]+$/;
        return intPattern.test(data) || hexPattern.test(data);
    },
    construct: function (data) {
        const octalPattern = /^0[0-7]+$/;

        if (octalPattern.test(data)) {
            // Parse as octal and return a wrapper object
            const value = parseInt(data, 8);
            return { __octal: true, value: value, original: data };
        }

        // Parse as regular int
        return parseInt(data, 10);
    },
    predicate: function (object) {
        // Explicitly reject null and undefined
        if (object === null || object === undefined) {
            return false;
        }
        // Check if this is our octal wrapper object or a regular number
        if (typeof object === 'object' && object.__octal === true) {
            return true;
        }
        return Object.prototype.toString.call(object) === '[object Number]' &&
               (object % 1 === 0 && !isNaN(object));
    },
    represent: function (object) {
        // If it's an octal wrapper, use the stored format
        if (object && typeof object === 'object' && object.__octal === true) {
            return object.original;
        }
        // Otherwise represent as decimal
        return String(object);
    },
    defaultStyle: 'decimal'
});

// Create a custom schema with our custom int type
// We extend the CORE schema (which has null, bool, etc.) and add our custom int type
// This ensures null/bool are processed before our int type
const OCTAL_SCHEMA = yaml.DEFAULT_SCHEMA.extend({
    implicit: [CustomIntType]
});

/**
 * Load YAML content with OCTAL_SCHEMA by default
 * @param {string} content - YAML content to parse
 * @param {object} options - Additional options to pass to yaml.loadAll
 * @returns {array} Array of parsed objects
 */
function loadYaml(content, options = {}) {
    return yaml.loadAll(content, { schema: OCTAL_SCHEMA, ...options });
}

/**
 * Dump object to YAML with OCTAL_SCHEMA by default
 * @param {object} object - Object to serialize
 * @param {object} options - Additional options to pass to yaml.dump
 * @returns {string} YAML string
 */
function dumpYaml(object, options = {}) {
    return yaml.dump(object, { schema: OCTAL_SCHEMA, ...options });
}

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
    const objects = loadYaml(fs.readFileSync(yamlPath, 'utf8'));

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
            .map(object => dumpYaml(object))
            .join('\n---\n\n')
    );
    console.error(`patched ${patchedCount} namespaces in ${yamlPath}`);
}

module.exports = {
    namespacelessKinds,
    isNamespaced,
    generateNamespaceManifest,
    patchNamespaces,

    // Export YAML utilities
    yaml,
    OCTAL_SCHEMA,
    loadYaml,
    dumpYaml
};
