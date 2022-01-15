
const test = require('tape')
const validate = require('../').model
const broken = [
  {
    model: {},
    error: /"type"/
  },
  {
    model: {
      type: 'tradle.Model',
      id: 4
    },
    error: /model id/
  },
  {
    model: {
      type: 'tradle.Model',
      id: 'mymodel',
      title: 'My model',
      interfaces: [
        'tradle.Context'
      ],
      properties: {}
    },
    error: /contextId/
  },
  {
    model: {
      type: 'tradle.Model',
      id: 'mymodel',
      title: 'My model',
      interfaces: [
        'tradle.Context'
      ],
      properties: {
        contextId: {
          type: 'number'
        }
      }
    },
    error: /contextId/
  }
]

test('validate model', function (t) {
  broken.forEach(bad => {
    t.throws(() => validate(bad.model), bad.error)
  })

  t.end()
})
