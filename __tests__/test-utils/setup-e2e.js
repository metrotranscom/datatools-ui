const path = require('path')

const {merge, pick} = require('lodash')
const mkdirp = require('mkdirp')
const auto = require('run-auto')

const {
  collectingCoverage,
  downloadFile,
  isCi,
  isUiRepo,
  loadYamlFile,
  requireEnvVars,
  spawnDetachedProcess,
  writeYamlFile
} = require('./utils')

const serverJarFilename = 'dt-latest-dev.jar'

/**
 * download, configure and start an instance of datatools-server
 */
function startBackendServer () {
  // if running this from the datatools-server repo, skip this step
  if (!isUiRepo) return Promise.resolve()

  return new Promise((resolve, reject) => {
    console.log('prepare to start backend server')

    // get all necessary required environment variables
    try {
      requireEnvVars([
        'AUTH0_CLIENT_ID',
        'AUTH0_DOMAIN',
        'AUTH0_SECRET',
        'AUTH0_TOKEN',
        'OSM_VEX',
        'SPARKPOST_EMAIL',
        'SPARKPOST_KEY'
      ])
    } catch (e) {
      return reject(e)
    }

    const serverFolder = path.join(
      process.env.HOME,
      'conveyal',
      'datatools-server'
    )
    const serverJarFile = path.join(serverFolder, serverJarFilename)
    const envFile = path.join(serverFolder, 'env.yml')
    const serverFile = path.join(serverFolder, 'server.yml')
    const baseDtServerGithubConfigUrl = 'https://raw.githubusercontent.com/conveyal/datatools-server/dev/configurations/default/'

    auto({
      makeServerFolder: callback => {
        console.log('creating directory for server files')
        mkdirp(serverFolder, callback)
      },
      downloadJar: ['makeServerFolder', (results, callback) => {
        console.log('downloading server jar')
        downloadFile(
          `https://s3.amazonaws.com/datatools-builds/${serverJarFilename}`,
          serverJarFile,
          callback
        )
      }],
      downloadEnvTemplate: ['makeServerFolder', (results, callback) => {
        console.log('downloading backend env.yml template')
        downloadFile(
          `${baseDtServerGithubConfigUrl}env.yml.tmp`,
          envFile,
          callback
        )
      }],
      downloadServerTemplate: ['makeServerFolder', (results, callback) => {
        console.log('downloading backend server.yml template')
        downloadFile(
          `${baseDtServerGithubConfigUrl}server.yml.tmp`,
          serverFile,
          callback
        )
      }],
      readEnvTemplate: ['downloadEnvTemplate', (results, callback) => {
        console.log('loading backend env template')
        loadYamlFile(envFile, callback)
      }],
      readServerTemplate: ['downloadServerTemplate', (results, callback) => {
        console.log('loading backend server template')
        loadYamlFile(serverFile, callback)
      }],
      writeEnvFile: ['readEnvTemplate', (results, callback) => {
        console.log('writing backend env.yml')

        writeYamlFile(
          'env.yml',
          merge(
            results.readEnvTemplate,
            pick(
              process.env,
              [
                'AUTH0_CLIENT_ID',
                'AUTH0_DOMAIN',
                'AUTH0_SECRET',
                'AUTH0_TOKEN',
                'OSM_VEX',
                'SPARKPOST_KEY',
                'SPARKPOST_EMAIL'
              ]
            )
          ),
          callback
        )
      }],
      writeServerFile: ['readServerTemplate', (results, callback) => {
        console.log('writing backend server.yml')

        const {
          S3_BUCKET,
          TRANSITFEEDS_KEY
        } = process.env

        const serverEnv = results.readServerTemplate
        serverEnv.application.assets_bucket = S3_BUCKET
        serverEnv.application.data.gtfs_s3_bucket = S3_BUCKET
        serverEnv.extensions.transitfeeds.key = TRANSITFEEDS_KEY
        writeYamlFile(
          'server.yml',
          serverEnv,
          callback
        )
      }],
      startServer: [
        'downloadJar',
        'writeEnvFile',
        'writeServerFile',
        (results, callback) => {
          console.log('starting backend server')

          try {
            spawnDetachedProcess(
              'java',
              [
                '-Xmx6G',
                '-jar',
                serverJarFile,
                envFile,
                serverFile
              ],
              'datatools-server'
            )
          } catch (e) {
            console.error(`error starting datatools-server: ${e}`)
            return callback(e)
          }
          callback()
        }
      ]
    }, (err, results) => {
      if (err) {
        console.error(`failed to start backed server due to error: ${err}`)
        return reject(err)
      }
      console.log('backend server started successfully')
      resolve()
    })
  })
}

/**
 * Perform all necessary actions to start the datatools-ui dev server
 */
