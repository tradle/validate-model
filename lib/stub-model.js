module.exports = {
  type: 'tradle.Model',
  id: 'tradle.ResourceStub',
  title: 'Resource Stub',
  properties: {
    _t: {
      type: 'string',
      range: 'model'
    },
    _permalink: {
      type: 'string'
    },
    _link: {
      type: 'string'
    },
    _displayName: {
      type: 'string'
    }
  },
  required: ['_t', '_permalink', '_link']
}
