
const test = require('tape')
const validate = require('../').refs

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
  }
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
    t.throws(() => validate({
      models: item.models,
      model: item.model
    }), item.error)
  })

  t.end()
})

test('valid references', function (t) {
  good.forEach(model => {
    t.doesNotThrow(() => validate({
      models: all,
      model
    }))
  })

  t.end()
})
