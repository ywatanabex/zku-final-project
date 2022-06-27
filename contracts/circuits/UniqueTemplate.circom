pragma circom 2.0.0;
include "../../node_modules/circomlib/circuits/comparators.circom";


// compute inner product of left and right vectors, each having length n.
template InnerProduct(n) {    
    signal input left[n];
    signal input right[n];
    signal output out;

    signal tmp[n];
    tmp[0] <== left[0] * right[0];
    for (var i = 1; i < n; i++) {
        tmp[i] <== tmp[i-1] + left[i] * right[i];
    }
    out <== tmp[n-1];
}

// compute the sum of n inputs
template Sum(n) {
    signal input in[n];
    signal output out;

    signal tmp[n];
    tmp[0] <== in[0];
    for (var i = 1; i < n; i++) {
        tmp[i] <== tmp[i-1] + in[i];
    }
    out <== tmp[n-1];
}

// return 1 (true) if all inputs are different, 0 otherwise
template Unique(n) {
    signal input in[n];
    signal output out;

    var m = n * (n-1) / 2;
    component equal[m];
    var k = 0;
    for (var i = 0; i < n; i++) {
        for (var j = i+1; j < n; j++) {
            equal[k] = IsEqual();
            equal[k].in[0] <== in[i];
            equal[k].in[1] <== in[j];
            k = k + 1;
        }
    }
    // if unique, equal[k].out = 0 for all k

    component sum = Sum(m);    
    for (var k = 0; k < m; k++) {
        sum.in[k] <== equal[k].out;
    }
    component isZero = IsZero();
    isZero.in <== sum.out;
    out <== isZero.out;   // return 1 (true) if unique
}
