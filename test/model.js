
const test = require('tape')
const validate = require('../').models.model
const broken = [
  {
    model: {},
    error: /\"type\"/
  },
  {
    model: {
      type: 'tradle.Model',
      id: 4
    },
    error: /\"id\"/
  }
]

test('validate', function (t) {
  broken.forEach(bad => {
    const result = validate(bad.model)
    t.ok(bad.error.test(result), result)
  })

  t.end()
})
