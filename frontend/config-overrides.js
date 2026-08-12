module.exports = function override(config, env) {
  // Find the CSS rule and modify it to disable PostCSS
  const cssRule = config.module.rules.find(rule => 
    rule.test && rule.test.toString().includes('css')
  );
  
  if (cssRule) {
    // Remove PostCSS loader from the CSS processing chain
    cssRule.use = cssRule.use.filter(loader => 
      !loader.loader || !loader.loader.includes('postcss-loader')
    );
  }
  
  return config;
}
