#!/usr/bin/env node

const chalk = require('chalk');
const program = require('commander');
const exec = require('child-process-promise').exec;
const spawn = require('child_process').spawn;

const defaultDockerComposeFile = 'docker/docker-compose.yml';
const noSyncDockerComposeFile = 'docker/docker-compose-no-sync.yml';

async function containerIsRunning(name) {
  const cmd = await exec(`docker ps -q -f name=${ name }`);
  return cmd.stdout !== '';
}

async function spawnDC(args, container, requireRunning = true) {
  const isRunning = await containerIsRunning(container);
  if(isRunning || !requireRunning) {
    if(isRunning) {
      console.log(chalk.green('Executing on', container));
    }
    return spawn('docker-compose', args, { stdio: 'inherit' });
  } else {
    console.log(chalk.yellow(`The ${container} container does not seem to be running. Try to serve and then try again.`), chalk.green('$ is serve'));
    console.log(chalk.yellow('Run', chalk.green('$ is --help'), 'for more info'));
    console.log(chalk.yellow('If the containers failed to shut down, use the kill command'), chalk.green('$ is kill'));
  }
}

program
  .command('serve')
  .alias('server')
  .alias('s')
  .option('-n, --no-sync', "Don't start the syncing containers, sidekiq and worker")
  .description('Start all docker containers')
  .action(async options => {
    let cmd;
    if (options.sync) {
      cmd = await spawnDC(['-f', defaultDockerComposeFile, 'up'], undefined, false);
    } else {
      cmd = await spawnDC(['-f', noSyncDockerComposeFile, 'up'], undefined, false);
    }

    process.on('close', () => {
      process.exit(1);
    });

    function exitHandler(options, err) {
      cmd.kill('SIGINT');
    }

    process.on('exit', exitHandler.bind(null));
    process.on('SIGINT', exitHandler.bind(null));
});

program
  .command('kill')
  .alias('k')
  .description('Kill all containers')
  .action(() => {
    spawnDC(['-f', defaultDockerComposeFile, 'kill']);
  });

program
  .command('console')
  .alias('c')
  .description('Starts a rails console on the web container')
  .action(async () => {
    spawnDC(['-f', defaultDockerComposeFile, 'exec', 'web', 'rails', 'c'], 'web');
  });

program
  .command('bash')
  .alias('b')
  .description('Starts a bash shell in the container. Defaults to web container.')
  .option('-c, --container <container>', 'The container to connect to.')
  .action(options => {
    container = options.container || 'web';
    spawnDC(['-f', defaultDockerComposeFile, 'exec', container, 'bash'], container);
  });

program
  .command('psql')
  .description('Starts a psql session on the db contianer')
  .action(() => {
    spawnDC(['-f', defaultDockerComposeFile, 'exec', 'db', 'psql', '-U', 'postgres'], 'db');
  });

program
  .command('migrate')
  .description('Runs pending db migrations')
  .action(() => {
    spawnDC(['-f', defaultDockerComposeFile, 'exec', 'web', 'rake', 'db:migrate'], 'web');
  });

program
  .command('redis')
  .description('Starts a redis-cli session on the redis container')
  .action(() => {
    spawnDC(['-f', defaultDockerComposeFile, 'exec', 'redis', 'redis-cli'], 'redis');
  });

program
  .command('reset')
  .description('Reset all data')
  .action(() => {
    spawnDC(['-f', defaultDockerComposeFile, 'exec', 'web', 'rake', 'db:reset'], 'web');
  });

program
  .on('--help', function () {
    console.log('  Examples:');
    console.log('');
    console.log('    $ is serve');
    console.log('    $ is serve --no-sync');
    console.log('    $ is bash');
    console.log('    $ is bash --help');
    console.log('    $ is psql');
    console.log('    $ is console');
    console.log('    $ is c');
    console.log('    $ is reset');
    console.log('    $ is kill');
    console.log('');
  });

program.parse(process.argv);

if (!program.args.length) {
  program.help();
}
