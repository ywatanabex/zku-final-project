function uint8ArrayToBase64(arr) {
    const cl = [];
    const len = arr.length;
    for (let i = 0; i < len; i++) { cl.push(String.fromCharCode(arr[i])) };
    return btoa(cl.join(''));
}

function base64ToUint8Array(s) {
    const d = atob(s)
    const arr = new Uint8Array(d.length);
    for (let i = 0; i < d.length; i++) { arr[i] = d.charCodeAt(i) };
    return arr;
}

function bigIntToUint8Array(big, nb) {
    let hex = big.toString(16)
    if (hex.length % 2) {
      hex = '0' + hex
    }
    const len = hex.length / 2
    const arr = new Uint8Array(nb)
    let i = 0
    let j = 0
    while (i < len) {
      arr[nb - len + i] = parseInt(hex.slice(j, j + 2), 16)
      i += 1
      j += 2
    }
    return arr
}

function uint8ArrayToBigInt(arr) {
  const h = []
  for (let i=0; i < arr.length; i++) { h.push(arr[i].toString(16).padStart(2, '0')) }
  return BigInt('0x' + h.join(''))
}


module.exports = { uint8ArrayToBase64, base64ToUint8Array, bigIntToUint8Array, uint8ArrayToBigInt };  