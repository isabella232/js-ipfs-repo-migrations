'use strict'

const Key = require('interface-datastore').Key
const _set = require('just-safe-set')
const uint8ArrayFromString = require('uint8arrays/from-string')
const { createStore } = require('../../../src/utils')

const CONFIG_KEY = new Key('config')
const NEW_API_ADDRESS = '/ip6/::/tcp/5001'

/**
 * EXAMPLE MIGRATION
 * =================
 *
 * Shows how to update config values. Migrate:
 * 1) Changes 'Addresses.API' to Array with new IPv6 localhost
 * 2) Changes 'Gateway.HTTPHeaders.Access-Control-Allow-Origin' to specific origin
 */

function addNewApiAddress (config) {
  let apiAddrs = config.Addresses.API

  if (!Array.isArray(apiAddrs)) {
    apiAddrs = [apiAddrs]
  }

  if (apiAddrs.includes(NEW_API_ADDRESS)) {
    return
  }
  apiAddrs.push(NEW_API_ADDRESS)
  config.Addresses.API = apiAddrs

  return config
}

function removeNewApiAddress (config) {
  const apiAddrs = config.Addresses.API

  if (!Array.isArray(apiAddrs)) {
    return config
  }

  if (apiAddrs.length > 2) {
    throw new Error('Not possible to revert as Addresses.API has more then 2 address, not sure what to do.')
  }

  if (!apiAddrs.includes(NEW_API_ADDRESS)) {
    throw new Error('Not possible to revert as Addresses.API has unknown address, not sure what to do.')
  }

  _set(config, 'Addresses.API', apiAddrs[0] === NEW_API_ADDRESS ? apiAddrs[1] : apiAddrs[0])

  return config
}

async function migrate (repoPath, repoOptions, onProgress) {
  const store = await createStore(repoPath, 'root', repoOptions)
  await store.open()

  try {
    const rawConfig = await store.get(CONFIG_KEY)
    let config = JSON.parse(rawConfig.toString())

    // Convert Address.API to Array with new IPv6 localhost
    config = addNewApiAddress(config)

    // Modify allowed origin
    _set(config, 'Gateway.HTTPHeaders.Access-Control-Allow-Origin', 'some.origin.com')

    const buf = uint8ArrayFromString(JSON.stringify(config, null, 2))
    await store.put(CONFIG_KEY, buf)
  } finally {
    await store.close()
  }

  onProgress(100, 'done!')
}

async function revert (repoPath, repoOptions, onProgress) {
  const store = await createStore(repoPath, 'root', repoOptions)
  await store.open()

  try {
    const rawConfig = await store.get(CONFIG_KEY)
    let config = JSON.parse(rawConfig.toString())

    // If possible revert to previous value
    config = removeNewApiAddress(config)

    // Reset origin
    _set(config, 'Gateway.HTTPHeaders.Access-Control-Allow-Origin', '*')

    const buf = uint8ArrayFromString(JSON.stringify(config, null, 2))
    await store.put(CONFIG_KEY, buf)
  } finally {
    await store.close()
  }

  onProgress(100, 'done!')
}

module.exports = {
  version: 2,
  description: 'Updates config',
  migrate,
  revert,
  newApiAddr: NEW_API_ADDRESS
}
