
const test = require('tape')
const validate = require('../').models.property
const broken = [
  {
    model: {
      properties: {
        name: {}
      }
    },
    property: 'name',
    error: /type/
  },
  {
    model: {
      properties: {
        name: {
          type: 'poop'
        }
      }
    },
    property: 'name',
    error: /type/
  },
  {
    model: {
      properties: {
        name: {
          type: 'string',
          range: 'object'
        }
      }
    },
    property: 'name',
    error: /range/
  }
]

const valid = [
]

test('validate', function (t) {
  broken.forEach(bad => {
    const result = validate({
      model: bad.model,
      propertyName: bad.property
    })

    t.ok(bad.error.test(result), result)
  })

  valid.forEach(bad => {
    const result = validate({
      model: good.model,
      propertyName: good.property
    })

    t.equal(result, undefined)
  })

  t.end()
})
