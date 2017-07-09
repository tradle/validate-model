
const test = require('tape')
const validate = require('../').property
const broken = [
  {
    model: {
      properties: {
        name: {}
      }
    },
    propertyName: 'name',
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
    propertyName: 'name',
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
    propertyName: 'name',
    error: /range/
  },
  {
    model: {
      properties: {
        firstName: {
          type: 'string'
        },
        middleName: {
          type: 'string'
        },
        names: {
          type: 'string',
          group: [
            'firstName',
            'otherNames'
          ]
        },
        otherNames: {
          type: 'string',
          group: [
            'middleName'
          ]
        }
      }
    },
    propertyName: 'names',
    error: /nested/
  }
]

const valid = [
]

test('validate prop', function (t) {
  broken.forEach(bad => {
    t.throws(() => validate(bad), bad.error)
  })

  valid.forEach(good => {
    t.doesNotThrow(() => validate(good))
  })

  t.end()
})
