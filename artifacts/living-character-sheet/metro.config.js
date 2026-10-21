const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
	/.*[\\/]test-results[\\/].*/,
	/.*[\\/]playwright-report[\\/].*/,
	/.*[\\/]\.playwright-artifacts-[^\\/]+[\\/].*/,
];

module.exports = config;
