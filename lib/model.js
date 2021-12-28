const intersection = require('lodash/intersection')
const typeforce = require('typeforce')
const {
  TYPE,
  SIG,
  SEQ,
  AUTHOR,
  VERSION,
  PREV_TO_RECIPIENT,
  PREVHEADER,
  PREVLINK,
  PERMALINK,
  TIMESTAMP,
  TYPES: {
    FORM,
    FINANCIAL_PRODUCT,
    ENUM,
    MODEL
  }
} = require('@tradle/constants')

const validateProperty = require('./property')
const {
  maybeStrings,
  maybeString,
  maybeBool,
  maybeObject,
  maybeObjects,
  updateErrorWithMessage,
  handleError,
  referencesUnknownProp,
  isEnum
} = require('./utils')

const CONTEXT = 'tradle.Context'

const isStringArray = val => Array.isArray(val) && val.every(item => typeof item === 'string')

const keyPartTemplate = val => {
  if (typeof val === 'string' || isStringArray(val)) return true

  typeforce({
    template: typeforce.String
  }, val)

  return true
}

const keyTemplate = val => {
  if (typeof val === 'string' || isStringArray(val)) return true

  typeforce({
    hashKey: keyPartTemplate,
    rangeKey: typeforce.maybe(keyPartTemplate)
  }, val)

  return true
}

const metadataTypes = {
  id: 'String',
  type: 'String',
  title: 'String',
  shortTitle: maybeString,
  internalUse: maybeBool,
  description: maybeString,
  properties: 'Object',
  subClassOf: maybeString,
  interfaces: maybeStrings,
  required: maybeStrings,
  softRequired: maybeStrings,
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
  style: maybeObject,
  primaryKeys: typeforce.maybe(keyTemplate),
  indexes: typeforce.maybe(typeforce.arrayOf(keyTemplate))
}

const subClassValidators = {
  [FINANCIAL_PRODUCT]: validateFinancialProductModel,
  [FORM]: validateFormModel
}
const interfaceValidators = {
  [CONTEXT]: validateContextModel
}

const idRegex = /^[a-zA-Z][.a-zA-Z0-9]*$/

const enumItemType = typeforce.compile({
  id: val => {
    if (typeof val !== 'string') {
      throw new Error('expected string "id" in enum set')
    }

    if (!idRegex.test(val)) {
      throw new Error(`"id" ${val} doesn't adhere to regex: ${idRegex}`)
    }

    return true
  },
  title: 'String'
})

const PROTOCOL_PROPERTIES = [
  TYPE,
  SIG,
  SEQ,
  PREV_TO_RECIPIENT,
  PERMALINK,
  PREVLINK,
  PREVHEADER,
  AUTHOR,
  VERSION,
  TIMESTAMP
]

const GROUPS = [
  'required',
  'softRequired',
  'viewCols',
  'editCols',
  'gridCols',
  'hidden',
  'virtual'
]

function validateModel (model) {
  try {
    _validateModel(model)
  } catch (err) {
    handleError(
      updateErrorWithMessage(err, `invalid model "${model.id}": ${err.message}`)
    )
  }
}

function _validateModel (model) {
  if (model.type !== MODEL) {
    throw new Error(`expected "type": "${MODEL}"`)
  }

  // id
  const idErr = validateModelId(model.id)
  if (idErr) return idErr

  typeforce(metadataTypes, model, true)

  try {
    validateProperties(model)
  } catch (err) {
    handleError(
      updateErrorWithMessage(err, `invalid "properties": ${err.message}`)
    )
  }

  const { subClassOf, properties, sort, verifiableAspects, customerCanHaveMultiple, interfaces } = model
  const subClassValidator = subClassOf && subClassValidators[subClassOf]
  if (subClassValidator) subClassValidator(model)

  if (interfaces) {
    for (const interfaceId in interfaceValidators) {
      if (interfaces.indexOf(interfaceId) !== -1) {
        interfaceValidators[interfaceId](model)
      }
    }
  }
  checkGroups(model)
  if (verifiableAspects) {
    validateVerifiableAspects(model)
  }

  if (sort && !properties[sort]) {
    throw new Error(`"sort" ${referencesUnknownProp(sort)}`)
  }

  if (customerCanHaveMultiple && subClassOf !== FINANCIAL_PRODUCT) {
    throw new Error(`only subclasses of ${FINANCIAL_PRODUCT} can have the property "customerCanHaveMultiple"`)
  }

  if (model.enum) {
    typeforce(typeforce.arrayOf(enumItemType), model.enum)
    if (!isEnum(model)) {
      throw new Error(`models with "enum" property must have "subClassOf": "${ENUM}"`)
    }
  }

// Check if implements Verifiable then probably has to have 'verifiableAspects' and/or 'evidentiaryDocuments'
// Check if implements Item should have property that has backlink for this type of items
}

function validateVerifiableAspects (model) {
  const { verifiableAspects } = model
  for (const aspect in verifiableAspects) {
    typeforce({
      methods: typeforce.arrayOf('String')
    }, verifiableAspects[aspect])
  }
}

function validateProperties (model) {
  const properties = model.properties
  typeforce(typeforce.Object, properties)

  for (const p in properties) {
    try {
      validateProperty({ model, propertyName: p })
    } catch (err) {
      handleError(
        updateErrorWithMessage(err, `invalid property "${p}": ${err.message}`)
      )
    }
  }
}

function validateModelId (id) {
  if (typeof id !== 'string' || !idRegex.test(id)) {
    throw new Error(`model id ${id} doesn't adhere to regex: ${idRegex}`)
  }
}

function validateFinancialProductModel (model) {
  if (!Array.isArray(model.forms)) {
    throw new Error(`subclasses "${FINANCIAL_PRODUCT}" require "forms" with list of form model ids`)
  }

  // if (!Array.isArray(model.interfaces) || model.interfaces.indexOf('tradle.Message') === -1) {
  //   throw new Error('subclasses of "tradle.FinancialProduct" should implement interface "tradle.Message"')
  // }
}

function validateFormModel (model) {
  // if (!Array.isArray(model.interfaces) || model.interfaces.indexOf('tradle.Message') === -1) {
  //   throw new Error('subclasses of "tradle.Form" should implement interface "tradle.Message"')
  // }
}

function validateContextModel (model) {
  const { contextId } = model.properties
  if (!contextId || contextId.type !== 'string') {
    throw new Error(`implementors of "${CONTEXT}" interface should have property "contextId" of type "string"`)
  }
}

function checkGroups (model) {
  GROUPS.forEach(group => {
    checkGroup({ model, group })
  })

  if (model.hidden && model.required) {
    const hiddenRequired = intersection(model.hidden, model.required)
    if (hiddenRequired.length) {
      throw new Error(`these properties are both hidden and required: ${hiddenRequired.join(', ')}`)
    }
  }
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
