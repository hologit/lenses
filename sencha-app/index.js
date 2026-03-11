#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { LensRunner } = require('../_lens-lib');

LensRunner.run({ exportTree: true }, async (runner) => {
    // Validate required env
    runner.requireEnv('HOLOLENS_SENCHA_APP');
    const senchaApp = process.env.HOLOLENS_SENCHA_APP;
    const senchaWorkspace = process.env.HOLOLENS_SENCHA_WORKSPACE || '.';
    const senchaAppPath = path.join(senchaWorkspace, senchaApp);

    // Validate app path exists in tree
    try {
        await runner.captureCommand('git', ['cat-file', '-t', `HEAD:${senchaAppPath}`]);
    } catch (e) {
        throw new Error(`hololens.sencha.app '${senchaAppPath}' does not match a top-level subtree`);
    }

    const workTree = process.env.GIT_WORK_TREE;
    const appDir = path.join(workTree, senchaAppPath);
    const buildDir = path.join(appDir, 'build');

    // Build app with sencha cmd
    console.error(`\nBuilding ${senchaApp} with Sencha CMD`);
    const antArgs = [
        'ant',
        `-Dext.dir=../ext`,
        `-Dbuild.temp.dir=${appDir}/tmp`,
        `-Dapp.output.base=${buildDir}`,
        '-Dapp.cache.deltas=false',
        '-Dapp.output.microloader.enable=false',
        '-Dbuild.enable.appmanifest=false',
        '-Denable.standalone.manifest=true',
        '-Dbuild.timestamp=12345',
        ...(process.env.HOLOLENS_SENCHA_ANT_ARGS || '').split(/\s+/).filter(Boolean),
        'production',
        'build'
    ];

    await runner.execCommand('sencha', antArgs, { cwd: appDir });

    // Strip absolute paths from app.json
    const appJsonPath = path.join(buildDir, 'app.json');
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    if (appJson.css) {
        appJson.css.forEach(file => {
            file.path = file.path.replace(`${buildDir}/`, '');
        });
    }
    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));

    // Strip absolute paths from index.html
    const indexPath = path.join(buildDir, 'index.html');
    let indexHtml = fs.readFileSync(indexPath, 'utf8');
    indexHtml = indexHtml.split(`${buildDir}/`).join('');
    fs.writeFileSync(indexPath, indexHtml);

    console.error(`\n${senchaApp} build completed successfully`);

    // Add build output to git index
    await runner.addToIndex(path.join(senchaAppPath, 'build'));

    // Return only the build subtree
    const prefix = senchaAppPath.replace(/^\.\//, '') + '/build';
    return await runner.writeTree(prefix);
});
