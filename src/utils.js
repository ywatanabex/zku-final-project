function unstringifyBigInts(o) {
    if ((typeof(o) == "string") && (/^[0-9]+$/.test(o) ))  {
        return BigInt(o);
    } else if ((typeof(o) == "string") && (/^0x[0-9a-fA-F]+$/.test(o) ))  {
        return BigInt(o);
    } else if (Array.isArray(o)) {
        return o.map(unstringifyBigInts);
    } else if (typeof o == "object") {
        if (o===null) return null;
        const res = {};
        const keys = Object.keys(o);
        keys.forEach( (k) => {
            res[k] = unstringifyBigInts(o[k]);
        });
        return res;
    } else {
        return o;
    }
}

function decodeMatchingHash(poseidon, hashSalt, matchingHash, N) {   
    for (let i=0; i < N; i++) {
        let m = Array(N).fill(0);
        m[i] = 1;
        if (BigInt(matchingHash) === BigInt(poseidon.F.toObject(poseidon([hashSalt, ...m])))) {
            return i
        }
    }
    return -1
}

module.exports = { unstringifyBigInts, decodeMatchingHash };  