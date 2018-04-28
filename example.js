const baseModels = require('@tradle/models').models
const validate = require('./')
const nameModel = {
  type: 'tradle.Model',
  id: 'com.example.Name',
  title: 'Name',
  properties: {
    fullName: {
      type: 'string'
    },
    nickName: {
      type: 'string'
    }
  },
  required: ['nickName']
}

// validate a property
validate.property({ model: nameModel, propertyName: 'nickName' })

// validate a model
validate.model(nameModel)

// validate all models and their cross-references
const mergedModels = Object.assign({}, baseModels, { [nameModel.id]: nameModel })
validate(mergedModels)
