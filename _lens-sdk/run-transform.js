#!/usr/bin/env node
// run-transform.js — invoked by lens-job.sh to execute this image's lens
// transform, replicating exactly how the v1 transport's post-receive hook
// (/repo/hooks/post-receive) runs it so v1 and v2 executions of the same
// spec produce identical output trees:
//
//   - the lens spec ([holospec.lens] TOML) is squished into HOLOLENS_* env
//     vars with the identical object-squish options (arrays coerce to
//     comma-joined strings via Node's env stringification, same as v1)
//   - $HOLOLENS_ENTRYPOINT is spawned with a single argument: a commit whose
//     tree is the bare input tree (the v1 job commit shape)
//   - the transform's stdout is captured as the output tree hash; stdout and
//     stderr are relayed to our stderr (grey, like the v1 hook) and appended
//     to the job log file
//
// Usage: run-transform.js <spec-file> <job-commit> <log-file>
// Emits the output tree hash on stdout; exits with the transform's code.

'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const { createRequire } = require('module');

// reuse the exact dependencies the v1 post-receive hook uses, from the same
// installed location, so spec→env behavior cannot drift between transports
const hookRequire = createRequire(`${process.env.GIT_DIR || '/repo'}/hooks/package.json`);
const TOML = hookRequire('@iarna/toml');
const squish = hookRequire('object-squish');

const [, , specPath, jobCommit, logPath] = process.argv;

if (!specPath || !jobCommit || !logPath) {
    console.error('usage: run-transform.js <spec-file> <job-commit> <log-file>');
    process.exit(64);
}

const lensCommand = process.env.HOLOLENS_ENTRYPOINT;
if (!lensCommand) {
    console.error('run-transform: HOLOLENS_ENTRYPOINT is not set');
    process.exit(64);
}

const {
    holospec: {
        lens: spec
    }
} = TOML.parse(fs.readFileSync(specPath, 'utf8'));

// identical env construction to the v1 post-receive hook
const lensEnv = {
    ...squish({ hololens: spec }, {
        seperator: '_',
        modifyKey: key => key.toUpperCase().replace(/-/g, '_')
    }),
    ...process.env
};

const logStream = fs.createWriteStream(logPath, { flags: 'a' });

process.stderr.write(`executing: ${lensCommand} ${jobCommit}\n\n`);

const proc = spawn(lensCommand, [jobCommit], { stdio: 'pipe', env: lensEnv });
let stdout = '';

proc.stdout.on('data', data => {
    process.stderr.write(`\x1b[90m${data.toString().trimEnd()}\x1b[0m\n`);
    logStream.write(data);
    stdout += data;
});
proc.stderr.on('data', data => {
    process.stderr.write(`\x1b[90m${data.toString().trimEnd()}\x1b[0m\n`);
    logStream.write(data);
});

proc.on('error', error => {
    console.error(`run-transform: failed to execute ${lensCommand}: ${error.message}`);
    logStream.write(`failed to execute ${lensCommand}: ${error.message}\n`);
    logStream.end(() => process.exit(65));
});

proc.on('close', code => {
    logStream.end(() => {
        if (code !== 0) {
            process.exit(code === null ? 65 : code);
        }
        process.stdout.write(stdout.trim());
        process.exit(0);
    });
});
