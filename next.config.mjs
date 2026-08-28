/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: import.meta.dirname,
  turbopack: {
    root: import.meta.dirname
  }
};

export default nextConfig;
