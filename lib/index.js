#!/usr/bin/env node
"use strict";

const fs = require('fs');
const fsp = require('fs-promise');
const chalk = require('chalk');
const program = require('commander');
const exec = require('child-process-promise').exec;
const spawn = require('child_process').spawn;
const fp = require('lodash/fp');
const moment = require('moment');

const defaultDockerComposeFile = 'docker/docker-compose.yml';
const noSyncDockerComposeFile = 'docker/docker-compose-no-sync.yml';

async function containerIdForName(name) {
  const cmd = await exec(`docker ps -q -f name=${ name }`);
  return cmd.stdout.trim();
}

async function containerIsRunning(name) {
  const containerId = await containerIdForName(name);
  return containerId !== '';
}

async function hasDockerComposeFiles() {
  return await fsp.exists('docker');
}

async function spawnDC(args, container, requireRunning = true) {
  return run(spawn, args, container, requireRunning);
}

async function execDC(args, container, requireRunning = true) {
  return run(exec, args, container, requireRunning);
}

async function run(func, args, container, requireRunning = true) {
  const isValid = await hasDockerComposeFiles();

  if(!isValid) {
    console.log(chalk.red('There are no docker-compose files to run. Are you in the right directory?'));
    console.log(chalk.red('You must run this from the'), chalk.yellow('in-spiritus'), chalk.red('project root.'));
    process.exit(1);
    return;
  }

  const isRunning = await containerIsRunning(container);
  if(isRunning || !requireRunning) {
    if(isRunning) {
      console.log(chalk.green('Executing on', container));
    }
    return func('docker-compose', args, { stdio: 'inherit' });
  } else {
    console.log(chalk.yellow(`The ${container} container does not seem to be running. Try to serve and then try again.`), chalk.green('$ is serve'));
    console.log(chalk.yellow('Run', chalk.green('$ is --help'), 'for more info'));
    console.log(chalk.yellow('If the containers failed to shut down, use the kill command'), chalk.green('$ is kill'));
  }
}

async function spawnDocker(args, container, requireRunning = true) {
  const isValid = await hasDockerComposeFiles();

  if(!isValid) {
    console.log(chalk.red('There are no docker-compose files to run. Are you in the right directory?'));
    console.log(chalk.red('You must run this from the'), chalk.yellow('in-spiritus'), chalk.red('project root.'));
    process.exit(1);
    return;
  }

  const isRunning = await containerIsRunning(container);
  if(isRunning || !requireRunning) {
    if(isRunning) {
      console.log(chalk.green('Executing on', container));
    }
    return spawn('docker', args, { stdio: 'inherit' });
  } else {
    console.log(chalk.yellow(`The ${container} container does not seem to be running. Try to serve and then try again.`), chalk.green('$ is serve'));
    console.log(chalk.yellow('Run', chalk.green('$ is --help'), 'for more info'));
    console.log(chalk.yellow('If the containers failed to shut down, use the kill command'), chalk.green('$ is kill'));
  }
}

program
  .version('0.0.6')
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
    spawnDC(['-f', defaultDockerComposeFile, 'kill'], undefined, false);
  });

program
  .command('console')
  .alias('c')
  .description('Starts a rails console on the web container')
  .action(async () => {
    spawnDC(['-f', defaultDockerComposeFile, 'exec', 'web', 'rails', 'c'], 'web');
  });

program
  .command('zeus [options...]')
  .description('Run zeus commands on the zeus container. *Note, flags are not allowed.')
  .action(options => {
    const args = fp.flattenDeep([['-f', defaultDockerComposeFile, 'exec', 'zeus', 'zeus'], options]);
    spawnDC(args, 'zeus');
  });

program
  .command('pry')
  .description('Attach to the web container to use pry')
  .action(async () => {
    const containerId = await containerIdForName('web');
    spawnDocker(['attach', containerId], 'web');
  });

program
  .command('bash')
  .alias('b')
  .description('Starts a bash shell in the container. Defaults to web container.')
  .option('-c, --container <container>', 'The container to connect to.')
  .action(options => {
    const container = options.container || 'web';
    spawnDC(['-f', defaultDockerComposeFile, 'exec', container, 'bash'], container);
  });

