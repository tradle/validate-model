
const typeforce = require('typeforce')
const validateProperty = require('./property')
const {
  maybeStrings,
  maybeString,
  maybeBool,
  maybeObject,
  maybeObjects,
  updateErrorWithMessage,
  handleError,
  // referencesUnknownModel,
  referencesUnknownProp
} = require('./utils')

const metadataTypes = {
  id: 'String',
  type: 'String',
  title: 'String',
  description: maybeString,
  properties: 'Object',
  subClassOf: maybeString,
  interfaces: maybeStrings,
  required: maybeStrings,
  viewCols: maybeStrings,
  editCols: maybeStrings,
  gridCols: maybeStrings,
  enum: maybeObjects,
  multiEntryForms: maybeStrings,
  hidden: maybeStrings,
  virtual: maybeStrings,
  icon: maybeString,
  inlined: maybeBool,
  forms: maybeStrings,
  additionalForms: maybeStrings,
  evidentiaryDocuments: maybeStrings,
  abstract: maybeBool,
  verifiableAspects: maybeObject,
  sort: maybeString,
  customerCanHaveMultiple: maybeBool,
  isInterface: maybeBool,
  autoCreate: maybeBool,
  verifiable: maybeBool,
  notShareable: maybeBool,
  notEditable: maybeBool,
  plural: maybeString,
  formRequestMessage: maybeString,
  style: maybeObject
}

const subClassValidators = {
  'tradle.FinancialProduct': validateFinancialProductModel,
  'tradle.Form': validateFormModel
}

const enumItemType = typeforce.compile({
  id: 'String',
  title: 'String'
})

const PROTOCOL_PROPERTIES = [
  '_t', // type
  '_s', // sig
  '_n', // seq
  '_q', // prev to recipient
  '_r', // permalink
  '_p'  // prevlink
]

const GROUPS = [
  'required',
  'viewCols',
  'editCols',
  'gridCols',
  'hidden',
  'virtual'
]

function validateModel (model) {
  if (model.type !== 'tradle.Model') {
    throw new Error('expected "type": "tradle.Model"')
  }

  // id
  const idErr = validateModelId(model.id)
  if (idErr) return idErr

  typeforce(metadataTypes, model, true)

  try {
    validateProperties(model)
  } catch (err) {
    err = updateErrorWithMessage(err, `invalid "properties": ${err.message}`)
    handleError(err)
  }

  const { subClassOf, properties, sort, verifiableAspects, customerCanHaveMultiple } = model
  const subClassValidator = subClassOf && subClassValidators[subClassOf]
  if (subClassValidator) subClassValidator(model)

  checkGroups(model)
  if (verifiableAspects) {
    validateVerifiableAspects(model)
  }

  if (sort && !properties[sort]) {
    throw new Error(`"sort" ${referencesUnknownProp(sort)}`)
  }

  if (customerCanHaveMultiple && subClassOf !== 'tradle.FinancialProduct') {
    throw new Error('only subclasses of tradle.FinancialProduct can have the property "customerCanHaveMultiple"')
  }

  if (model.enum) {
    typeforce(typeforce.arrayOf(enumItemType), model.enum)
    if (model.subClassOf !== 'tradle.Enum') {
      throw new Error('models with "enum" property must have "subClassOf": "tradle.Enum"')
    }
  }

// Check if implements Verifiable then probably has to have 'verifiableAspects' and/or 'evidentiaryDocuments'
// Check if implements Item should have property that has backlink for this type of items
}

function validateVerifiableAspects (model) {
  const { verifiableAspects } = model
  for (let aspect in verifiableAspects) {
    typeforce({
      methods: typeforce.arrayOf('String')
    }, verifiableAspects[aspect])
  }
}

function validateProperties (model) {
  const properties = model.properties
  typeforce('Object', properties)

  for (let p in properties){
    try {
      validateProperty({ model, propertyName: p })
    } catch (err) {
      err = updateErrorWithMessage(err, `invalid property "${p}": ${err.message}`)
      handleError(err)
    }
  }
}

function validateModelId (id) {
  if (typeof id !== 'string' || !/^[_a-zA-Z][._a-zA-Z0-9]*$/.test(id)) {
    throw new Error('expected string "id", e.g. com.example.BeerSpaceship')
  }
}

function validateFinancialProductModel (model) {
  if (!Array.isArray(model.forms)) {
    throw new Error('subclasses "tradle.FinancialProduct" require "forms" with list of form model ids')
  }

  if (!Array.isArray(model.interfaces) || model.interfaces.indexOf('tradle.Message') === -1) {
    throw new Error('subclasses of "tradle.FinancialProduct" should implement interface "tradle.Message"')
  }
}

function validateFormModel (model) {
  if (!Array.isArray(model.interfaces) || model.interfaces.indexOf('tradle.Message') === -1) {
    throw new Error('subclasses of "tradle.Form" should implement interface "tradle.Message"')
  }
}

function checkGroups (model) {
  GROUPS.forEach(group => {
    checkGroup({ model, group })
  })
}

function checkGroup ({ model, group }) {
  const val = model[group]
  if (!val) return

  if (!Array.isArray(val)) {
    throw new Error(`expected string array "${group}"`)
  }

  const seen = {}
  model[group]
    .filter(prop => !PROTOCOL_PROPERTIES.includes(prop))
    .forEach(prop => {
      if (seen[prop]) {
        throw new Error(`duplicate entry "${prop}" in group "${group}"`)
      }

      const metadata = model.properties[prop]
      if (!metadata) {
        throw new Error(`group "${group}" lists property "${prop}", which was not found in "properties"`)
      }

      // if (prop === 'editCols' && metadata.group) {
      //   throw new Error(`group "${group}" cannot have synthetic property "${prop}" (a property with "group")`)
      // }

      seen[prop] = true
    })
}

exports = module.exports = validateModel
exports.properties = validateProperties
exports.subClassOf = subClassValidators
exports.groups = checkGroups
exports.group = checkGroup
exports.id = validateModelId
exports.metadataProperties = Object.keys(metadataTypes)
