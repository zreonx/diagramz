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
    const backendUrl =
      process.env.BACKEND_PROXY_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      'http://diagramz.runasp.net';

    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
