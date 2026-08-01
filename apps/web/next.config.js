/** @type {import('next').NextConfig} */
const nextConfig = {
  // The local admin runner uses a separate build directory so a verification
  // build cannot overwrite assets used by the running development server.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@jobman/shared'],
  images: {
    domains: ['firebasestorage.googleapis.com', 'lh3.googleusercontent.com'],
  },
};

module.exports = nextConfig;
