#!/usr/bin/env node
const fs = require('fs-extra');
const path = require('path');
const envinfo = require('envinfo');
const cp = require('child_process');
const packageJson = require('../package.json');
const chalk = require('chalk');
const commander = require('commander');
const unpack = require('tar-pack').unpack;
const pack = require('tar-pack').pack;
const validateProjectName = require('validate-npm-package-name');
const os = require('os');
const inquirer = require('inquirer')
const semver = require('semver');
const ora = require('ora');
const spinner = ora();
const rootDir = path.join(__dirname, '..');
const packagesDir = path.join(rootDir, 'template');
const scriptsPath = path.join(packagesDir, `/solution-stater-${packageJson.version}.tar.gz`);
// Now run the CRA command
let projectName;
let templateDir = "test-template";
// By default the dart-sass is installed.
let dartSassCompile = true;
const program = new commander.Command(packageJson.name)
    .version(packageJson.version)
    .arguments('<solution name>')
    .usage(`${chalk.green('<solution name>')} [options]`)
    .action(name => {
        projectName = name;
    })
    .option('--typescript', 'install typescript template')
    .option('--nodesass', 'install node-sass package')
    .option('--info', 'print environment debug info')
    .allowUnknownOption()
    .on('--help', () => {
        console.log(`    Only ${chalk.green('<solution name>')} is required.`);
    })
    .parse(process.argv);

