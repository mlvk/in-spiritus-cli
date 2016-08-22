#!/usr/bin/env node
let containerIsRunning = (() => {
  var _ref = _asyncToGenerator(function* (name) {
    const cmd = yield exec(`docker ps -q -f name=${ name }`);
    return cmd.stdout !== '';
  });

  return function containerIsRunning(_x) {
    return _ref.apply(this, arguments);
  };
})();

let hasDockerComposeFiles = (() => {
  var _ref2 = _asyncToGenerator(function* () {
    return yield fsp.exists('docker');
  });

  return function hasDockerComposeFiles() {
    return _ref2.apply(this, arguments);
  };
})();

let spawnDC = (() => {
  var _ref3 = _asyncToGenerator(function* (args, container, requireRunning = true) {
    const isValid = yield hasDockerComposeFiles();

    if (!isValid) {
      console.log(chalk.red('There are no docker-compose files to run. Are you in the right directory?'));
      console.log(chalk.red('You must run this from the'), chalk.yellow('in-spiritus'), chalk.red('project root.'));
      process.exit(1);
      return;
    }

    const isRunning = yield containerIsRunning(container);
    if (isRunning || !requireRunning) {
      if (isRunning) {
        console.log(chalk.green('Executing on', container));
      }
      return spawn('docker-compose', args, { stdio: 'inherit' });
    } else {
      console.log(chalk.yellow(`The ${ container } container does not seem to be running. Try to serve and then try again.`), chalk.green('$ is serve'));
      console.log(chalk.yellow('Run', chalk.green('$ is --help'), 'for more info'));
      console.log(chalk.yellow('If the containers failed to shut down, use the kill command'), chalk.green('$ is kill'));
    }
  });

  return function spawnDC(_x2, _x3, _x4) {
    return _ref3.apply(this, arguments);
  };
})();

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { return step("next", value); }, function (err) { return step("throw", err); }); } } return step("next"); }); }; }

const fsp = require('fs-promise');
const chalk = require('chalk');
const program = require('commander');
const exec = require('child-process-promise').exec;
const spawn = require('child_process').spawn;
const fp = require('lodash/fp');

const defaultDockerComposeFile = 'docker/docker-compose.yml';
const noSyncDockerComposeFile = 'docker/docker-compose-no-sync.yml';

program.version('0.0.4').command('serve').alias('server').alias('s').option('-n, --no-sync', "Don't start the syncing containers, sidekiq and worker").description('Start all docker containers').action((() => {
  var _ref4 = _asyncToGenerator(function* (options) {
    let cmd;
    if (options.sync) {
      cmd = yield spawnDC(['-f', defaultDockerComposeFile, 'up'], undefined, false);
    } else {
      cmd = yield spawnDC(['-f', noSyncDockerComposeFile, 'up'], undefined, false);
    }

    process.on('close', function () {
      process.exit(1);
    });

    function exitHandler(options, err) {
      cmd.kill('SIGINT');
    }

    process.on('exit', exitHandler.bind(null));
    process.on('SIGINT', exitHandler.bind(null));
  });

  return function (_x5) {
    return _ref4.apply(this, arguments);
  };
})());

program.command('kill').alias('k').description('Kill all containers').action(() => {
  spawnDC(['-f', defaultDockerComposeFile, 'kill']);
});

program.command('console').alias('c').description('Starts a rails console on the web container').action(_asyncToGenerator(function* () {
  spawnDC(['-f', defaultDockerComposeFile, 'exec', 'web', 'rails', 'c'], 'web');
}));

program.command('bash').alias('b').description('Starts a bash shell in the container. Defaults to web container.').option('-c, --container <container>', 'The container to connect to.').action(options => {
  container = options.container || 'web';
  spawnDC(['-f', defaultDockerComposeFile, 'exec', container, 'bash'], container);
});

program.command('psql').description('Starts a psql session on the db contianer').action(() => {
  spawnDC(['-f', defaultDockerComposeFile, 'exec', 'db', 'psql', '-U', 'postgres'], 'db');
});

program.command('migrate').description('Runs pending db migrations').action(() => {
  spawnDC(['-f', defaultDockerComposeFile, 'exec', 'web', 'rake', 'db:migrate'], 'web');
});

program.command('redis').description('Starts a redis-cli session on the redis container').action(() => {
  spawnDC(['-f', defaultDockerComposeFile, 'exec', 'redis', 'redis-cli'], 'redis');
});

program.command('reset').description('Reset all data').action(() => {
  spawnDC(['-f', defaultDockerComposeFile, 'exec', 'web', 'rake', 'db:reset'], 'web');
});

program.command('rails [options...]').description('Run rails commands on the web container. *Note, flags are not allowed. For full use of the rails command, open a shell using is bash').action(options => {
  const args = fp.flattenDeep([['-f', defaultDockerComposeFile, 'exec', 'web', 'rails'], options]);
  spawnDC(args, 'web');
});

program.on('--help', function () {
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
  console.log('    $ is rails g model Post title description date:datetime');
  console.log('');
});

program.parse(process.argv);

if (!program.args.length) {
  program.help();
}