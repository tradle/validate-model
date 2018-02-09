const _ = require('lodash')
const {
  find,
  updateErrorWithMessage,
  referencesUnknownModel,
  handleError
} = require('./utils')

const IDENTITY = 'tradle.Identity'
const PROFILE = 'tradle.Profile'
const VERIFIABLE = 'tradle.Verifiable'

exports = module.exports = checkRefs
exports.backlink = validateBacklinkRef
exports.getReferences = getReferences
exports.getDirectReferences = getDirectReferences

const validateRef = ({ models, model, property, propertyName }) => {
  if (!property.ref) return

  const refModel = models[property.ref]
  if (!refModel) {
    throw new Error(`"ref" ${referencesUnknownModel(property.ref)}"`)
  }

  if (property.type === 'array') {
    try {
      checkRefs({ models, model: property.items })
    } catch (err) {
      throw updateErrorWithMessage(err, `invalid property "${propertyName}": ${err.message}`)
    }
  }

  if (property.type === 'string') {
    if (refModel.subClassOf !== 'tradle.Enum') {
      throw new Error('expected "ref" to reference subclass of tradle.Enum')
    }
  }
}

const getEnumValue = (model, val) => {
  return model.enum.find(({ id, title }) => {
    if (val.id) return val.id === id
    if (val === id) return true
    if (val.startsWith(model.id)) {
      return val.slice(model.id.length + 1) === id
    }

    return false
  })
}

const validateValList = ({ models, model, propertyName, property }) => {
  const { limit, ref } = property
  if (!ref) return

  const refModel = models[ref]
  if (refModel.subClassOf !== 'tradle.Enum') return

  limit.forEach((val, i) => {
    if (!getEnumValue(refModel, val)) {
      throw new Error(`${propertyName}.limit[i] value (${val}) does not exist in ${refModel.id}`)
    }
  })
}

const propertyMetadataValidators = {
  ref: validateRef,
  backlink: validateBacklinkRef,
  limit: validateValList,
  pin: validateValList
}

function checkRefs ({ models, model }) {
  if (model) return checkRefsForModel({ models, model })

  models = toModelMap(models)
  for (let id in models) {
    let model = models[id]
    try {
      // make sure all models are available
      getReferences({ models, subset: [id] })
      checkRefsForModel({ models, model })
    } catch (err) {
      err = updateErrorWithMessage(err, `invalid model "${model.id}": ${err.message}`)
      handleError(err)
    }
  }
}

function checkRefsForModel ({ models, model }) {
  models = toModelMap(models)
  const {
    interfaces=[],
    subClassOf,
    properties,
    forms,
    evidentiaryDocuments,
    verifiableAspects,
    multiEntryForms=[]
  } = model

  if (subClassOf) {
    if (!models[subClassOf]) {
      throw new Error(`"subClassOf" ${referencesUnknownModel(subClassOf)}`)
    }

    if (subClassOf === 'tradle.FinancialProduct') {
      forms.forEach(id => {
        const formModel = models[id]
        if (!formModel) {
          throw new Error(`"forms" ${referencesUnknownModel(id)}`)
        }

        const subClassOf = formModel.subClassOf
        if (subClassOf !== 'tradle.Form' && subClassOf !== 'tradle.MyProduct') {
          throw new Error(`"forms" references model "${id}" with "subClassOf" !== "tradle.Form"`)
        }
      })

      const { namespace, name }  = parseModelId(model.id)
      const myProductId = namespace + '.My' + name
      if (!models[myProductId]) {
        throw new Error(`expected ${myProductId} to exist (subClassOf tradle.MyProduct)`)
      }
    }
  }

  if (interfaces.length && !model.abstract) {
    interfaces.forEach(id => {
      const iModel = models[id]
      if (!iModel) {
        throw new Error(`"interfaces" ${referencesUnknownModel(id)}`)
      }

      if (!iModel.isInterface) {
        throw new Error(`"interfaces" references model "${id}", which is not an interface (does not have isInterface: true)`)
      }

      const { required } = iModel
      if (required) {
        const rProps = required.filter(function(r) {
          return !model.properties[r]
        })

        if (rProps.length) {
          throw new Error(`interface "${id}" requires implementing properties: ${rProps.join(', ')}`)
        }
      }
    })

    if (interfaces.indexOf(VERIFIABLE) !== -1 && evidentiaryDocuments) {
      if (!Array.isArray(evidentiaryDocuments)) {
        throw new Error('expected string array "evidentiaryDocuments"')
      }

      evidentiaryDocuments.forEach(id => {
        if (!models[id]) {
          // warn, not considered error at the moment
          console.warn(`property "evidentiaryDocuments" of model ${model.id} ${referencesUnknownModel(id)}`)
        }
      })
    }
  }

  Object.keys(properties).forEach(p => {
    const val = properties[p]
    for (let attr in val) {
      if (attr in propertyMetadataValidators) {
        propertyMetadataValidators[attr]({
          models,
          model,
          propertyName: p,
          property: val
        })
      }
    }
  })

  if (verifiableAspects) {
    for (let aspect in verifiableAspects) {
      verifiableAspects[aspect].methods.forEach(method => {
        const methodModel = models[method]
        if (!methodModel) {
          // throw new Error(`property "verifiableAspects" of model ${model.id} ${referencesUnknownModel(method)}`)
          return console.warn(`property "verifiableAspects" of model ${model.id} ${referencesUnknownModel(method)}`)
        }

        if (methodModel.subClassOf !== 'tradle.Method') {
          throw new Error(`method ${method} in "verifiableAspects" of model ${model.id} must reference a subclass of "tradle.Method"`)
        }
      })
    }
  }

  if (multiEntryForms) {
    multiEntryForms.forEach(id => {
      const model = models[id]
      if (!model) throw new Error(`"multiEntryForms" ${referencesUnknownModel(id)}`)

      const { subClassOf } = model
      if (subClassOf !== 'tradle.Form' && subClassOf !== 'tradle.MyProduct') {
        throw new Error('models referenced in "multiEntryForms" should be subclasses of tradle.Form or tradle.MyProduct')
      }
    })
  }
}