if (program.info) {
    console.log(chalk.bold('\nEnvironment Info:'));
    console.log(
        `\n  current version of ${packageJson.name}: ${packageJson.version}`
    );
    console.log(`  running from ${__dirname}`);
    return envinfo
        .run(
            {
                System: ['OS', 'CPU'],
                Binaries: ['Node', 'npm'],
                Browsers: ['Chrome', 'Edge', 'Internet Explorer', 'Firefox', 'Safari']
            },
            {
                duplicates: true,
                showNotFound: true,
            }
        )
        .then(console.log);
}
if (program.nodesass) {
    dartSassCompile = false;
}
if (program.typescript) {
    templateDir = "template-typescript";
}
if (typeof projectName === 'undefined') {
    console.error('Please specify the project directory:');
    console.log(
        `  ${chalk.cyan(program.name())} ${chalk.green('<solution name>')}`
    );
    console.log();
    console.log('For example:');
    console.log(`  ${chalk.cyan(program.name())} ${chalk.green('my-react-app')}`);
    console.log();
    console.log(
        `Run ${chalk.cyan(`${program.name()} --help`)} to see all options.`
    );
    process.exit(1);
}
function checkNpmVersion() {
    let hasMinNpm = false;
    let npmVersion = null;
    try {
        npmVersion = cp.execSync('npm --version').toString().trim();
        hasMinNpm = semver.gte(npmVersion, '6.0.0');
    } catch (err) {
        console.log(err)
    }
    return {
        hasMinNpm: hasMinNpm,
        npmVersion: npmVersion,
    };
}
function checkNodeVersion() {
    const currentNodeVersion = process.versions.node;
    const semver = currentNodeVersion.split('.');
    const major = semver[0];

    if (major < 10) {
        console.error(
            'You are running Node ' +
            currentNodeVersion +
            '.\n' +
            'Create SFx App requires Node 10 or higher. \n' +
            'Please update your version of Node.'
        );
        process.exit(1);
    }
    return currentNodeVersion
}
function packTemplate() {
    return new Promise((resolve, reject) => {
        // Pack sfx-template.
        spinner.start('Pack sfx-template')
        let packageJson = JSON.parse(fs.readFileSync(path.join(packagesDir, templateDir, 'package.json'), 'utf8'));
        const appConfigJson = JSON.parse(fs.readFileSync(path.join(packagesDir, templateDir, 'public', 'config', 'app.config.json')))
        pack(path.join(packagesDir, templateDir))
            .pipe(fs.createWriteStream(scriptsPath))
            .on('error', function (err) {
                console.error(err.stack)
                reject(err);
            })
            .on('close', function () {
                spinner.succeed(`Pack sfx-${templateDir} successfully`)
                let { dependencies } = packageJson
                delete dependencies.sass;
                resolve({ packageJson, appConfigJson })
            })

    })

}
function unpackTemplate(root) {
    return new Promise((resolve, reject) => {
        //  unPack sfx-template into directory
        spinner.start('Unpack sfx-template')
        const stream = fs.createReadStream(scriptsPath);
        stream.pipe(unpack(root, function (err) {
            if (err) {
                console.error(err.stack)
                reject(err);
            } else {
                spinner.succeed(`Unpack sfx-${templateDir} successfully`)
                resolve()
            }
        }))
    })
}
function customAppConfig(appName, packageJson, appConfigJson, root) {

    return new Promise((resolve, reject) => {
        //   "PlatformUrl": "[Replace the url with baseUrl]",
        //   "AuthorityUrl": "[Replace the url with authentication url]",
        //   "ClientId": "[Replace the ClientId with your own solution ClientId]",
        //   "Scope": "[Replace the Scope with your own solution Scope]",
        //   "SolutionTitle": "[Replace the SolutionTitle with your own solution title]",
        //   "SolutionShortTitle": "[Replace the SolutionShortTitle with your own solution short title]",
        //   "AppVersion": "[Replace the AppVersion with your own solution version]"
        const question = [
            {
                name: "AppVersion",
                type: 'input',
                message: `Please input your solution version.`,
                default: '1.0.0',
            },
            {
                name: "PlatformUrl",
                type: 'input',
                message: "Please input your Platform url as baseUrl. (https://xxx.xxx.xxx)",
                default: '[Replace the url with baseUrl]',
            },
            {
                name: "AuthorityUrl",
                type: 'input',
                message: "Please input your authentication url. (https://xxx.xxx.xxx)",
                default: '[Replace the url with authentication url]',
            },
            {
                name: "ClientId",
                type: 'input',
                message: "Please input your solution ClientId.",
                default: "[Replace the ClientId with your own solution ClientId]",
            }
        ]
        try {
            inquirer
                .prompt(question).then(answers => {
                    const Scope = { Scope: `openid profile email platform.${answers.ClientId || "[clientId]"}` }
                    const packageJsonInstall = { ...packageJson, name: appName }
                    const appConfigInstall = { ...appConfigJson, ...answers, ...Scope, ...{ SolutionTitle: appName, SolutionShortTitle: appName } }
                    const packageJsonFile = path.join(root, 'package.json')
                    const appConfigJsonFile = path.join(root, 'public', 'config', 'app.config.json')
                    fs.ensureFileSync(packageJsonFile)
                    fs.ensureFileSync(appConfigJsonFile)
                    fs.writeFileSync(
                        packageJsonFile,
                        JSON.stringify(packageJsonInstall, null, 2) + os.EOL
                    );
                    fs.writeFileSync(
                        appConfigJsonFile,
                        JSON.stringify(appConfigInstall, null, 2) + os.EOL
                    );
                    console.log('\n')
                    console.log(chalk.green('Init app.config.json successfully\n'))
                    console.log(chalk.grey('The latest app.config.json is: \n'))
                    console.log(appConfigInstall)
                    console.log('\n')
                    resolve();
                })
        } catch (error) {
            reject(error)
        }

    });

}
function install(root, nodeSassVersion) {
    return new Promise((resolve, reject) => {
        try {
            const sassPackage = dartSassCompile ? "sass" : `node-sass@${nodeSassVersion}`
            cp.execSync(
                `npm install ${sassPackage}`,
                {
                    cwd: root,
                    stdio: 'inherit',
                }
            );
            cp.execSync(
                `npm install --registry=https://pkgs.dev.azure.com/hexagonsf/_packaging/SFxPackageLib/npm/registry/"`,
                {
                    cwd: root,
                    stdio: 'inherit',
                }
            );
            resolve();

        } catch (error) {
            reject({
                command: 'npm install'
            })
        }
    })
}

