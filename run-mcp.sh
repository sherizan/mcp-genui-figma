#!/bin/bash

# Set the working directory to the script's directory
cd "$(dirname "$0")"

# Make sure the server file is executable
chmod +x build/index.js

# Run the server with the correct Node.js version
/Users/{username}/.nvm/versions/node/v23.8.0/bin/node build/index.js 