const { find } = require('./utils')
const IDENTITY = 'tradle.Identity'
const PROFILE = 'tradle.Profile'
const VERIFIABLE = 'tradle.Verifiable'

exports = module.exports = checkRefs
exports.backlink = validateBacklinkRef

function referencesUnknownModel (id) {
  throw new Error(`references non-existent model "${id}"`)
}

function checkRefs ({ models, model }) {
  // defensive copy
  models = models.slice()

  // add index by id
  models.forEach(m => models[m.id] = m)

  if (model.subClassOf) {
    if (!models[model.subClassOf]) {
      throw new Error(`"subClassOf" ${referencesUnknownModel(model.subClassOf)}`)
    }

    if (model.subClassOf === 'tradle.FinancialProduct') {
      return find(model.forms, id => {
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

  const interfaces = model.interfaces || []
  if (interfaces.length && !model.abstract) {
    const err = find(model.interfaces, id => {
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

    if (err) return err

    if (model.interfaces.indexOf(VERIFIABLE) !== -1 && model.evidentiaryDocuments) {
      if (!Array.isArray(model.evidentiaryDocuments)) {
        throw new Error('expected string array "evidentiaryDocuments"')
      }

      const err = find(model.evidentiaryDocuments, id => {
        if (!models[id]) {
          // warn, not considered error at the moment
          console.warn(`property "evidentiaryDocuments" of model ${model.id} ${referencesUnknownModel(id)}`)
        }
      })

      if (err) return err
    }
  }

  const { properties } = model
  return find(Object.keys(properties), p => {
    const val = properties[p]
    if (!val.ref) return

    const refModel = models[val.ref]
    if (!refModel) {
      return {
        model: model.id,
        property: p,
        error: `"ref" ${referencesUnknownModel(val.ref)}"`
      }
    }

    if (val.type === 'array') {
      if (val.backlink) {
        return validateBacklinkRef({ models, model, propertyName: p })
      }

      let error = checkRefs({ models, model: val.items })
      if (error) {
        throw new Error(`invalid property "${p}": ` + error)
      }
    } else if (val.type === 'string') {
      if (refModel.subClassOf !== 'tradle.Enum') {
        throw new Error('expected "ref" to reference subclass of tradle.Enum')
      }
    }
  })
}

function validateBacklinkRef ({ models, model, propertyName }) {
  const prop = model[propertyName]
  const refModel = models[prop.ref]
  const backlink = prop.backlink
  const backlinkProp = refModel.properties[backlink]
  if (backlinkProp && backlinkProp.ref === model.id) return

  const backlinkErr = `"backlink" property "${backlink}" implies "${refModel.id}" property "${backlink}" with range ${model.id}`

  // check interfaces
  const interfaces = refModel.interfaces
  if (!interfaces) return backlinkErr

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

  if (!found) return backlinkErr
}
