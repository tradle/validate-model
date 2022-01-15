#!/usr/bin/env node

const path = require('path')
const argv = require('minimist')(process.argv.slice(2), {
  default: {
    'depends-on': ['@tradle/models']
  }
})

const pathToModels = path.resolve(process.cwd(), process.argv[2])
const custom = require(pathToModels)
const merger = require('@tradle/merge-models')
const merge = merger()

console.log('validating model set:')
;[].concat(argv['depends-on']).forEach(dep => {
  console.log(`adding dependency: ${dep}`)
  const depModule = require(dep)
  merge.add(depModule.models || depModule, { validate: true })
})

console.log(`adding custom set: ${pathToModels}`)
merge.add(custom)
merge.get()
