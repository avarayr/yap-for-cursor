import { build } from "esbuild";
import { inlineWorkerPlugin } from "@aidenlx/esbuild-plugin-inline-worker";

await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  minify: false,
  sourcemap: true,
  plugins: [
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
