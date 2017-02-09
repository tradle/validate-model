
# @tradle/validate

validate your Tradle models

## Usage

```js
const baseModels = require('@tradle/models')
const validate = require('@tradle/validate')
const myModels = require('./my-models-array')

// validate a single property
try {
  const model = myModels[0]
  const propertyName = 'firstName'
  validate.models.property({  model, propertyName })
} catch (err) {
  console.log('uhh, i totally made this mistake on purpose:', err)
}

// validate a single model
try {
  const model = myModels[0]
  validate.models.model(model)
} catch (err) {
  console.log('uhh, i totally made this mistake on purpose:', err)
}

// validate all models and their cross-references
try {
  const models = baseModels.concat(myModels)
  validate.models(models)
} catch (err) {
  console.log('uhh, i totally made this mistake on purpose:', err)
}
```
