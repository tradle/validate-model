const typeforce = require('typeforce')
const getValues = require('lodash/values')
const transform = require('lodash/transform')
const pick = require('lodash/pick')
const identity = require('lodash/identity')
const extend = require('lodash/extend')
const ObjectModel = require('./object-model')
const StubModel = require('./stub-model')
const EnumValueModel = require('./enum-value-model')
const alphabetical = (a, b) => {
  if (a < b) return -1
  if (a === b) return 0
  return -1
}

const DEFAULT_PRIMARY_KEYS = {
  hashKey: '_permalink'
}

exports.ObjectModel = ObjectModel
exports.StubModel = StubModel
exports.EnumValueModel = EnumValueModel
// exports.bareStubProps = StubModel.required.slice().sort(alphabetical)
exports.stubProps = Object.keys(StubModel.properties).sort(alphabetical)
exports.enumValueProps = Object.keys(EnumValueModel.properties).sort(alphabetical)
exports.isProtocolProperty = isProtocolProperty
exports.isInlinedProperty = isInlinedProperty
exports.isEmailProperty = isEmailProperty
exports.isEnumProperty = isEnumProperty
exports.isBacklinkProperty = isBacklinkProperty
exports.isComplexProperty = isComplexProperty
exports.isPrimitiveProperty = isPrimitiveProperty
exports.isEnum = isEnum
exports.getAncestors = getAncestors
exports.getStubProperties = getStubProperties
exports.getEnumProperties = getEnumProperties
exports.getBacklinkProperties = getBacklinkProperties
exports.getCorrespondingBacklink = getCorrespondingBacklink
exports.getCorrespondingBacklinks = getCorrespondingBacklinks
exports.getPrimaryKeyProperties = getPrimaryKeyProperties
exports.getNestedProperties = getNestedProperties
exports.getPropertyTitle = getPropertyTitle
exports.getRef = getRef
exports.getProperty = getProperty
exports.getInlinedModel = getInlinedModel
exports.isDescendantOf = isDescendantOf
exports.maybeStrings = typeforce.maybe(typeforce.arrayOf('String'))
exports.maybeString = typeforce.maybe('String')
exports.maybeBool = typeforce.maybe('Boolean')
exports.maybeNum = typeforce.maybe('Number')
exports.maybeObject = typeforce.maybe('Object')
exports.maybeObjects = typeforce.maybe(typeforce.arrayOf('Object'))
exports.normalizeError = normalizeError
exports.updateErrorWithMessage = updateErrorWithMessage
exports.referencesUnknownModel = referencesUnknownModel
exports.referencesUnknownProp = referencesUnknownProp
exports.isSubClassOf = isSubClassOf

/**
 * like [].find(test), but returns the result of the test function
 * rather than the item that passed the test
 */
exports.find = function find (arr, test) {
  let result

  /* eslint array-callback-return: "off" */
  arr.some(item => {
    const ret = test(item)
    if (typeof ret !== 'undefined') {
      result = ret
      return result
    }
  })

  return result
}

exports.handleError = function handleError (err) {
  if (!(err instanceof TypeError || err instanceof ReferenceError) && process.env.PRINT_ONLY) {
    console.error(err)
  } else {
    throw err
  }
}

exports.toObject = function toObject (arr) {
  const models = {}
  for (const model of arr) models[model.id] = model

  return models
}

function normalizeError (err) {
  const underlying = err.__error || err
  const { message, __error, stack } = err
  const copy = new underlying.constructor(message)
  copy.message = message
  // hack for typeforce
  if (__error) {
    copy.stack = __error.stack
  }

  if (!copy.stack) {
    copy.stack = stack
  }

  return copy
}

function updateErrorWithMessage (err, message) {
  err = normalizeError(err)
  err.message = message
  err.stack = message + '\n' + err.stack
  return err
}

function referencesUnknownModel (id) {
  throw new Error(`references non-existent model "${id}"`)
}

function referencesUnknownProp (prop) {
  throw new Error(`references non-existent property "${prop}"`)
}

function isProtocolProperty (propertyName) {
  const protocolProp = ObjectModel.properties[propertyName]
  return protocolProp && !protocolProp.virtual
  // return propertyName === SIG ||
  //   propertyName === TYPE ||
  //   propertyName === PERMALINK ||
  //   propertyName === PREVLINK
}

function isInlinedProperty ({ models, property }) {
  const ref = getRef(property)
  if (property.inlined ||
    property.properties ||
    ref === 'tradle.Money' ||
    ref === 'tradle.Phone' ||
    ref === 'tradle.Photo' ||
    property.range === 'json' ||
    (property.items && !property.items.ref)) {
    return true
  }

  if (ref) {
    const refModel = models[ref]
    return refModel && refModel.inlined
  }

  return false
}

function isEmailProperty ({ model, property, propertyName }) {
  if (!property && model) {
    property = getProperty({ model, propertyName })
  }
  if (property && property.type === 'string') {
    return property.range === 'email'
  }
}

function getRef (property) {
  return property.ref || (property.items && property.items.ref)
}

