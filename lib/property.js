const typeforce = require('typeforce')
const pick = require('lodash/pick')
const omit = require('lodash/omit')
const extend = require('lodash/extend')
const isEqual = require('lodash/isEqual')
const ObjectModel = require('@tradle/models').models['tradle.Object']
const baseProperties = ObjectModel.properties// const clone = require('xtend')
const {
  handleError
} = require('./utils')

const forbiddenPropertyNames = ['tojson', 'id']
const propertyRanges = ['json', 'email', 'phone', 'year', 'photo', 'check', 'url', 'model', 'document'] // year - not yet working :)
const stringRanges = ['email']
const propertyTypes = ['string', 'number', 'date', 'object', 'array', 'boolean', 'enum', 'bytes']
const cameraType = ['front', 'back']
const scanner = ['id-document', 'payment-card']
const allowRoles = ['me']
const PROPERTY_NAME_REGEX = /^[_a-zA-Z][_a-zA-Z0-9]*$/

const propertyMetadataValidators = {
  group: groupValidator('group'),
  list: groupValidator('list'),
  displayAs: validateDisplayAs,
  type: {
    string: validateStringProperty,
    number: validateNumberProperty,
    date: validateDateProperty,
    object: validateObjectProperty,
    array: validateArrayProperty,
    boolean: validateBooleanProperty,
    enum: validateEnumProperty,
    bytes: validateBytesProperty
  },
  units: validateUnits
}

const anyType = () => true
const types = {
  type: createOneOfRule(propertyTypes, 'type'),
  range: createOneOfRule(propertyRanges, 'range'),
  stringRange: createOneOfRule(stringRanges, 'range'),
  allowRoles: createOneOfRule(allowRoles, 'allowRoles'),
  cameraType: createOneOfRule(cameraType, 'cameraType'),
  scanner: createOneOfRule(scanner, 'scanner'),
  // see react-native TextInput.keyboardType
  keyboard: createOneOfRule([
    'default',
    'email-address',
    'numeric',
    'phone-pad',
    'ascii-capable',
    'numbers-and-punctuation',
    'url',
    'number-pad',
    'name-phone-pad',
    'decimal-pad',
    'twitter',
    'web-search',
  ], 'keyboard')
}

const interfacePropImplementor = typeforce.compile({
  interface: typeforce.String,
  property: typeforce.String
})

const rawPropTypes = {
  type: types.type,
  range: types.range,
  inlined: 'Boolean',
  readOnly: 'Boolean',
  immutable: 'Boolean',
  skipLabel: 'Boolean',
  displayName: 'Boolean',
  markdown: 'Boolean',
  signature: 'Boolean',
  scanner: types.scanner,
  title: 'String',
  description: 'String',
  ref: 'String',
  displayAs: 'String',
  group: typeforce.arrayOf('String'),
  list: typeforce.arrayOf('String'),
  min: numberish,
  max: numberish,
  minDate: 'String',
  maxDate: 'String',
  minLength: 'Number',
  maxLength: 'Number',
  units: 'String',
  items: 'Object',
  icon: 'String',
  keyboard: types.keyboard,
  pattern: 'String',
  allowToAdd: 'Boolean',
  // patterns: 'Object',
  // ignore these for now
  required: typeforce.arrayOf('String'),
  viewCols: typeforce.arrayOf('String'),
  oneOf: typeforce.Array,
  // TODO: validate "default" more seriously
  default: anyType,
  properties: 'Object',
  mainPhoto: 'Boolean',
  component: 'String',
  allowRoles: types.allowRoles,
  hidden: 'Boolean',
  allowPicturesFromLibrary: 'Boolean',
  cameraType: types.cameraType,
  coverPhoto: 'Boolean',
  virtual: 'Boolean',
  sample: val => {
    if (typeof val !== 'string' && !(val && typeof val === 'object')) {
      throw new Error('expected "sample" to be string or object')
    }

    return true
  },
  pin: typeforce.Array,
  limit: typeforce.Array,
  partial: typeforce.Boolean,
  implements: typeforce.arrayOf(interfacePropImplementor)
}

