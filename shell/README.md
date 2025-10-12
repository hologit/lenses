# lens-shell

Run an arbitrary shell script on the input tree.

## Environment Variables

### Required

- `HOLOLENS_SHELL_SCRIPT` - The shell script to execute. The script runs in the context of the exported input tree and can modify files in place.

## Usage

The shell lens allows you to run arbitrary bash scripts to transform your input tree. This is useful for simple file transformations that don't require a dedicated lens.

### Example: Renaming a file

```toml
[hololens]
container = "ghcr.io/hologit/lenses/shell:latest"
before = "cert-manager"

[hololens.shell]
script = '''
mv -v Chart.template.yaml Chart.yaml
'''

[hololens.input]
root = "cert-manager/helm-chart"
files = "**"

[hololens.output]
merge = "replace"
```

### Example: Modifying file contents

```toml
[hololens]
container = "ghcr.io/hologit/lenses/shell:latest"

[hololens.shell]
script = '''
sed -i 's/old-value/new-value/g' config.yaml
echo "Modified config.yaml"
'''

[hololens.input]
root = "config"
files = "**/*.yaml"

[hololens.output]
merge = "replace"
```

### Example: Multiple operations

```toml
[hololens]
container = "ghcr.io/hologit/lenses/shell:latest"

[hololens.shell]
script = '''
# Remove unwanted files
rm -f .gitkeep temp.*

# Rename files
for f in *.txt; do
  mv "$f" "${f%.txt}.md"
done

# Create a manifest
ls -1 > manifest.txt
'''
```

## How It Works

1. The input tree is exported to a working directory
2. The shell script is executed in that directory using bash
3. All files in the working directory are added to the git index
4. A new tree hash is returned containing the modified files

## Notes

- The script runs with bash, so all bash features are available
- The script's exit code is checked - non-zero exits will fail the lens
- Changes are made to the exported tree, not your original repository
- All script output goes to stderr for debugging; only the tree hash goes to stdout
