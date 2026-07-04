#!/bin/sh
# lens-job.sh — hologit v2 lens job protocol (one-shot mode) for this repo's
# lens images. Vendored from the reference SDK (hologit lens-sdk/lens-job.sh)
# and adapted to invoke the transform machinery these images already carry
# for the v1 transport, so v1 and v2 runs produce identical output trees.
#
# Contract (specs/behaviors/lensing.md § Job protocol, one-shot mode):
#
#   stdin:  a git bundle containing `refs/jobs/<spec-hash>/input` — a commit
#           whose tree is a wrapper: `.holospec/lens.toml` (the full lens
#           spec) alongside `input/` (the input tree).
#   stdout: a git bundle containing exactly one of:
#             `refs/jobs/<spec-hash>/output` — success: a commit whose FIRST
#                 PARENT is the input commit and whose tree is the bare result;
#             `refs/jobs/<spec-hash>/error`  — failure: a PARENTLESS commit
#                 whose tree contains `exit-code` (the transform's real exit
#                 status), `log`, `phase` (setup|transform|commit), and —
#                 when the transform was reached — `command`.
#   exit:   0 on success; the transform's exit code on failure. stdout is
#           reserved for the bundle — ALL logging goes to stderr.
#
# Everything between reading the input and emitting the bundle is internal to
# the image. Here that internal path is the exact v1 transform: a synthetic
# job commit equivalent to what the legacy engine pushed to the port-9000
# server (bare input tree, spec TOML as commit message) is handed to
# $HOLOLENS_ENTRYPOINT with the spec squished into HOLOLENS_* env vars
# (run-transform.js, replicating /repo/hooks/post-receive).
#
# Warm-pool safety: all mutable job state lives under a per-job scratch dir
# derived from the spec hash — worktree, git index, log, meta. Only the bare
# object store ($GIT_DIR) is shared: object writes are atomic and job refs
# are namespaced refs/jobs/<spec-hash>/*, so concurrent jobs cannot collide.

set -eu

log() { echo "lens-job: $*" >&2; }

# operate in the image's standing bare repo so GIT_DIR semantics match the
# v1 transform exactly
: "${GIT_DIR:=/repo}"
export GIT_DIR

# --- 1. ingest the input bundle from stdin (fetch verifies all objects) ------
INGEST_DIR=$(mktemp -d)
BUNDLE_IN="$INGEST_DIR/input.bundle"
cat > "$BUNDLE_IN"
git fetch --quiet "$BUNDLE_IN" 'refs/jobs/*:refs/jobs/*' >&2

# --- 2. locate the job --------------------------------------------------------
INPUT_REF=$(git for-each-ref --format='%(refname)' 'refs/jobs/*/input' | head -n 1)
if [ -z "$INPUT_REF" ]; then
    log 'transport error: no refs/jobs/*/input ref found in bundle'
    exit 65
