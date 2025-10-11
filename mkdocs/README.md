# MkDocs Lens

A Hologit lens for building MkDocs documentation sites.

## Overview

This lens uses MkDocs to build static documentation sites from Markdown files. It supports configuration merging, custom Python package requirements, and flexible output options.

## Usage

### Basic Usage

To build documentation with default settings:

```toml
[hololens]
container = "ghcr.io/hologit/lenses/mkdocs:latest"

[hololens.mkdocs]
requirements = [
    "mkdocs-material",
    "mkdocs-awesome-pages-plugin",
    "mdx_truly_sane_lists"
]

[hololens.output]
merge = "replace"

```

### Environment Variables

- `HOLOLENS_MKDOCS_VERSION` - Specify a particular MkDocs version (e.g., `1.4.2`)
- `HOLOLENS_MKDOCS_REQUIREMENTS` - Comma-separated list of additional Python packages to install (e.g., `mkdocs-material,mkdocs-awesome-pages-plugin`)
- `HOLOLENS_MKDOCS_OUTPUT_DIR` - Output directory name (default: `site`)

### Configuration Merging

The lens supports merging multiple MkDocs configuration files. If you have override configuration files matching the pattern `mkdocs.*.yml` (e.g., `mkdocs.production.yml`, `mkdocs.theme.yml`), they will be automatically merged into `mkdocs.yml` before building.

Files are merged in alphabetical order, with later files overriding earlier ones.

### Python Requirements

The lens supports three ways to specify Python dependencies:

1. **Via environment variable**: Set `HOLOLENS_MKDOCS_REQUIREMENTS` with a comma-separated list
2. **Via requirements.txt**: Place a `requirements.txt` file in your repository
3. **Default**: If neither is provided, only MkDocs itself will be installed

### Examples

#### With Material Theme

```bash
HOLOLENS_MKDOCS_REQUIREMENTS=mkdocs-material holo lens mkdocs <input-tree>
```

#### With Specific MkDocs Version

```bash
HOLOLENS_MKDOCS_VERSION=1.4.2 holo lens mkdocs <input-tree>
```

#### With Configuration Overrides

If your repository contains:

- `mkdocs.yml` (base configuration)
- `mkdocs.theme.yml` (theme overrides)
- `mkdocs.production.yml` (production settings)

The lens will automatically merge them in order and build with the combined configuration.

## Implementation Details

This lens:

1. Exports the input git tree to the working directory
2. Merges any `mkdocs.*.yml` override files into `mkdocs.yml`
3. Creates a Python virtual environment
4. Installs MkDocs and any specified requirements
5. Runs `mkdocs build` to generate the site
6. Adds the output directory to git index
7. Returns the tree hash of the generated site

## Migration from Legacy Lens

This container-based lens replaces the older bash/Habitat-based `lens-mkdocs`. The functionality is equivalent with the following environment variable changes:

- Legacy: `HOLOLENS_REQUIREMENTS` → New: `HOLOLENS_MKDOCS_REQUIREMENTS`
- Output directory is now configurable via `HOLOLENS_MKDOCS_OUTPUT_DIR`

All other behavior remains the same, including configuration merging and Python virtual environment handling.
