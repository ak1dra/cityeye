/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['langfuse', '@anthropic-ai/sdk'],
};

export default nextConfig;
