/**
 * PM2 Application Declaration
 * http://pm2.keymetrics.io/docs/usage/application-declaration/
 */

module.exports = {
  apps: [
    {
      name: "cp-platform",
      // Directly execute Next.js CLI binary from node_modules for clean signal forwarding
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000 -H 0.0.0.0",
      cwd: "./",
      // Set instances to "max" (all available CPU cores) or specify number via PM2_INSTANCES env var
      instances: process.env.PM2_INSTANCES || "max",
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      // Graceful shutdown and reload timeouts
      kill_timeout: 5000,
      listen_timeout: 10000,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "0.0.0.0",
      },
      env_development: {
        NODE_ENV: "development",
        PORT: 3000,
        HOSTNAME: "0.0.0.0",
      },
    },
    {
      name: "cp-platform-dev",
      script: "node_modules/next/dist/bin/next",
      args: "dev -p 3000 -H 0.0.0.0",
      cwd: "./",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "development",
        PORT: 3000,
        HOSTNAME: "0.0.0.0",
      },
    },
  ],
};
