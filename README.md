## In Spiritus CLI

A simple cli wrapper to help manage dev of [in-spiritus](https://github.com/mlvk/in-spiritus)
It manages starting and stopping of containers, and provides some simple shortcuts

### Installation

`npm install -g mlvk/in-spiritus-cli`

### Usage

1. `is s` - Start the docker containers
1. `is console` - Start a rails console on the web container
1. `is pry` - Attaches to the web container to allow for pry sessions
1. `is bash` - Start a bash shell on the web container
1. `is migrate` - Run any pending rails migrations on the web container
1. `is psql` - Connect to postgres
1. `is redis` - Connect to redis
1. `is reset` - Run rake commands
1. `is wipe` - Run rake commands
1. `is rails [options]` - Run rails commands
1. `is rake [options]` - Run rake commands
1. `is tail [log]` - Tail a log file with -f, defaults to the development log

### Using pry
To enter a pry debugging session, you can set `binding.pry` as usual in your code.
Then open a new terminal and navigate to the project root.
Run: `is pry` to attach to the container.
To stop the session, you can use to standard [docker attach options](https://docs.docker.com/engine/reference/commandline/attach/)

1. To leave the container running: `CTRL-p CTRL-q` key sequence
1. To stop the container: `CTRL-c`

### Troubleshooting

In case the containers are not stopped properly when `CTRL + c` is used. Try running the `kill` command.
`is kill`

### Development/Building

1. `npm install`
1. `./node_modules/.bin/babel lib -d .`
