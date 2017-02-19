const validateModel = require('./lib/model')
const validateReferences = require('./lib/refs')
const validateProperty = require('./lib/property')
const { updateErrorWithMessage, handleError } = require('./lib/utils')

exports = module.exports = validate
exports.model = validateModel
exports.refs = validateReferences
exports.property = validateProperty

function validate (models) {
  if (!Array.isArray(models)) {
    return validateModel(models)
  }

  models.forEach(model => {
    try {
      validateModel(model)
    } catch (err) {
      err = updateErrorWithMessage(err, `invalid model "${model.id}": ${err.message}`)
      handleError(err)
    }
  })

  validateReferences({ models })
}
