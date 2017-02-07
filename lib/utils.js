const typeforce = require('typeforce')

exports.maybeStrings = typeforce.maybe(typeforce.arrayOf('String'))
exports.maybeString = typeforce.maybe('String')
exports.maybeBool = typeforce.maybe('Boolean')
exports.maybeNum = typeforce.maybe('Number')
exports.maybeObj = typeforce.maybe('Object')
exports.normalizeError = normalizeError
exports.updateErrorWithMessage = updateErrorWithMessage

/**
 * like [].find(test), but returns the result of the test function
 * rather than the item that passed the test
 */
exports.find = function find (arr, test) {
  let result

  /* eslint array-callback-return: "off" */
  arr.some(item => {
    const ret = test(item)
    if (typeof ret !== 'undefined') {
      return result = ret
    }
  })

  return result
}

exports.handleError = function handleError (err) {
  if (!(err instanceof TypeError || err instanceof ReferenceError) && process.env.PRINT_ONLY) {
    console.error(err)
  } else {
    throw err
  }
}

function normalizeError (err) {
  const underlying = err.__error || err
  const copy = new underlying.constructor(err.message)
  // hack for typeforce
  if (err.__error) {
    copy.stack = err.__error.stack
  }

  if (!copy.stack) {
    copy.stack = err.stack
  }

  return copy
}

function updateErrorWithMessage (err, message) {
  err = normalizeError(err)
  err.message = message
  err.stack = message + '\n' + err.stack
  return err
}
