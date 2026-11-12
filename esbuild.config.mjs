import { builtinModules } from "node:module";
import process from "node:process";
import esbuild from "esbuild";

const production = process.argv[2] === "production";

const options = {
	entryPoints: ["main.ts"],
	bundle: true,
	format: "cjs",
	target: "es2021",
	outfile: "main.js",
	external: ["obsidian", "electron", ...builtinModules],
	sourcemap: production ? false : "inline",
	minify: production,
	logLevel: "info",
};

if (production) {
	await esbuild.build(options);
} else {
	const context = await esbuild.context(options);
	await context.watch();
}
