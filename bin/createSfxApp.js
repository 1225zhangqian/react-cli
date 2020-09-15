#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const packageJson = require('../package.json');
const chalk = require('chalk');
const commander = require('commander');
const unpack = require('tar-pack').unpack;
const pack = require('tar-pack').pack;
const os = require('os');
const inquirer = require('inquirer')

var currentNodeVersion = process.versions.node;
var semver = currentNodeVersion.split('.');
var major = semver[0];

if (major < 10) {
    console.error(
        'You are running Node ' +
        currentNodeVersion +
        '.\n' +
        'Create my App requires Node 10 or higher. \n' +
        'Please update your version of Node.'
    );
    process.exit(1);
}

const rootDir = path.join(__dirname, '..');
const packagesDir = path.join(rootDir, 'my-template');
const scriptsPath = path.join(packagesDir, `/solution-stater-${packageJson.version}.tar.gz`);
// Now run the CRA command
let projectName;

const program = new commander.Command(packageJson.name)
    .version(packageJson.version)
    .arguments('<solution name>')
    .usage(`${chalk.green('<solution name>')} [options]`)
    .action(name => {
        projectName = name;
    })
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

function packTemplate() {
    return new Promise(resolve => {
        // Pack my-template.
        console.log()
        console.log('Pack my-template')
        console.log()
        pack(path.join(packagesDir, 'template'))
            .pipe(fs.createWriteStream(scriptsPath))
            .on('error', function (err) {
                console.error(err.stack)
                reject(err);
            })
            .on('close', function () {
                console.log('Pack my-template successfully')
                resolve()
            })

    })

}
function unpackTemplate(root, packageJson) {
    return new Promise(resolve => {
        //  unPack my-template into directory
        fs.createReadStream(scriptsPath).pipe(unpack(root)).on('error', function (err) {
            console.error(err.stack)
            reject(err);
        }).on('close', function () {
            const json = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
            packageJson = { ...json, ...packageJson }
            fs.writeFileSync(
                path.join(root, 'package.json'),
                JSON.stringify(packageJson, null, 2) + os.EOL
            );

            const appConfigJsonDir = path.join(root, 'public', 'config')
            const appConfigJson = JSON.parse(fs.readFileSync(path.join(appConfigJsonDir, 'app.config.json')))
            resolve({ appConfigJsonDir, appConfigJson })
        })
    })
}
function customAppConfig(appName, appConfigJsonDir, appConfigJson) {

    return new Promise(resolve => {
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
                default: packageJson.version,
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

        inquirer
            .prompt(question).then(answers => {
                let Scope = { Scope: `openid profile email platform.${answers.ClientId || "[clientId]"}` }
                let appConfigFileJson = { ...appConfigJson, ...answers, ...Scope, ...{ SolutionTitle: appName, SolutionShortTitle: appName } }
                fs.writeFileSync(
                    path.join(appConfigJsonDir, 'app.config.json'),
                    JSON.stringify(appConfigFileJson, 'utf-8', err => {
                        if (err) {
                            reject(err);
                        }
                    })
                );
                console.log('\n')
                console.log(chalk.green('Init app.config.json successfully\n'))
                console.log(chalk.grey('The latest app.config.json is: \n'))
                console.log(appConfigFileJson)
                console.log('\n')
                resolve();
            })
    });

}

function createApp(projectName) {
    const root = path.resolve(projectName);
    const appName = path.basename(root);
    console.log()
    console.log(`Creating a new my React app in ${chalk.green(root)}.`);
    console.log()

    let packageJson = {
        name: appName,
    };
    // create a directory
    fs.mkdir(projectName, function (error) {
        if (error) {
            console.log(error);
            return false;
        }
    })
    packTemplate().then(() => {
        unpackTemplate(root, packageJson).then(({ appConfigJsonDir, appConfigJson }) => {
            customAppConfig(appName, appConfigJsonDir, appConfigJson).then(() => {
                console.log()
                console.log('Installing packages. This might take a couple of minutes.');
                console.log()
                cp.execSync(
                    `npm install --registry=[your own registry]"`,
                    {
                        cwd: root,
                        stdio: 'inherit',
                    }
                );

                console.log();
                console.log(`Success! Created ${appName} at ${root}`);
                console.log();
                console.log('We suggest that you begin by typing:');
                console.log();
                console.log(chalk.cyan('  cd'), root);
                console.log(`  ${chalk.cyan(`npm start`)}`);
                console.log();
            }).catch(err => {
                console.log(err)
            })
        })
    })

}

module.exports = createApp(projectName)