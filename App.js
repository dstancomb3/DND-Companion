const React = require("./artifacts/living-character-sheet/node_modules/react");
const { ExpoRoot } = require("./artifacts/living-character-sheet/node_modules/expo-router");

const ctx = require.context("./artifacts/living-character-sheet/app", true, /\\.[jt]sx?$/);

function App() {
	return React.createElement(ExpoRoot, { context: ctx });
}

module.exports = App;
