module.exports = {
  apps: [
    {
      name: "krewplay-server",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "watch src/server.ts",
      env: {
        NODE_ENV: "development",
      }
    }
  ]
};
