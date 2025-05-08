import findup from 'findup-sync'

const defaultConfig = {
  port: 3000,
  basePath: "",
  cookieSecure: true,
  cookieSameSite: 'lax',
  staticRootPath: './dist'
}

const userConfigPath = findup('bff.config*.js')
console.log('BFF: Using config at', userConfigPath)
const {default: loadConfig} = await import(userConfigPath);
const loadedConfig = await loadConfig()

export const config = {...defaultConfig, ...loadedConfig}
