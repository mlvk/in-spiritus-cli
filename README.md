## In Spiritus CLI

A simple cli wrapper to help manage dev of [in-spiritus](https://github.com/mlvk/in-spiritus)
It manages starting and stopping of containers, and provides some simple shortcuts

### Installation

`npm install -g mlvk/in-spiritus-cli`

### Usage

1. `is s` - Start the docker containers
1. `is console` - Start a rails console on the web container
1. `is bash` - Start a bash shell on the web container
1. `is migrate` - Run any pending rails migrations on the web container
1. `is psql` - Connect to postgres
1. `is redis` - Connect to redis
1. `is rails [options]` - Run rails commands
1. `is rake [options]` - Run rake commands

### Troubleshooting

In case the containers are not stopped properly when `CTRL + c` is used. Try running the `kill` command.
`is kill`

### Development/Building

1. `npm install`
1. `./node_modules/.bin/babel lib -d .`
