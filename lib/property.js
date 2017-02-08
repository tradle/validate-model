const typeforce = require('typeforce')
const pick = require('object.pick')
const extend = require('xtend/mutable')
const {
  handleError
} = require('./utils')

exports = module.exports = validateProperty

const forbiddenPropertyNames = ['tojson']
const propertyRanges = ['json', 'email', 'phone', 'year', 'photo', 'check', 'url'] // year - not yet working :)
const stringRanges = ['email']
const propertyTypes = ['string', 'number', 'date', 'object', 'array', 'boolean', 'enum']
const cameraType = ['front', 'back']
const allowRoles = ['me']
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
    enum: validateEnumProperty
  },
  units: validateUnits
}

;(function copyMetadataValidatorsToExports () {
  for (let p in propertyMetadataValidators) {
    exports[p] = propertyMetadataValidators[p]
  }
})()

const types = {
  type: createOneOfRule(propertyTypes, 'type'),
  range: createOneOfRule(propertyRanges, 'range'),
  stringRange: createOneOfRule(stringRanges, 'range'),
  allowRoles: createOneOfRule(allowRoles, 'allowRoles'),
  cameraType: createOneOfRule(cameraType, 'cameraType'),
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

const rawPropTypes = {
  type: types.type,
  range: types.range,
  inlined: 'Boolean',
  readOnly: 'Boolean',
  immutable: 'Boolean',
  skipLabel: 'Boolean',
  displayName: 'Boolean',
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
  defaultValue: 'String',
  properties: 'Object',
  mainPhoto: 'Boolean',
  component: 'String',
  allowRoles: types.allowRoles,
  hidden: 'Boolean',
  allowPicturesFromLibrary: 'Boolean',
  cameraType: types.cameraType,
  coverPhoto: 'Boolean'
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
  'defaultValue',
  'allowRoles',
  'hidden',
  'immutable'
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
  'displayAs'
]), common)

const enumMetadata = extend(pick(propTypes, [
  'oneOf'
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
  'units'
]), common)

const photoMetadata = extend(pick(propTypes, [
  'mainPhoto',
  'component',
  'allowPicturesFromLibrary',
  'coverPhoto',
  'cameraType'
]), objectMetadata)

const arrayMetadata = extend(pick(propTypes, [
  'range',
  'items',
  'inlined',
  'allowToAdd',
  'required',
  'viewCols',
  'cameraType'
]), common)

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
    throw new Error(`propertyName ${propertyName} is not allowed`)
  }

  const prop = model.properties[propertyName]
  typeforce(propTypes, prop, true)

  for (let p in propertyMetadataValidators) {
    if (p in prop) {
      let validate = propertyMetadataValidators[p]
      if (typeof validate === 'object') {
        validate = validate[prop[p]]
      }

      try {
        validate({ model, propertyName })
      } catch (err) {
        handleError(err)
      }
    }
  }
}

function validateUnits ({ model, propertyName }) {
  const prop = model.properties[propertyName]
  if (prop.type !== 'number'  &&  prop.ref !== 'tradle.Money') {
    throw new Error('expected "ref" to be "tradle.Money"')
  }
}

function validateDateProperty ({ model, propertyName }) {
  const prop = model.properties[propertyName]
  typeforce(dateMetadata, prop, true)
}

function validateNumberProperty ({ model, propertyName }) {
  const prop = model.properties[propertyName]
  typeforce(numberMetadata, prop, true)
}

function validatePhotoProperty ({ model, propertyName }) {
  const prop = model.properties[propertyName]
  typeforce(photoMetadata, prop, true)
  const ref = prop.ref || prop.items.ref
  if (ref && ref !== 'tradle.Photo') {
    throw new Error('expected "ref" to be "tradle.Photo"')
  }
}

function validateObjectProperty ({ model, propertyName }) {
  const prop = model.properties[propertyName]
  const isPhoto = prop.range === 'photo' || prop.ref === 'tradle.Photo'
  const metadata = isPhoto ? photoMetadata : objectMetadata
  typeforce(metadata, prop, true)
  if (!prop.ref  &&  prop.range !== 'json'  &&  !prop.properties) {
    throw new Error('expected "ref", inlined "properties", or range "json"')
  }

  if (prop.properties) {
    return require('./model').properties(prop)
  }

  if (prop.range === 'photo') {
    return validatePhotoProperty({ model, propertyName })
  }
}

function validateStringProperty ({ model, propertyName }) {
  const prop = model.properties[propertyName]
  typeforce(stringMetadata, prop, true)
}

function validateEnumProperty ({ model, propertyName }) {
  const prop = model.properties[propertyName]
  typeforce(enumMetadata, prop, true)
}

function validateBooleanProperty ({ model, propertyName }) {
  const prop = model.properties[propertyName]
  typeforce(booleanMetadata, prop, true)
}

function validateArrayProperty ({ model, propertyName }) {
  const prop = model.properties[propertyName]
  typeforce(arrayMetadata, prop, true)

  const items = prop.items
  const backlink = items.backlink
  if (!backlink) {
    if (items.properties) {
      return require('./model').properties(prop.items)
    }

    typeforce({
      type: typeforce.maybe(types.type),
      ref: rawPropTypes.ref
    }, items, true)
  }

  const ref = prop.items.ref
  if (!ref) {
    throw new Error('expected "backlink" to be accompanied by "ref"')
  }
}

function validateDisplayAs ({ model, propertyName }) {
  const properties = model.properties
  const prop = properties[propertyName]
  if (prop.type !== 'string') {
    throw new Error('"displayAs" is reserved for string properties')
  }

  if (!prop.group) {
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

    if (!model.properties[prop]) {
      throw new Error(`group "${groupName}" of property "${propertyName}" references non-existent property "${prop}"`)
    }
  })
}


function numberish (val) {
  return !isNaN(Number(val))
}
