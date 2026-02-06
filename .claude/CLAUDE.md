## Brief overview

Guidelines for developing container-based lenses for Hologit, based on established patterns in this repository. These are project-specific rules for the hologit-lenses repository.

## Lens architecture patterns

- **Export Tree Pattern**: Used when working with external CLI tools that need files on disk (npm, helm, mkdocs, etc.)
    - Uses `LensRunner.run({ exportTree: true }, ...)`
    - Exports input tree → runs transformations → adds to git index → returns tree hash
- **Direct Tree Manipulation Pattern**: Used for pure data transformations without disk I/O
    - Uses `LensRunner.run({}, ...)` without export
    - Works directly with git tree objects via Hologit API

## Required lens components

- **Dockerfile**: Based on `ghcr.io/hologit/lenses/base:node-20`, installs system dependencies and npm packages
- **index.js**: Main lens logic using LensRunner, must be executable (`chmod +x`)
- **package.json**: Lens metadata and npm dependencies
- **README.md**: Usage documentation with environment variables and examples
- **Makefile entry**: Add build target that depends on `_base-image`

## Environment variable conventions

- Prefix all lens-specific variables with `HOLOLENS_`
- Use uppercase with underscores: `HOLOLENS_LENS_NAME_OPTION`
- Provide sensible defaults in code where possible
- Document required vs optional variables in lens README

## LensRunner best practices

- Use `console.error()` for progress messages (stdout reserved for tree hash output)
- Use `requireEnv()` to validate required environment variables early
- Use `overrideEnv()` to set environment variables for subprocess execution
- Clean git environment variables when running tools like pip/Python that may conflict

## Porting habitat-based lenses

When converting legacy habitat/bash-based lenses to container-based lenses:

- **Identify dependencies**: Map habitat packages to Alpine apk packages and npm packages
    - Example: `jarvus/yaml-merge` habitat package → `@alexlafroscia/yaml-merge` npm package
- **Convert bash to JavaScript**: Translate bash scripts to use LensRunner methods
    - `git add -f` → `runner.addToIndex()`
    - `git write-tree` → `runner.writeTree()`
    - Command execution → `runner.execCommand()` or `runner.captureCommand()`
- **Handle environment cleanup**: If the legacy lens unsets git environment variables for subprocesses, use a clean env object and pass via options
- **Preserve configuration merging**: If legacy lens merged config files, use appropriate npm packages or implement in JavaScript
- **Maintain environment variable compatibility**: Keep the same variable names when possible, or document migration path in README

## Development workflow

- Create lens directory with all required files
- Make index.js executable before first build
- Add to Makefile following existing pattern
- Build with `make lens-name`
- Test changes by rebuilding container after each modification
- Reference existing lenses as examples rather than duplicating code in documentation
