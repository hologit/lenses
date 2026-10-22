#!/usr/bin/env node

const fs = require('fs');
const { LensRunner } = require('../_lens-lib');

// Container port of the habitat holo/lens-yarn-run package: runs
// `yarn install` and then `yarn run <command>` against the exported input
// tree. With output_dir set, returns the tree of that directory; otherwise
// the command's stdout is taken as the output tree hash.
LensRunner.run({ exportTree: true }, async (runner) => {
    const {
        HOLOLENS_YARN_RUN_INSTALL = 'yarn install',
        HOLOLENS_YARN_RUN_ENV,
        HOLOLENS_YARN_RUN_NODE_OPTIONS,
        HOLOLENS_YARN_RUN_NODE_VERSION,
        HOLOLENS_YARN_RUN_OUTPUT_DIR,
    } = process.env;

    // Validate required environment variables
    runner.requireEnv('HOLOLENS_YARN_RUN_COMMAND');
    const { HOLOLENS_YARN_RUN_COMMAND } = process.env;

    // Select an alternate Node runtime baked into the image (see Dockerfile)
    let PATH = process.env.PATH;
    const nodeMajor = HOLOLENS_YARN_RUN_NODE_VERSION && HOLOLENS_YARN_RUN_NODE_VERSION.replace(/^v/, '').split('.')[0];
    if (nodeMajor && nodeMajor !== process.versions.node.split('.')[0]) {
        const nodeBin = `/opt/node${nodeMajor}/bin`;
        if (!fs.existsSync(`${nodeBin}/node`)) {
            const available = fs.readdirSync('/opt')
                .filter(dir => dir.startsWith('node'))
                .map(dir => dir.slice(4));
            available.push(process.versions.node.split('.')[0]);
            throw new Error(`node_version ${HOLOLENS_YARN_RUN_NODE_VERSION} is not available in this image (available: ${available.sort().join(', ')})`);
        }
        PATH = `${nodeBin}:${PATH}`;
    }
    const nodeVersion = await runner.captureCommand('node', ['--version'], { env: { PATH } });
    console.error(`Using Node ${nodeVersion.trim()}`);

    const baseEnv = {
        CI: 'true',
        PATH,
        NODE_OPTIONS: HOLOLENS_YARN_RUN_NODE_OPTIONS,
        YARN_CACHE_FOLDER: '/tmp/yarn-cache',
    };

    // Install with NODE_ENV unset: yarn skips devDependencies when
    // NODE_ENV=production, and build tooling (webpack, laravel-mix, ...)
    // usually lives there. The lens repo's git environment is kept away from
    // the install so git-hosted dependencies cannot write into it; the run
    // step below keeps it, as the habitat lens did, so scripts that emit a
    // tree hash can reach the repo.
    console.error(`\nRunning: ${HOLOLENS_YARN_RUN_INSTALL}`);
    const [installCmd, ...installArgs] = HOLOLENS_YARN_RUN_INSTALL.split(/\s+/).filter(Boolean);
    await runner.execCommand(installCmd, installArgs, {
        env: {
            ...baseEnv,
            NODE_ENV: undefined,
            GIT_DIR: undefined,
            GIT_WORK_TREE: undefined,
            GIT_INDEX_FILE: undefined,
        },
    });

    // Run the configured script; NODE_ENV is only set when configured, so
    // scripts that manage it themselves (e.g. `mix --production`) are untouched
    const runEnv = { ...baseEnv, NODE_ENV: HOLOLENS_YARN_RUN_ENV };
    let commandOutput;

    console.error(`\nRunning: yarn run ${HOLOLENS_YARN_RUN_COMMAND}`);
    if (HOLOLENS_YARN_RUN_OUTPUT_DIR) {
        await runner.execCommand('yarn', ['run', HOLOLENS_YARN_RUN_COMMAND], { env: runEnv });
    } else {
        // suppress yarn's own output when stdout is read as the tree hash
        commandOutput = await runner.captureCommand('yarn', ['run', '--silent', HOLOLENS_YARN_RUN_COMMAND], { env: runEnv });
    }
    console.error(`\nyarn run ${HOLOLENS_YARN_RUN_COMMAND} completed successfully`);

    // Return the command's output as the tree hash when no output dir is set
    if (!HOLOLENS_YARN_RUN_OUTPUT_DIR) {
        return commandOutput.trim();
    }

    // Add output directory to git index (not forced: .gitignore files inside
    // the output are honored, as in the habitat lens)
    await runner.addToIndex(HOLOLENS_YARN_RUN_OUTPUT_DIR, false);

    // Output tree hash
    return await runner.writeTree(
        HOLOLENS_YARN_RUN_OUTPUT_DIR === '.' ? undefined : HOLOLENS_YARN_RUN_OUTPUT_DIR
    );
});