function validateBacklinkRef ({ models, model, propertyName }) {
  const prop = model[propertyName]
  const refModel = models[prop.ref]
  const backlink = prop.backlink
  const backlinkProp = refModel.properties[backlink]
  if (backlinkProp && backlinkProp.ref === model.id) return

  const backlinkErr = new Error(`"backlink" property "${backlink}" implies "${refModel.id}" property "${backlink}" with range ${model.id}`)

  // check interfaces
  const interfaces = refModel.interfaces
  if (!interfaces) throw backlinkErr

  const found = find(interfaces, id => {
    const iBacklinkProp = models[id].properties[backlink]
    const iRef = iBacklinkProp && iBacklinkProp.ref
    if (!iRef) return

    if (iRef === model.id) return true

    const refModel = models[iBacklinkProp.ref]
    if (!refModel) return
    if (refModel.subClassOf === model.id) return true

    // HACK for from and to in Message interface
    if ((iRef === IDENTITY || iRef === PROFILE) &&
        (model.id === IDENTITY || model.id === PROFILE)) {
      return true
    }
  })

  if (!found) throw backlinkErr
}

function getDirectReferences (model) {
  const {
    forms=[],
    additionalForms=[],
    multiEntryForms=[],
    verifiableAspects={},
    evidentiaryDocuments=[],
    interfaces=[],
    subClassOf,
    properties
  } = model

  const verifiableAspectsIds = Object.keys(verifiableAspects)
    .map(aspect => verifiableAspects[aspect].methods)
    .reduce((all, some) => all.concat(some), [])

  const inProps = Object.keys(properties)
    .map(name => {
      const prop = properties[name]
      const ref = prop.type === 'array' && prop.items
        ? prop.items.ref
        : prop.ref

      return ref
    })
    .filter(ref => ref)

  const ids = inProps
    .concat(subClassOf || [])
    .concat(interfaces)
    .concat(forms)
    .concat(additionalForms)
    .concat(multiEntryForms)
    .concat(verifiableAspectsIds)
    .concat(evidentiaryDocuments)
    .concat(inProps)

  // deduplicate
  const byId = {}
  for (let id of ids) byId[id] = true

  return Object.keys(byId)
}

/**
 * Return models referenced in `subset`
 * @param  {Object} options.models
 * @param  {Array(String)} options.subset
 * @return Array(String) array of model ids
 */
function getReferences ({ models, subset }) {
  const refs = {}
  let batch
  for (;;) {
    batch = subset.map(id => {
      if (id === 'tradle.Model') return null

      const model = models[id]
      if (!model) throw new Error(`missing model ${id}`)

      return model
    })
    .filter(_.identity)

    subset = addReferenceBatch({ batch, refs })
    if (!subset.length) return Object.keys(refs)
  }
}

function addReferenceBatch ({ batch, refs }) {
  const direct = batch.map(getDirectReferences)
    .reduce((all, some) => {
      some.forEach(id => all[id] = some[id])
      return all
    }, {})

  const added = []
  for (let id in direct) {
    if (!(id in refs)) {
      refs[id] = true
      added.push(id)
    }
  }

  return added
}

function toModelMap (models) {
  if (!Array.isArray(models)) return models

  const byId = {}
  for (const model of models) {
    if (byId[model.id]) {
      throw new Error(`found two models with id "${model.id}"`)
    }

    byId[model.id] = model
  }

  return byId
}

function parseModelId (id) {
  const [namespace, name] = id.match(/(.*?)\.([^.]+)$/).slice(1)
  return { namespace, name }
}