function getPropertyTitle ({ model, propertyName }) {
  const property = getProperty({ model, propertyName })
  if (property.title) return property.title

  return splitCamelCase(propertyName)
    .map((part, i) => {
      if (i === 0) {
        // cap first word
        return part[0].toUpperCase() + part.slice(1)
      }

      return part.toLowerCase()
    })
    .join(' ')
}

function isEnumProperty ({ models, property }) {
  const ref = getRef(property)
  if (ref) {
    const refModel = models[ref]
    return refModel && isEnum(refModel)
  }
}

function isEnum (model) {
  return model.subClassOf === 'tradle.Enum'
}

function isBacklinkProperty (prop) {
  return prop && prop.items && prop.items.backlink
}

function getBacklinkProperties (model) {
  return Object.keys(model.properties)
    .filter(propertyName => isBacklinkProperty(model.properties[propertyName]))
}

function getCorrespondingBacklinks ({ models, model, forward }) {
  const prop = model.properties[forward]
  const targetModel = models[getRef(prop)]
  if (!targetModel) return []

  return getBacklinkProperties(targetModel)
    .map(name => {
      const tProp = targetModel.properties[name]
      const ref = getRef(tProp)
      if (tProp.items.backlink === forward) {
        if (ref === model.id || isDescendantOf({ models, a: model.id, b: ref })) {
          return { name, ref }
        }
      }
    })
    .filter(identity)
    .sort((a, b) => {
      // favor exact matches
      if (a.ref === model.id) return -1
      if (b.ref === model.id) return 1
      return 0
    })
    .map(match => match.name)
}

function getCorrespondingBacklink ({ models, model, forward }) {
  return getCorrespondingBacklinks({ models, model, forward })[0]
}

function getEnumProperties ({ models, model }) {
  const { properties } = model
  return Object.keys(properties)
    .filter(propertyName => {
      const property = properties[propertyName]
      return isEnumProperty({ models, property })
    })
}

function getStubProperties ({ models, model }) {
  const { properties } = model
  return Object.keys(properties)
    .filter(propertyName => {
      const property = properties[propertyName]

      if (property.type !== 'object' && property.type !== 'array') return
      if (property.range === 'json') return
      if (isEnumProperty({ models, property })) return
      if (isInlinedProperty({ models, property })) return

      return true
    })
}

function getPrimaryKeyProperties (model) {
  const { primaryKeys = DEFAULT_PRIMARY_KEYS } = model
  return getValues(pick(primaryKeys, ['hashKey', 'rangeKey']))
}

function isDescendantOf ({ models, a, b }) {
  if (b === 'tradle.Object') return a !== 'tradle.Object'

  let subClass
  const superClass = models[b]
  while ((subClass = models[a])) {
    if (!subClass) {
      throw new Error(`missing model: ${a}`)
    }

    if (!subClass.subClassOf) {
      return false
    }

    if (subClass.subClassOf === superClass.id) {
      return true
    }

    a = subClass.subClassOf
  }
}

function getAncestors ({ models, model }) {
  let cur = model
  const ancestors = []
  while (cur.subClassOf) {
    const parent = models[cur.subClassOf]
    ancestors.push(parent)
    cur = parent
  }

  return ancestors
}

function getProperty ({ model, propertyName }) {
  return model.properties[propertyName] || ObjectModel.properties[propertyName]
}

function splitCamelCase (str) {
  return str.split(/(?=[A-Z])/g)
}

function getNestedProperties ({ model, models }) {
  return transform(model.properties, (result, property, propertyName) => {
    if (property.type !== 'object' && property.type !== 'array') {
      return
    }

    if (property.range === 'json') {
      return
    }

    let nestedProps
    if (isInlinedProperty({ models, property })) {
      if (!isComplexProperty(property)) return

      const inlinedModel = getInlinedModel({ models, property })
      nestedProps = inlinedModel && inlinedModel.properties
    } else if (isEnumProperty({ models, property })) {
      nestedProps = EnumValueModel.properties
    } else {
      nestedProps = StubModel.properties
    }

    if (!nestedProps) return

    for (const p in nestedProps) {
      result[`${propertyName}.${p}`] = extend({}, nestedProps[p])
    }
  }, {})
}

function getInlinedModel ({ models, property }) {
  const ref = getRef(property)
  if (ref) return models[ref]

  return property.properties ? property : property.items
}

function isPrimitiveProperty (property) {
  return !isComplexProperty(property)
}

function isComplexProperty (property) {
  if (property.type === 'object' || property.type === 'array') {
    const { items } = property
    if (!items) return true

    const { ref, properties } = items
    if (ref || properties) return true
  }
}
function isSubClassOf ({ subModel, model, models }) {
  const subClassOf = model.subClassOf
  if (!subClassOf) return false
  if (subClassOf === subModel.id) return true
  if (!models[subClassOf]) {
    throw new Error(`"subClassOf" ${referencesUnknownModel(subClassOf)}`)
  }
  return isSubClassOf({ model: models[subClassOf], subModel, models })
}