fi
SPEC_HASH=${INPUT_REF#refs/jobs/}
SPEC_HASH=${SPEC_HASH%/input}
INPUT_COMMIT=$(git rev-parse "$INPUT_REF")
log "job ${SPEC_HASH}: input commit ${INPUT_COMMIT}"

# --- 3. per-job scratch: all mutable state derives from the spec hash ----------
JOB_DIR=$(mktemp -d "${TMPDIR:-/tmp}/lens-job-${SPEC_HASH}-XXXXXX")
LOG_FILE="$JOB_DIR/log"
: > "$LOG_FILE"
META_DIR="$JOB_DIR/meta"
GIT_WORK_TREE="$JOB_DIR/worktree"
GIT_INDEX_FILE="$JOB_DIR/index"
export GIT_WORK_TREE GIT_INDEX_FILE
mkdir "$META_DIR" "$GIT_WORK_TREE"

emit_error() {
    code=$1
    phase=$2
    printf '%s' "$code" > "$JOB_DIR/exit-code"
    printf '%s' "$phase" > "$JOB_DIR/phase"
    ERROR_TREE=$(
        {
            printf '100644 blob %s\texit-code\n' "$(git hash-object -w "$JOB_DIR/exit-code")"
            printf '100644 blob %s\tlog\n' "$(git hash-object -w "$LOG_FILE")"
            printf '100644 blob %s\tphase\n' "$(git hash-object -w "$JOB_DIR/phase")"
            if [ -f "$META_DIR/command" ]; then
                printf '100644 blob %s\tcommand\n' "$(git hash-object -w "$META_DIR/command")"
            fi
        } | git mktree
    )
    ERROR_COMMIT=$(git commit-tree "$ERROR_TREE" -m "lens job ${SPEC_HASH} failed with exit code ${code} during ${phase}")
    git update-ref "refs/jobs/${SPEC_HASH}/error" "$ERROR_COMMIT"
    git bundle create "$JOB_DIR/error.bundle" "refs/jobs/${SPEC_HASH}/error" >&2
    cat "$JOB_DIR/error.bundle"
    log "job ${SPEC_HASH}: emitted error bundle (exit code ${code}, phase ${phase})"
    exit "$code"
}

# --- 4. extract the spec and the bare input tree ------------------------------
SPEC_FILE="$JOB_DIR/lens.toml"
if ! git cat-file blob "${INPUT_COMMIT}:.holospec/lens.toml" > "$SPEC_FILE" 2>>"$LOG_FILE"; then
    log 'transport error: input commit has no .holospec/lens.toml'
    exit 65
fi

if ! INPUT_TREE=$(git rev-parse --verify --quiet "${INPUT_COMMIT}:input"); then
    log 'transport error: input commit has no input/ tree'
    exit 65
fi

# --- 5. rebuild the v1-equivalent job commit -----------------------------------
# the legacy engine pushed a commit whose tree was the bare input tree and
# whose message was the spec TOML; recreate it so the transform sees the
# identical in-repo state it always has
JOB_COMMIT=$(git commit-tree "$INPUT_TREE" -F "$SPEC_FILE")
log "job ${SPEC_HASH}: input tree ${INPUT_TREE} staged as commit ${JOB_COMMIT}"

# --- 6. run the lens transform --------------------------------------------------
set +e
OUTPUT_TREE=$(node /hololens-sdk/run-transform.js "$SPEC_FILE" "$JOB_COMMIT" "$LOG_FILE" "$META_DIR")
CODE=$?
set -e

if [ "$CODE" -ne 0 ]; then
    PHASE=$(cat "$META_DIR/phase" 2>/dev/null || echo transform)
    log "lens transform failed with exit code ${CODE} during ${PHASE}"
    emit_error "$CODE" "$PHASE"
fi

if [ "$(git cat-file -t "$OUTPUT_TREE" 2>/dev/null || true)" != 'tree' ]; then
    log "lens transform did not return a tree hash: '${OUTPUT_TREE}'"
    echo "lens transform did not return a tree hash: '${OUTPUT_TREE}'" >> "$LOG_FILE"
    emit_error 65 commit
fi

# --- 7. commit the output tree as first-parent child of the input commit -------
if ! OUTPUT_COMMIT=$(git commit-tree "$OUTPUT_TREE" -p "$INPUT_COMMIT" -m "lens job ${SPEC_HASH}" 2>>"$LOG_FILE"); then
    log 'failed to commit output tree'
    emit_error 65 commit
fi
git update-ref "refs/jobs/${SPEC_HASH}/output" "$OUTPUT_COMMIT"
log "job ${SPEC_HASH}: output tree ${OUTPUT_TREE}"

# --- 8. emit the output bundle on stdout ----------------------------------------
# exclude objects reachable from the input commit — the engine already has them
git bundle create "$JOB_DIR/output.bundle" "refs/jobs/${SPEC_HASH}/output" "^${INPUT_COMMIT}" >&2
cat "$JOB_DIR/output.bundle"
log "job ${SPEC_HASH}: emitted output bundle"
exit 0
