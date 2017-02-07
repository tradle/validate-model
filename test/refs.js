
const test = require('tape')
const validate = require('../').refs
const broken = [
  {
    model: {
      id: 'something'
    },
    errors: [
      //
    ]
  }
]

// test('validate', function (t) {
//   broken.forEach(bad => {
//     const result = validateModel(bad.model)
//     t.ok(bad.error.test(result), result)
//   })

//   t.end()
// })
