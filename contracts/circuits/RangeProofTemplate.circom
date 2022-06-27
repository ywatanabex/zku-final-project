pragma circom 2.0.0;
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";


template RangeProof(n) {
    assert(n <= 252);
    signal input in;       // 
    signal input range[2]; // the two elements should be the range, i.e. [lower_bound, upper_bound]
    signal output out;     // return 1 (true) if lower_bound <= in <= upper_bound

    component low = LessEqThan(n);
    component high = GreaterEqThan(n);

    low.in[0] <== in;
    low.in[1] <== range[1];

    high.in[0] <== in;
    high.in[1] <== range[0];

    out <== low.out * high.out;    
}