function checkAppName(appName) {
    const validationResult = validateProjectName(appName);
    if (!validationResult.validForNewPackages) {
        console.error(
            chalk.red(
                `Cannot create a project named ${chalk.green(
                    `"${appName}"`
                )} because of npm naming restrictions:\n`
            )
        );
        [
            ...(validationResult.errors || []),
            ...(validationResult.warnings || []),
        ].forEach(error => {
            console.error(chalk.red(`  * ${error}`));
        });
        console.error(chalk.red('\nPlease choose a different project name.'));
        process.exit(1);
    }

    // TODO: there should be a single place that holds the dependencies
    const dependencies = ['react', 'react-dom', 'react-scripts'].sort();
    if (dependencies.includes(appName)) {
        console.error(
            chalk.red(
                `Cannot create a project named ${chalk.green(
                    `"${appName}"`
                )} because a dependency with the same name exists.\n` +
                `Due to the way npm works, the following names are not allowed:\n\n`
            ) +
            chalk.cyan(dependencies.map(depName => `  ${depName}`).join('\n')) +
            chalk.red('\n\nPlease choose a different project name.')
        );
        process.exit(1);
    }

    // create a directory
    try {
        fs.mkdirSync(appName)
    } catch (error) {
        console.error(
            chalk.red(
                `Cannot create a project named ${chalk.green(
                    `"${appName}"`
                )}\n\n`) +
            chalk.cyan(error) +
            chalk.red('\n\nPlease choose a different project name.')
        )
        process.exit(1);
    }
}


function createApp(projectName) {
    const nodeVersionInfo = checkNodeVersion()
    const npmInfo = checkNpmVersion()
    if (!npmInfo.hasMinNpm) {
        if (npmInfo.npmVersion) {
            console.log(
                chalk.yellow(
                    `You are using npm ${npmInfo.npmVersion} so the project will be bootstrapped with an old unsupported version of tools.\n\n` +
                    `Please update to npm 6 or higher for a better, fully supported experience.\n`
                )
            );
        }
    }
    const root = path.resolve(projectName);
    const appName = path.basename(root);

    checkAppName(appName)
    fs.ensureDirSync(projectName);
    console.log()
    console.log(chalk.yellow(`Creating a new SFx React app in ${chalk.green(root)}.`));
    console.log(
        `\n  current version of ${packageJson.name}: ${packageJson.version} `
    );
    console.log()
    packTemplate().then(({ packageJson, appConfigJson }) => {
        unpackTemplate(root).then(() => {
            spinner.succeed(`Create the project from the template successfully`)
            customAppConfig(appName, packageJson, appConfigJson, root).then(() => {
                console.log()
                console.log('Installing packages. This might take a couple of minutes.');
                console.log()
                const semver = nodeVersionInfo.split('.');
                const nodeSassVersion = semver[0] > 14 ? "5.0.0" : "4.14.1";
                install(root, nodeSassVersion).then(() => {
                    console.log();
                    console.log(`Success! Created ${appName} at ${root} `);
                    console.log();
                    console.log('We suggest that you begin by typing:');
                    console.log();
                    console.log(chalk.cyan('cd'), appName);
                    console.log(`  ${chalk.cyan(`npm start`)} `);
                    console.log();
                }).catch(reason => {
                    console.log()
                    console.log('Aborting installation.');
                    if (reason.command) {
                        console.log(`  ${chalk.cyan(reason.command)} has failed.`);
                        console.log('We suggest that you can try to do that :');
                        console.log(`1. please follow below link to config your local ${chalk.cyan('.npmrc')} file`)
                        console.log(`${chalk.cyan('https://dev.azure.com/hexagonsf/platform/_packaging?_a=connect&feed=SFxPackageLib')}`)
                        console.log(`2. please follow the command to install the dependencies`)
                        if (!dartSassCompile) {
                            console.log(`${chalk.cyan(`npm install node-sass@${nodeSassVersion} --save-exact`)} `)
                            console.log(`${chalk.cyan('npm rebuild node-sass')} `)
                        } else {
                            console.log(`${chalk.cyan('npm install sass')} `)
                        }

                        console.log(`${chalk.cyan('npm install')} `)
                    } else {
                        console.log(
                            chalk.red('Unexpected error. Please report it as a bug:')
                        );
                        console.log(reason);
                    }
                    try {
                        // On 'exit' we will delete these files from target directory.
                        const node_modules = fs.readdirSync(path.join(root, 'node_modules'));
                        if (node_modules.length) {
                            spinner.start(`Deleting generated file...${chalk.cyan('node_modules')} `)
                            fs.removeSync(path.join(root, 'node_modules'));
                        }
                        spinner.succeed('Done.')
                        process.exit(1);
                    } catch (error) {
                        process.exit(1);
                    }
                })
            })
        })
    })
}

module.exports = createApp(projectName)