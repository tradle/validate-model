
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
          type: 'object',
          ref: 'tradle.File',
          dataBundle: true,
          range: 'json'
        }
      }
    },
    propertyName: 'name',
    error: /range/
  },
  {
    model: {
      properties: {
        name: {
          type: 'object',
          ref: 'tradle.Photo',
          dataBundle: true,
          allowedMimeTypes: [
            'image/*',
            'application/pdff'
          ],
        }
      }
    },
    propertyName: 'name',
    error: /allowedMimeTypes/
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
        name: {
          type: 'string',
          allowedMimeTypes: 'image/*',
        }
      }
    },
    propertyName: 'name',
    error: /allowedMimeTypes/
  },

  {
    model: {
      properties: {
        names: {
          type: 'string',
          group: [
            'firstName',
            'otherNames'
          ]
        }
      }
    },
    propertyName: 'names',
    error: /displayAs/
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
          displayAs: '{1} {2}',
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
  },
  {
    model: {
      properties: {
        name: {
          type: 'string',
          sample: 8
        }
      }
    },
    propertyName: 'name',
    error: /string or object/
  },
]

const valid = []

test('validate prop', function (t) {
  broken.forEach(bad => {
    t.throws(() => validate(bad), bad.error)
  })

  valid.forEach(good => {
    t.doesNotThrow(() => validate(good))
  })

  t.end()
})
