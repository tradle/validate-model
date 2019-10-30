const validateModel = require('./lib/model')
const validateReferences = require('./lib/refs')
const validateProperty = require('./lib/property')
const utils = require('./lib/utils')
const { updateErrorWithMessage, handleError } = utils

exports = module.exports = validate
exports.model = validateModel
exports.refs = validateReferences
exports.property = validateProperty
exports.utils = utils
exports.StubModel = require('./lib/stub-model')
exports.ObjectModel = require('./lib/object-model')

function validate (models) {
  if (!Array.isArray(models)) {
    if (isModel(models)) {
      return validateModel(models)
    }

    // convert to array
    models = Object.keys(models).map(id => models[id])
  }

  models.forEach(model => {
    try {
      validateModel(model, models)
    } catch (err) {
      err = updateErrorWithMessage(err, `invalid model "${model.id}": ${err.message}`)
      handleError(err)
    }
  })

  validateReferences({ models })
}

function isModel (obj) {
  return obj.type === 'tradle.Model' &&
    (obj.properties && typeof obj.properties === 'object') &&
    typeof obj.id === 'string'
}
