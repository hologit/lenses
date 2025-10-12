# lens-k8s-patch

Hologit lens for patching Kubernetes manifest content with JavaScript

## Usage

```toml
[hololens]
container = "ghcr.io/hologit/lenses/k8s-patch:latest"
after = "metrics-server"

[hololens.k8s-patch]
script = '''
manifest => {
    const { kind, metadata: { namespace, name }, spec } = manifest

    if (kind == 'Deployment' && name == 'metrics-server') {
        spec.template.spec.containers[0].args.push(
            '--kubelet-insecure-tls',
        );
    }
}
'''

[hololens.input]
root = "infra/metrics-server"
files = "**"

[hololens.output]
merge = "overlay"
```

## Environment Variables

### Required

- `HOLOLENS_K8S_PATCH_SCRIPT` - JavaScript arrow function expression that receives a Kubernetes manifest object and modifies it in place. The function should be provided as an arrow function expression (e.g., `manifest => { ... }`) that takes a single parameter (the manifest object). The function is executed via `vm.runInNewContext()`.

## How it works

1. Iterates through all `.yaml` and `.yml` files in the input tree
2. Parses each YAML file (which may contain multiple Kubernetes objects)
3. For each object in the YAML:
   - Applies the patch script function to modify the object
   - Handles `ConfigMapList` objects by expanding their items
4. Writes the patched YAML back to the same path in the output tree
5. Passes through non-YAML files unchanged

## Notes

- The patch function modifies objects in place - it does not need to return anything
- Empty YAML documents (null values) are preserved
- Objects without `metadata` or `metadata.name` will cause an error
- The patch script has access to the full object structure and can modify any fields
