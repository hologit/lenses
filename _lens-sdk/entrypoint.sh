#!/bin/sh
# entrypoint.sh — dual-protocol dispatch for hologit lens images
#
# One image serves both hologit lens transports:
#
#   v1 (legacy): the engine runs the container detached (`docker create` +
#       `start`) with stdin attached to /dev/null, then talks to the git
#       server the image publishes on port 9000.
#   v2 (job protocol, specs/behaviors/lensing.md): the engine runs the
#       image's default entrypoint with no arguments (`docker run --rm -i`)
#       and pipes a git bundle through stdin/stdout.
#
# The tell is stdin: a v1 engine gives the container /dev/null (or nothing),
# a v2 engine gives it a pipe carrying the input bundle. Dispatch on that so
# images published from this repo stay backward-compatible with released
# hologit engines while implementing the v2 contract for new ones.

set -eu

# a TTY is certainly not a job bundle — treat interactive runs as legacy
if [ -t 0 ]; then
    exec "$@"
fi

# v1 engines attach stdin to /dev/null; v2 engines attach a pipe
if [ "$(readlink /proc/self/fd/0 2>/dev/null || true)" = "/dev/null" ]; then
    exec "$@"
fi

exec /hololens-sdk/lens-job.sh
