#!/bin/bash

# Change ownership of the directory
sudo chown -R ubuntu:ubuntu /home/ubuntu/SportsFirst-backend

# Navigate to the application directory
cd /home/ubuntu/SportsFirst-backend
# Install dependencies
npm install --legacy-peer-deps -f