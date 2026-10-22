# Yarn Run Lens

A Hologit lens that runs `yarn install` and then a `package.json` script with [Yarn 1 (classic)](https://classic.yarnpkg.com/). It replaces the Habitat package `holo/lens-yarn-run`.

## Usage

```toml
[hololens]
container = "ghcr.io/hologit/lenses/yarn-run:v2"

[hololens.input]
files = [
    "package.json",
    "yarn.lock",
    "webpack.mix.js",
    "resources/js/**",
]

[hololens.yarn-run]
command = "production"
output_dir = "public"

[hololens.output]
root = "public"
merge = "overlay"
```

## Configuration

| Key | Environment variable | Default | Description |
| --- | --- | --- | --- |
| `yarn-run.command` | `HOLOLENS_YARN_RUN_COMMAND` | (required) | Script to run with `yarn run`. |
| `yarn-run.output_dir` | `HOLOLENS_YARN_RUN_OUTPUT_DIR` | none | Directory to return as the output tree. Use `.` for the whole working tree. |
| `yarn-run.install` | `HOLOLENS_YARN_RUN_INSTALL` | `yarn install` | Install command, for example `yarn install --frozen-lockfile`. |
| `yarn-run.env` | `HOLOLENS_YARN_RUN_ENV` | unset | `NODE_ENV` for the script run only. |
| `yarn-run.node_version` | `HOLOLENS_YARN_RUN_NODE_VERSION` | `20` | Node.js major version: `14`, `16`, or `20`. |
| `yarn-run.node_options` | `HOLOLENS_YARN_RUN_NODE_OPTIONS` | unset | `NODE_OPTIONS` for both install and run, for example `--max-old-space-size=4096`. |

`command` and `output_dir` work as they did in the Habitat lens. `install`, `env`, `node_version`, and `node_options` are new.

## Output

- **With `output_dir`:** the lens adds that directory to the git index (honoring any `.gitignore` inside it, as the Habitat lens did) and returns its tree.
- **Without `output_dir`:** the script's stdout is taken as the output tree hash. Yarn runs with `--silent` in this mode, and the script keeps the lens's git environment so it can write trees.

## Node.js versions

The Habitat lens ran on Node 14. Older lockfiles often fail to build on Node 17 or later. Two common causes:

- webpack before 5.61 hashes with md4, which OpenSSL 3 rejects (`ERR_OSSL_EVP_UNSUPPORTED`)
- packages that use the removed `"./"` exports mapping, such as early postcss 8 releases (`ERR_PACKAGE_PATH_NOT_EXPORTED`)

For these projects, set `node_version = "14"` or `"16"`. The image carries the final Node 14 and 16 releases, each with its matching npm, next to the base image's Node 20.

## Implementation details

- `yarn install` always runs with `NODE_ENV` unset. Yarn skips `devDependencies` when `NODE_ENV=production`, and build tools such as webpack and laravel-mix usually live there.
- `yarn install` runs without the lens's `GIT_DIR`, `GIT_WORK_TREE`, and `GIT_INDEX_FILE`, so git-hosted dependencies cannot write into the lens repository.
- `python3`, `make`, and `g++` are installed so native modules can build with node-gyp, matching the Habitat lens's dependencies.
