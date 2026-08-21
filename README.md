# Hologit Lenses

Collection of official container-based lenses for [Hologit](https://github.com/JarvusInnovations/hologit).

## What are Container-Based Lenses?

Container-based lenses are Docker containers that transform git trees through a standardized interface. Each lens receives an input git tree hash, performs transformations (like building code, rendering templates, or normalizing data), and outputs a new git tree hash representing the transformed content.

Lenses run in isolation with their own dependencies and tools, making them portable and reproducible across different environments.

## Architecture

### Base Image

All lenses build on `ghcr.io/hologit/lenses/base:node-20`, which provides:

- Node.js 20 runtime
- Git and Hologit CLI tools
- Pre-configured git repository at `/repo`
- Working directory at `/working`
- Server infrastructure for lens execution

See [`_base-image/`](_base-image/) for the base image implementation.

### Shared Libraries

- **`_lens-lib`**: Core LensRunner class providing common operations like exporting trees, executing commands, and managing git operations
- **`_lens-lib-k8s`**: Kubernetes-specific utilities for YAML processing and namespace management
- **`_lens-sdk`**: The v2 job-protocol implementation shared by every image — dual-protocol entrypoint, one-shot job runner, and the transform bridge (see Job Protocols below)

## Job Protocols

Every image published from this repo serves **both** hologit lens transports from one entrypoint:

- **v1 (legacy)**: the engine runs the container detached and talks to a git server on port 9000. Older hologit engines use this path unchanged.
- **v2 (job protocol)**: the engine runs the container one-shot (`docker run --rm -i`) and pipes a git bundle through stdin/stdout. Failures are reported structurally — a parentless error commit carrying the transform's real exit code, log, and phase — instead of surfacing as opaque git transport errors. Images advertise support via the `sh.holo.lens.protocol=2` label; v2-capable engines (hologit >= 0.51) select it automatically.

The dispatch tell is stdin: a v1 engine attaches `/dev/null`, a v2 engine attaches a pipe. See [`_lens-sdk/entrypoint.sh`](_lens-sdk/entrypoint.sh).

**Lenses that build `FROM ghcr.io/hologit/lenses/base:node-20` inherit all of this** — no per-lens work. A lens with a custom base image (like the `sencha-*` family, which needs its own JDK/tooling stack) must add the four SDK lines its Dockerfile replicates from the base image:

```dockerfile
COPY _lens-sdk /hololens-sdk
RUN chmod +x /hololens-sdk/entrypoint.sh /hololens-sdk/lens-job.sh /hololens-sdk/run-transform.js
LABEL sh.holo.lens.protocol=2
ENTRYPOINT ["/hololens-sdk/entrypoint.sh"]
```

## Lens Patterns

Container-based lenses follow two main patterns depending on their use case:

### Pattern 1: Export Tree Pattern

Most lenses use this pattern when they need to work with files on disk. The workflow:

1. Export the input git tree to the working directory
2. Perform transformations using external tools
3. Add transformed files to git index
4. Write and return a new git tree

**Examples**: `npm-install`, `npm-run`, `helm3`, `kustomize`, `mkdocs`

**Key characteristics**:

- Uses `LensRunner.run({ exportTree: true }, ...)`
- Executes external CLI tools (npm, helm, mkdocs, etc.)
- Works with files in the working directory
- Returns tree hash via `runner.writeTree()`

### Pattern 2: Direct Tree Manipulation Pattern

Used when transformations can be done purely through git tree operations without needing files on disk.

**Example**: `k8s-normalize`

**Key characteristics**:

- Uses `LensRunner.run({}, ...)` (no export)
- Works directly with git tree objects via Hologit API
- Programmatically creates new tree structure
- More efficient for pure data transformations

## Creating a New Lens

### 1. Project Structure

Create a new directory with these files:

```
my-lens/
├── Dockerfile      # Container definition
├── index.js        # Lens logic (must be executable)
└── package.json    # Metadata and dependencies
```

### 2. Dockerfile

Base your lens on the standard image and install required tools:

```dockerfile
FROM ghcr.io/hologit/lenses/base:node-20

# Install system dependencies
RUN apk add --no-cache your-tools-here

# Copy package files
COPY my-lens/package*.json ./

# Install dependencies
RUN npm install

# Copy lens script
COPY my-lens/index.js ./
```

See [`helm3/Dockerfile`](helm3/Dockerfile) or [`mkdocs/Dockerfile`](mkdocs/Dockerfile) for examples.

### 3. index.js

Implement your lens logic using the LensRunner:

```javascript
#!/usr/bin/env node

const { LensRunner } = require('../_lens-lib');

LensRunner.run({ exportTree: true }, async (runner) => {
    const {
        HOLOLENS_MY_LENS_OPTION = 'default-value',
    } = process.env;

    // Your transformation logic here
    await runner.execCommand('your-tool', ['--option', HOLOLENS_MY_LENS_OPTION]);

    // Add outputs to git
    await runner.addToIndex('output-directory/');

    // Return tree hash
    return await runner.writeTree('output-directory');
});
```

**Key LensRunner methods**:

- `execCommand(cmd, args, options)` - Execute CLI commands
- `captureCommand(cmd, args, options)` - Execute and capture output
- `addToIndex(path, force)` - Stage files for git tree
- `writeTree(prefix)` - Create and return git tree hash
- `requireEnv(...vars)` - Validate required environment variables
- `overrideEnv(envVars)` - Set environment variables

See [`npm-run/index.js`](npm-run/index.js) or [`kustomize/index.js`](kustomize/index.js) for complete examples.

### 4. package.json

Define your lens metadata and dependencies:

```json
{
  "name": "@hologit/lens-my-lens",
  "version": "1.0.0",
  "description": "Description of what your lens does",
  "main": "index.js",
  "license": "MIT",
  "dependencies": {
    "your-npm-packages": "^1.0.0"
  }
}
```

### 5. Make index.js Executable

```bash
chmod +x my-lens/index.js
```

This is required for the lens to execute properly in the container.

### 6. Add to Makefile

Add your lens to the build system:

```makefile
.PHONY: all _base-image ... my-lens

all: _base-image ... my-lens

my-lens: _base-image
 docker build . -f $@/Dockerfile -t ghcr.io/hologit/lenses/$@:latest
```

### 7. Build

```bash
make my-lens
```

## Environment Variables

Lens configuration follows these conventions:

- All lens-specific variables are prefixed with `HOLOLENS_`
- Use uppercase with underscores: `HOLOLENS_MY_LENS_OPTION`
- Provide sensible defaults where possible
- Document required vs optional variables in your lens README

## Best Practices

1. **Single Responsibility**: Each lens should do one thing well
2. **Idempotent**: Running the same input should always produce the same output
3. **Configuration**: Use environment variables for all configuration
4. **Logging**: Use `console.error()` for progress messages (stdout is reserved for tree hash)
5. **Error Handling**: Fail fast with clear error messages
6. **Documentation**: Include a README.md explaining usage and options
7. **Examples**: Reference specific files in your lens or others as examples

## Development Tips

- **Pattern Selection**: Use Export Tree pattern when you need to run external tools; use Direct Tree Manipulation for pure data transformations
- **Testing**: Start with the simplest possible transformation and iterate
- **Debugging**: Check container logs and verify git tree contents with `git ls-tree`
- **Dependencies**: Keep container images lean - only install what you need
- **Caching**: Docker layer caching speeds up rebuilds, so order Dockerfile steps wisely

## Publishing and Tags

CI publishes images from three triggers:

| Trigger | Tags published |
| --- | --- |
| Pull request | none — build-only verification |
| Push to `develop` | `:v2` and `:v2-<shortsha>` soak tags (base image as `:node-20-v2`) |
| GitHub release | `:latest` plus `:<major>`, `:<major>.<minor>`, `:<major>.<minor>.<patch>` |

`develop` is the default branch — **target PRs at `develop`**, not `main`. Releases flow through the develop→main Release PR (`release-prepare`/`release-validate`/`release-publish`); merging the Release PR cuts the GitHub release that publishes `:latest`. Two footguns worth knowing: `release-validate` red-Xes every non-release PR by design (title-format check), and a stale open Release PR will be auto-closed *as merged* — publishing a release — if a push ever makes `develop` identical to `main`.

## Further Reading

- [Hologit Documentation](https://github.com/JarvusInnovations/hologit)
- Individual lens READMEs for specific usage examples
- [`_lens-lib/index.js`](_lens-lib/index.js) for complete LensRunner API
