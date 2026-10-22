# Composer Install Lens

A Hologit lens that installs PHP dependencies with [Composer](https://getcomposer.org/). It replaces the Habitat package `holo/lens-composer-install`.

## Usage

```toml
[hololens]
container = "ghcr.io/hologit/lenses/composer-install:v2"

[hololens.input]
files = [
    "composer.json",
    "composer.lock",

    # include any paths your autoload config scans (classmap, psr-4, ...)
    "app/**/*.php",
]

[hololens.composer]
args = [
    "--classmap-authoritative"
]
```

## Configuration

| Key | Environment variable | Default | Description |
| --- | --- | --- | --- |
| `composer.args` | `HOLOLENS_COMPOSER_ARGS` | none | Extra arguments for `composer install`. A TOML array arrives comma-joined; a space-separated string also works. |

The lens always adds these flags, the same set the Habitat lens used:

- `--no-interaction`
- `--ignore-platform-reqs`
- `--no-plugins`
- `--no-scripts`
- `--prefer-dist`
- `--no-progress` (the Habitat lens used `--quiet`; this keeps the download log readable)

## Output

The output is the input tree plus the `vendor/` directory that Composer produced.

## Implementation details

- PHP and Composer 2 come from the Alpine packages in the base image (`composer`, currently PHP 8.4 and Composer 2.9).
- Because of `--ignore-platform-reqs`, the image's PHP version only has to run Composer. It does not need to satisfy the project's own `php` constraint. The generated autoloader still runs on older PHP: a Laravel 8 app locked for PHP 7.3 boots on `php:7.3` with this lens's `vendor/`.
- Composer runs without the lens's `GIT_DIR`, `GIT_WORK_TREE`, and `GIT_INDEX_FILE`, so a package that falls back to a source (git) install cannot write into the lens repository.
