/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@jobman/shared'],
  images: {
    domains: ['firebasestorage.googleapis.com', 'lh3.googleusercontent.com'],
  },
};

module.exports = nextConfig;