program
  .command('tail [log]')
  .description('Tail logs. Defaults to web container.')
  .option('-c, --container <container>', 'The container to connect to and tail.')
  .option('-p, --path <path>', 'The path to prepend the file name to tail.')
  .action((log, options) => {
    const logFile = log || 'development';
    const container = options.container || 'web';
    const path = options.path || './log/';
    const fullPath = options.path || `${path}${logFile}.log`;
    spawnDC(['-f', defaultDockerComposeFile, 'exec', container, 'tail', '-f', fullPath], container);
  });

program
  .command('psql')
  .description('Starts a psql session on the db contianer')
  .action(() => {
    spawnDC(['-f', defaultDockerComposeFile, 'exec', 'db', 'psql', '-U', 'postgres'], 'db');
  });

program
  .command('stellar [options...]')
  .description('Run stellar commands on the python container. *Note, flags are not allowed. For full use of the stellar command, open a shell using is bash')
  .action(options => {
    const args = fp.flattenDeep([['-f', defaultDockerComposeFile, 'exec', 'python', 'stellar'], options]);
    spawnDC(args, 'python');
  });

program
  .command('snapshot [filename]')
  .description('Create a snapshot of the dev db')
  .action(async name => {
    name = name || `in-spiritus-${moment().unix()}`

    const cmd = await spawnDC([
        '-f', defaultDockerComposeFile,
        'exec', '-T', 'python',
        'stellar', 'snapshot', name
      ], 'python');

    cmd.on('close', () => {
      console.log(chalk.yellow('Created new snapshot:'), chalk.red(name));
      console.log(chalk.yellow('To restore run:'), chalk.red(`is restore ${name}`));
    });
  });

program
  .command('restore [name]')
  .description('Restore in_spiritus db to specified snapshot')
  .action(async name => {
    if(!name) {
      console.log(chalk.red('You must specify a name'));
      process.exit(1);
      return;
    }

    console.log(chalk.yellow('Restoring in_spiritus db to:'), chalk.red(name));
    console.log(chalk.yellow('This may take awhile'));

    const cmd = await spawnDC(['-f', defaultDockerComposeFile,
        'exec', 'python',
        'stellar', 'restore', name
      ], 'python');

    cmd.on('close', () => {
      console.log(chalk.green('DB in_spiritus has been restored from snapshot:'), chalk.red(name));
    });
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
  .description('Drop db, runs rake db:reset')
  .action(() => {
    spawnDC(['-f', defaultDockerComposeFile, 'exec', 'web', 'rake', 'db:reset'], 'web');
  });

program
  .command('wipe')
  .description('Wipe all data and reseed without dropping')
  .action(() => {
    spawnDC(['-f', defaultDockerComposeFile, 'exec', 'web', 'rake', 'clean:all'], 'web');
  });

program
  .command('rails [options...]')
  .description('Run rails commands on the web container. *Note, flags are not allowed. For full use of the rails command, open a shell using is bash')
  .action(options => {
    const args = fp.flattenDeep([['-f', defaultDockerComposeFile, 'exec', 'web', 'rails'], options]);
    spawnDC(args, 'web');
  });

program
  .command('rake [options...]')
  .description('Run rake commands on the web container. *Note, flags are not allowed. For full use of the rails command, open a shell using is bash')
  .action(options => {
    const args = fp.flattenDeep([['-f', defaultDockerComposeFile, 'exec', 'web', 'rake'], options]);
    spawnDC(args, 'web');
  });

program
  .command('test')
  .alias('t')
  .description('Run test suite')
  .action(options => {
    spawnDC(['-f', defaultDockerComposeFile, 'exec', 'web', 'rake', 'test'], 'web');
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
    console.log('    $ is snapshot MY_SNAPSHOT');
    console.log('    $ is restore MY_SNAPSHOT');
    console.log('    $ is kill');
    console.log('    $ is rails g model Post title description date:datetime');
    console.log('    $ is rake test');
    console.log('    $ is rake db:rollback');
    console.log('    $ is wipe');
    console.log('    $ is tail');
    console.log('    $ is tail xero');
    console.log('');
  });

program.parse(process.argv);

if (!program.args.length) {
  program.help();
}
