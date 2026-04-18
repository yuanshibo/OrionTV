module.exports = function (api) {
  api.cache(true);
  
  const plugins = [];
  
  // 在生产环境移除console调用以优化性能，但保留 error 和 warn
  if (process.env.NODE_ENV === 'production') {
    plugins.push([
      'transform-remove-console',
      {
        exclude: ['error', 'warn'],
      },
    ]);
  }
  
  return {
    presets: ['babel-preset-expo'],
    plugins: plugins,
  };
};