const propTypes = (function () {
  const types = {}
  for (let p in rawPropTypes) {
    let raw = rawPropTypes[p]
    if (p === 'type') {
      types[p] = raw
    } else {
      types[p] = typeforce.maybe(raw)
    }
  }

  return types
})()

/**
 * metadata that may be present on any prop
 * @type {Array}
 */
const common = pick(propTypes, [
  'icon',
  'type',
  'skipLabel',
  'title',
  'description',
  'readOnly',
  'displayName',
  'default',
  'allowRoles',
  'hidden',
  'immutable',
  'virtual',
  'sample'
])

const booleanMetadata = extend({}, common)

const numberMetadata = extend(pick(propTypes, [
  'range',
  'min',
  'max',
  'minDate',
  'maxDate',
  'units',
  'minLength',
  'maxLength',
  'keyboard'
]), common)

const stringMetadata = extend(pick(propTypes, [
  'ref',
  'range',
  'pattern',
  // 'patterns',
  'minLength',
  'maxLength',
  'keyboard',
  'group',
  'list',
  'displayAs',
  'markdown',
  'signature'
]), common)

const bytesMetadata = extend({}, common)

const enumMetadata = extend(pick(propTypes, [
  'oneOf',
  'pin',
  'limit'
]), common)

const dateMetadata = extend(pick(propTypes, [
  'min',
  'max',
  'minDate',
  'maxDate'
]), common)

const objectMetadata = extend(pick(propTypes, [
  'range',
  'ref',
  'inlined',
  'allowToAdd',
  'properties',
  'units',
  'pin',
  'limit',
  'partial'
]), common)

// const objectMetadataProps = Object.keys(objectMetadata)

const photoMetadata = extend(pick(propTypes, [
  'mainPhoto',
  'component',
  'allowPicturesFromLibrary',
  'coverPhoto',
  'cameraType',
  'scanner',
  'signature'
]), objectMetadata)

const arrayMetadata = extend(pick(propTypes, [
  'range',
  'items',
  'inlined',
  'allowToAdd',
  'required',
  'viewCols',
  'pin',
  'limit'
]), photoMetadata)

function createOneOfRule (arr, name) {
  return function (val) {
    if (arr.indexOf(val) === -1) {
      throw new Error(`expected "${name}" to be one of: ${arr.join(', ')}`)
    }

    return true
  }
}

function validateProperty ({ model, propertyName }) {
  if (forbiddenPropertyNames.indexOf(propertyName.toLowerCase()) !== -1) {
    throw new Error(`propertyName "${propertyName}" is not allowed`)
  }

  if (!PROPERTY_NAME_REGEX.test(propertyName)) {
    throw new Error(`adhere to the following regex: ${PROPERTY_NAME_REGEX}`)
  }

  const property = model.properties[propertyName]
  // reserve underscore as first char for virtual properties
  // and protocol-level properties
  if (propertyName[0] === '_' &&
    propertyName !== '_t' &&
    !property.virtual &&
    model.id !== 'tradle.Object' &&
    model.id !== 'tradle.Message') {

    if (!baseProperties[propertyName] || !isEqual(baseProperties[propertyName], property)) {
      throw new Error('non-virtual properties must not begin with an underscore')
    }
  }

  typeforce(propTypes, property, true)

  for (let attr in propertyMetadataValidators) {
    if (attr in property) {
      let validate = propertyMetadataValidators[attr]
      if (typeof validate === 'object') {
        validate = validate[property[attr]]
      }

      try {
        validate({ model, property, propertyName })
      } catch (err) {
        handleError(err)
      }
    }
  }
}

function validateUnits ({ property }) {
  if (property.type !== 'number'  &&  property.ref !== 'tradle.Money') {
    throw new Error('expected "ref" to be "tradle.Money"')
  }
}

function validateDateProperty ({ property }) {
  typeforce(dateMetadata, property, true)
}

function validateNumberProperty ({ property }) {
  typeforce(numberMetadata, property, true)
}

