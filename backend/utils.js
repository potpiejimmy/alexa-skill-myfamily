function asyncLoop(array, iter, complete, index = 0) {
    if (index >= array.length) complete();
    else iter(array[index], () => asyncLoop(array, iter, complete, ++index));
}

function asyncLoopP(array, iter) {
    return new Promise((resolve, reject) => asyncLoop(array, iter, () => resolve()));
}

function asyncWhile(condition, iter, complete) {
    if (!condition()) complete();
    else iter(() => asyncWhile(condition, iter, complete));
}

function asyncWhileP(condition, iter) {
    return new Promise((resolve, reject) => asyncWhile(condition, iter, () => resolve()));
}

module.exports.asyncLoop = asyncLoop;
module.exports.asyncLoopP = asyncLoopP;
module.exports.asyncWhile = asyncWhile;
module.exports.asyncWhileP = asyncWhileP;
