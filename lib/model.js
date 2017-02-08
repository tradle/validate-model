
const typeforce = require('typeforce')
const validateProperty = require('./property')
const {
  maybeStrings,
  maybeString,
  maybeBool,
  maybeObj,
  updateErrorWithMessage,
  handleError,
  // referencesUnknownModel,
  referencesUnknownProp
} = require('./utils')

const subClassValidators = {
  'tradle.FinancialProduct': validateFinancialProductModel,
  'tradle.Form': validateFormModel
}

function validateModel (model) {
  if (model.type !== 'tradle.Model') {
    throw new Error('expected "type": "tradle.Model"')
  }

  // id
  const idErr = validateModelId(model.id)
  if (idErr) return idErr

  typeforce({
    title: 'String',
    properties: 'Object',
    subClassOf: maybeString,
    interfaces: maybeStrings,
    required: maybeStrings,
    viewCols: maybeStrings,
    editCols: maybeStrings,
    gridCols: maybeStrings,
    multiEntryForms: maybeStrings,
    hidden: maybeStrings,
    icon: maybeString,
    inlined: maybeBool,
    forms: maybeStrings,
    evidentiaryDocuments: maybeStrings,
    abstract: maybeBool,
    verifiableAspects: maybeObj,
    sort: maybeString,
    customerCanHaveMultiple: maybeBool,
    isInterface: maybeBool,
    autoCreate: maybeBool,
    verifiable: maybeBool,
    notShareable: maybeBool,
    plural: maybeString,
    formRequestMessage: maybeString,
    style: maybeObj
  }, model, true)

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
  if (typeof id !== 'string' && /^[a-zA-Z0-9\.]+$/.test(id)) {
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
  ['required', 'viewCols', 'editCols', 'gridCols', 'hidden'].forEach(group => {
    checkGroup({ model, group })
  })
}

function checkGroup ({ model, group }) {
  const val = model[group]
  if (!val) return

  if (!Array.isArray(val)) {
    throw new Error(`expected string array "${group}"`)
  }

  model[group].forEach(prop => {
    if (!model.properties[prop]) {
      throw new Error(`group ${group} lists property ${prop}, which was not found in "properties"`)
    }
  })
}

exports = module.exports = validateModel
exports.properties = validateProperties
exports.subClassOf = subClassValidators
exports.groups = checkGroups
exports.group = checkGroup
exports.id = validateModelId
