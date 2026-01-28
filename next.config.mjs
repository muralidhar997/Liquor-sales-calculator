/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { allowedOrigins: [] } },
  webpack: (config) => {
    // pdfjs uses worker files; we load worker from CDN in code, so keep default.
    return config;
  },
};

export default nextConfig;
