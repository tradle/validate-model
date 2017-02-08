const {
  find,
  updateErrorWithMessage,
  referencesUnknownModel
} = require('./utils')

const IDENTITY = 'tradle.Identity'
const PROFILE = 'tradle.Profile'
const VERIFIABLE = 'tradle.Verifiable'

exports = module.exports = checkRefs
exports.backlink = validateBacklinkRef

function checkRefs ({ models, model }) {
  if (!model) {
    return models.map(model => checkRefs({ models, model }))
  }

  // defensive copy
  models = models.slice()

  // add index by id
  models.forEach(m => models[m.id] = m)

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
    if (!val.ref) return

    const refModel = models[val.ref]
    if (!refModel) {
      throw new Error(`"ref" ${referencesUnknownModel(val.ref)}"`)
    }

    if (val.type === 'array') {
      if (val.backlink) {
        return validateBacklinkRef({ models, model, propertyName: p })
      }

      try {
        checkRefs({ models, model: val.items })
      } catch (err) {
        throw updateErrorWithMessage(err, `invalid property "${p}": ${err.message}`)
      }
    }

    if (val.type === 'string') {
      if (refModel.subClassOf !== 'tradle.Enum') {
        throw new Error('expected "ref" to reference subclass of tradle.Enum')
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
