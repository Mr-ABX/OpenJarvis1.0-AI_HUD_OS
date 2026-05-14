#!/bin/bash
echo "Starting J.A.R.V.I.S..."

# Pull latest changes from git
echo "Pulling latest code..."
git pull origin main

echo "Installing Node.js dependencies..."
npm install

echo "Starting Hybrid Node/Python Server..."
echo "J.A.R.V.I.S is running. Press Ctrl+C to stop."
npm run dev

