import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  plugins: [
    {
      name: "test-asset-stub",
      resolveId(source) {
        if (source.startsWith("@assets/")) return `\0asset-stub:${source}`;
        return null;
      },
      load(id) {
        if (id.startsWith("\0asset-stub:")) return 'export default "";';
        return null;
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "artifacts/universe-mode/src"),
      "@workspace/api-client-react": path.resolve(
        import.meta.dirname,
        "lib/api-client-react/src/index.ts",
      ),
      "@workspace/api-zod": path.resolve(
        import.meta.dirname,
        "lib/api-zod/src/index.ts",
      ),
    },
  },
  test: {
    environment: "node",
    include: [
      "artifacts/**/*.test.ts",
      "lib/**/*.test.ts",
    ],
  },
});