function startClientServer () {
  return new Promise((resolve, reject) => {
    console.log('prepare to start client dev server')

    // get all necessary required environment variables
    try {
      requireEnvVars([
        'AUTH0_CLIENT_ID',
        'AUTH0_DOMAIN',
        'E2E_AUTH0_PASSWORD',
        'E2E_AUTH0_USERNAME',
        'GRAPH_HOPPER_KEY',
        'MAPBOX_ACCESS_TOKEN',
        'S3_BUCKET',
        'TRANSITFEEDS_KEY'
      ])
    } catch (e) {
      return reject(e)
    }

    // set the working directories for datatools-ui
    const datatoolsUiDir = path.join(process.env.HOME, 'conveyal', 'datatools-ui')
    const defaultConfigFolder = path.join(
      datatoolsUiDir,
      'configurations',
      'default'
    )

    // asynchronously complete the remaining tasks as they involve a lot of file
    // writing that can be performed asynchronously.
    auto({
      writeE2eEnvYml: callback => {
        console.log('writing e2e env.yml')

        // create e2e config file with valid auth0 login
        // > configurations/end-to-end/env.yml
        writeYamlFile(
          path.join(datatoolsUiDir, 'configurations', 'end-to-end', 'env.yml'),
          {
            password: process.env.E2E_AUTH0_PASSWORD,
            username: process.env.E2E_AUTH0_USERNAME
          },
          callback
        )
      },
      loadDefaultEnvYml: callback => {
        console.log('loading client env.yml template')

        loadYamlFile(path.join(defaultConfigFolder, 'env.yml.tmp'), callback)
      },
      loadDefaultSettingsYml: callback => {
        console.log('loading client settings.yml template')

        loadYamlFile(path.join(defaultConfigFolder, 'settings.yml'), callback)
      },
      writeDefaultEnvYml: ['loadDefaultEnvYml', (results, callback) => {
        console.log('writing client env.yml template')

        writeYamlFile(
          path.join(defaultConfigFolder, 'env.yml'),
          merge(
            results.loadDefaultEnvYml,
            pick(
              process.env,
              [
                'AUTH0_CLIENT_ID',
                'AUTH0_DOMAIN',
                'GRAPH_HOPPER_KEY',
                'MAPBOX_ACCESS_TOKEN'
              ]
            )
          ),
          callback
        )
      }],
      writeDefaultSettingsYml: ['loadDefaultSettingsYml', (results, callback) => {
        console.log('writing client settings.yml template')

        const {
          S3_BUCKET,
          TRANSITFEEDS_KEY
        } = process.env

        const clientSettings = results.loadDefaultSettingsYml
        clientSettings.S3_BUCKET = S3_BUCKET
        clientSettings.application.data.gtfs_s3_bucket = S3_BUCKET
        clientSettings.extensions.transitfeeds.key = TRANSITFEEDS_KEY
        writeYamlFile(
          path.join(defaultConfigFolder, 'settings.yml'),
          clientSettings,
          callback
        )
      }],
      startClientDevServer: [
        'writeE2eEnvYml',
        'writeDefaultEnvYml',
        'writeDefaultSettingsYml',
        (results, callback) => {
          console.log('starting client dev server')

          try {
            spawnDetachedProcess(
              'npm',
              [
                // if working with the ui repo in a CI environment, start the
                // dev server with instrumented code
                isUiRepo ? 'start-instrumented' : 'start',
                '--prefix',
                datatoolsUiDir
              ],
              'client-dev-server'
            )
          } catch (e) {
            console.error(`error starting dev server: ${e}`)
            return callback(e)
          }
          callback()
        }
      ]
    }, (err, results) => {
      if (err) {
        console.error(`failed to start client dev server due to error: ${err}`)
        return reject(err)
      }
      console.log('successfully started client dev server')
      resolve()
    })
  })
}

/**
 * Perform all necessary actions to start the datatools-ui dev server
 */
function startOtp () {
  return new Promise((resolve, reject) => {
    const otpJarFilename = 'otp-1.2.0-shaded.jar'

    console.log('downloading otp jar')

    // download otp
    downloadFile(
      'https://repo1.maven.org/maven2/org/opentripplanner/otp/1.2.0/otp-1.2.0-shaded.jar',
      otpJarFilename,
      err => {
        if (err) return reject(err)

        console.log('starting otp')

        // start otp
        try {
          spawnDetachedProcess(
            'java',
            [
              '-Xmx6G',
              '-jar',
              otpJarFilename,
              '--server',
              '--insecure',
              '--router',
              'default'
            ],
            'otp'
          )
        } catch (e) {
          console.error(`error starting dev server: ${e}`)
          return reject(e)
        }
        console.log('successfully started otp')
        resolve()
      }
    )
  })
}

function setupForCIEnvironment () {
  if (!isCi) return Promise.resolve()

  return Promise.all([
    startBackendServer(),
    startClientServer(),
    startOtp()
  ])
}

/**
 * Start a server to collect coverage from the e2e tests.
 */
function startCoverageServer () {
  if (!collectingCoverage) return Promise.resolve()

  return new Promise((resolve, reject) => {
    console.log('starting coverage server')

    try {
      spawnDetachedProcess(
        'node',
        ['test-utils/e2e-coverage-collector-server.js'],
        'e2e-coverage-collector-server'
      )
    } catch (e) {
      console.error(`error starting coverage server: ${e}`)
      return reject(e)
    }

    console.log('successfully started coverage server')
    resolve()
  })
}

module.exports = function () {
  return Promise.all([
    setupForCIEnvironment(),
    startCoverageServer()
  ])
}