#!/usr/bin/env node

const path = require('path')
const baseModels = require('@tradle/models')
const custom = require(path.resolve(process.cwd(), process.argv[2]))
const validate = require('./').models
validate(baseModels.concat(custom))
