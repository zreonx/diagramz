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
};

export default nextConfig;
