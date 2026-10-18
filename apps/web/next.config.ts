import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: false,
  transpilePackages: ['@diagramz/shared'],
  webpack: (config, { webpack }) => {
    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env.IS_PREACT': JSON.stringify('false'),
      }),
    );
    return config;
  },
  async rewrites() {
    const rawEnv =
      process.env.BACKEND_PROXY_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.startsWith('http')
        ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/v1\/?$/, '')
        : null) ||
      'http://diagramz.runasp.net';
    const backendUrl = rawEnv.replace(/\/api\/v1\/?$/, '');

    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