function validatePhotoProperty ({ property }) {
  typeforce(photoMetadata, property, true)
  const ref = property.ref || property.items.ref
  if (ref && ref !== 'tradle.Photo') {
    throw new Error('expected "ref" to be "tradle.Photo"')
  }
}

function isPhotoProperty (prop) {
  return prop.range === 'photo' || prop.ref === 'tradle.Photo'
}

function validateObjectProperty ({ model, property }) {
  const metadata = isPhotoProperty(property) ? photoMetadata : objectMetadata
  typeforce(metadata, property, true)
  if (!property.ref  &&  property.range !== 'json'  &&  !property.properties) {
    throw new Error('expected "ref", inlined "properties", or range "json"')
  }

  if (property.properties) {
    return require('./model').properties(property)
  }

  if (property.range === 'photo') {
    return validatePhotoProperty({ model, property })
  }
}

function validateStringProperty ({ model, propertyName, property }) {
  if (property.signature) {
    console.warn(`"signature" annotation on string properties is deprecated
please fix model ${model.id} property ${propertyName} type to object, with ref tradle.Photo`)
  }

  typeforce(stringMetadata, property, true)
}

function validateBytesProperty ({ property }) {
  typeforce(bytesMetadata, property, true)
}

function validateEnumProperty ({ property }) {
  typeforce(enumMetadata, property, true)
}

function validateBooleanProperty ({ property }) {
  typeforce(booleanMetadata, property, true)
}

function validateArrayProperty ({ model, property }) {
  typeforce(arrayMetadata, property, true)

  const { items } = property
  const { ref, backlink } = items
  if (backlink) {
    if (!ref) {
      throw new Error('expected "backlink" to be accompanied by "ref"')
    }
  } else {
    if (items.properties) {
      return require('./model').properties(items)
    }

    if (items.type) {
      if (ref) {
        typeforce(isComplexType, items.type)
      } else {
        typeforce(isPrimitiveType, items.type)
      }
    } else {
      typeforce(rawPropTypes.ref, ref)
    }
  }

  const isLocallyDefined = !items.ref
  if (!isLocallyDefined) {
    const inner = omit(items, ['backlink', 'filter'])
    inner.type = 'object'
    if (isPhotoProperty(items)) {
      inner.range = 'photo'
    }

    validateObjectProperty({
      model,
      property: inner
    })
  }
}

function validateDisplayAs ({ property }) {
  if (property.type !== 'string') {
    throw new Error('"displayAs" is reserved for string properties')
  }

  if (!property.group) {
    throw new Error('"displayAs" must be accompanied by "group"')
  }
}

function groupValidator (groupName) {
  return function ({ model, propertyName }) {
    return checkGroup({ model, propertyName, groupName })
  }
}

function checkGroup ({ model, propertyName, groupName }) {
  const prop = model.properties[propertyName]
  const val = prop[groupName]
  if (!val) return

  if (!Array.isArray(val)) {
    throw new Error(`expected string array "${groupName}"`)
  }

  val.forEach(prop => {
    if (prop === propertyName) {
      throw new Error(`group "${groupName}" of property "${propertyName}" cannot reference "${propertyName}"`)
    }

    const referencedProp = model.properties[prop]
    if (!referencedProp) {
      throw new Error(`group "${groupName}" of property "${propertyName}" references non-existent property "${prop}"`)
    }

    if (referencedProp.group) {
      throw new Error(`group "${groupName}" of property "${propertyName}" has a nested group property "${prop}"`)
    }
  })
}

function numberish (val) {
  return !isNaN(Number(val))
}

function isComplexType (type) {
  return type === 'object' || type === 'array'
}

function isPrimitiveType (type) {
  return !isComplexType(type) && propertyTypes.indexOf(type) !== -1
}

// EXPORTS
//
exports = module.exports = validateProperty
exports.metadataProperties = Object.keys(rawPropTypes)

;(function copyMetadataValidatorsToExports () {
  for (let p in propertyMetadataValidators) {
    exports[p] = propertyMetadataValidators[p]
  }
})()
