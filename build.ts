import { build } from "esbuild";
import { inlineWorkerPlugin } from "@aidenlx/esbuild-plugin-inline-worker";
import inlineImportPlugin from "esbuild-plugin-inline-import";

await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  minify: false,
  sourcemap: true,
  plugins: [
    inlineImportPlugin(),
    inlineWorkerPlugin({
      watch: true,
      buildOptions: async (ctx, resolve) => {
        return {
          sourcemap: true,
        };
      },
    }),
  ],
  outfile: "dist/main.user.js",
  format: "iife",
  target: "esnext",
});

console.log(new Date(), "+ Build complete");
