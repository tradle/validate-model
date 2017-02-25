
const test = require('tape')
const validate = require('../').model
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

test('validate model', function (t) {
  broken.forEach(bad => {
    t.throws(() => validate(bad.model), bad.error)
  })

  t.end()
})
