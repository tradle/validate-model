
const test = require('tape')
const validate = require('../')
const DEFAULT_MODELS = require('@tradle/models').models

const base = [
  {
    id: 'baseempty',
    type: 'tradle.Model',
    properties: {}
  },
  {
    id: 'baseinterface',
    isInterface: true,
    type: 'tradle.Model',
    properties: {
      happy: {
        type: 'string'
      }
    }
  },
  {
    id: 'colorsenum',
    type: 'tradle.Model',
    subClassOf: 'tradle.Enum',
    properties: {
      color: {
        type: 'string'
      }
    },
    enum: [
      { id: 'red', title: 'Red' },
      { id: 'green', title: 'Green' },
      { id: 'blue', title: 'Blue' },
      { id: 'white', title: 'White' },
    ]
  }
]

const good = [
  {
    id: 'good1',
    type: 'tradle.Model',
    properties: {
      a: {
        type: 'object',
        ref: 'baseempty'
      }
    }
  },
  {
    id: 'good2',
    type: 'tradle.Model',
    properties: {
      a: {
        type: 'object',
        ref: 'colorsenum',
        limit: [
          'red',
          'colorsenum_red'
        ],
        pin: [
          { id: 'colorsenum_red' }
        ]
      }
    }
  },
]

const bad = [
  {
    model: {
      id: 'bad1',
      type: 'tradle.Model',
      properties: {
        a: {
          type: 'object',
          ref: 'oops'
        }
      }
    },
    error: /non-existent/
  },
  {
    model: {
      id: 'bad2',
      type: 'tradle.Model',
      properties: {
        a: {
          type: 'object',
          ref: 'oops'
        }
      }
    },
    error: /non-existent/
  },
  {
    model: {
      id: 'bad3',
      type: 'tradle.Model',
      properties: {
        a: {
          type: 'object',
          ref: 'colorsenum',
          limit: [
            'Borg'
          ]
        }
      }
    },
    error: /limit/
  }
]

const all = base.concat(good)
                .concat(bad.map(item => item.model))

const invalid = bad.map(item => {
  return {
    models: all,
    model: item.model,
    error: item.error
  }
})

test('invalid references', function (t) {
  invalid.forEach(item => {
    t.throws(() => validate.refs({
      models: item.models,
      model: item.model
    }), item.error)
  })

  t.end()
})

test('valid references', function (t) {
  good.forEach(model => {
    t.doesNotThrow(() => validate.refs({
      models: all,
      model
    }))
  })

  t.end()
})

test('get references', function (t) {
  const direct = validate.refs.getDirectReferences(DEFAULT_MODELS['tradle.EmployeeOnboarding'])
    .sort(alphabetical)

  t.same(direct, [
    'tradle.FinancialProduct',
    'tradle.Name'
  ])

  const subset = [
    'tradle.EmployeeOnboarding',
    'tradle.AssignRelationshipManager'
  ]

  const recursive = validate.refs.getReferences({ models: DEFAULT_MODELS, subset })
    .sort(alphabetical)

  t.same(recursive, [
    'tradle.Application',
    'tradle.Check',
    'tradle.Country',
    'tradle.Document',
    'tradle.Enum',
    'tradle.FinancialProduct',
    'tradle.Form',
    'tradle.Identity',
    'tradle.Language',
    'tradle.Method',
    'tradle.MyProduct',
    'tradle.Name',
    'tradle.Organization',
    'tradle.Photo',
    'tradle.Profile',
    'tradle.PubKey',
    'tradle.SecurityCode',
    'tradle.Verification',
    'tradle.VerifiedItem',
    'tradle.WebSite'
  ])

  t.end()
})

test('input map / array', function (t) {
  t.throws(() => validate(base.concat(bad)))
  t.throws(() => validate(toObject(base.concat(bad))))
  t.doesNotThrow(() => validate(DEFAULT_MODELS))
  t.doesNotThrow(() => validate(toArray(DEFAULT_MODELS)))
  t.end()
})

function toArray (models) {
  return Object.keys(models).map(id => models[id])
}

function toObject (models) {
  const obj = {}
  for (let model of models) {
    obj[model.id] = model
  }

  return obj
}

function alphabetical (a, b) {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}
