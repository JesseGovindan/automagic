#!/bin/bash
# Source nvm
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
nvm use
exec npm run start -- --daemon
