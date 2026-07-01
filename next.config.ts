import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js spawns Node workers and loads wasm at runtime — keep it out
  // of the Server Components bundle so it uses native require().
  serverExternalPackages: ["tesseract.js"],
  experimental: {
    serverActions: {
      // Records accept up to 5 attachments of 10 MB each. The default 1 MB
      // Server Action body limit would reject those uploads (the record would
      // appear to save while the files silently fail), so raise it to cover
      // the maximum payload plus form-field overhead.
      bodySizeLimit: "55mb",
    },
  },
};

export default nextConfig;
