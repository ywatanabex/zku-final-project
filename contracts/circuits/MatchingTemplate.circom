pragma circom 2.0.0;
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
include "./UniqueTemplate.circom";
include "./RangeProofTemplate.circom";


// N: number of male or female
// The simplest setting of matching (number of male and female are equal, no truncation in the preference list)
template Matching(N) {  
    signal input matching[N][N];     // row: male index, col: female index
    signal input privateKeyM[N];     // secret key from males (each key is a large number)
    signal input privateKeyF[N];     // secret key from females (each key is a large number)
    signal input scoreMF[N][N];      // score matrix from Male to Female
    signal input scoreFM[N][N];      // score matrix from Female to Male
    // public outputs
    signal output matchingHashM[N];  // hash of matching for Males
    signal output matchingHashF[N];  // hash of matching for Females
    signal output scoreHashM[N];     // hash of scoreMF matrix (each participants can check this hash)
    signal output scoreHashF[N];     // hash of scoreMF matrix (each participants can check this hash)


    component SumMatchingM[N];       // sum of matching array is equal to one
    component SumMatchingF[N];
    component ScoreMFRange[N][N];
    component ScoreMFUnique[N];
    component ScoreFMRange[N][N];
    component ScoreFMUnique[N];
    component MatchingHasherM[N];
    component MatchingHasherF[N];    
    component ScoreHasherM[N];
    component ScoreHasherF[N];
    component ScoreMatchingInnerProductM[N]; 
    component ScoreMatchingInnerProductF[N]; 
    component StableConditionM[N][N]; 
    component StableConditionF[N][N]; 


    // Check input
    // ============
    // 1. matching
    // matching value are 0 or 1.
    for (var i = 0; i < N; i++) {
        for (var j = 0; j < N; j++) {
            matching[i][j] * (1 - matching[i][j]) === 0;
        }
    }
    // each male has exactly one match.
    for (var i = 0; i < N; i++) {
        SumMatchingM[i] = Sum(N);
        for (var j = 0; j < N; j++) {
            SumMatchingM[i].in[j] <== matching[i][j];
        }
        SumMatchingM[i].out === 1;
    }    
    // each female has exactly one match.
    for (var j = 0; j < N; j++) {
        SumMatchingF[j] = Sum(N);
        for (var i = 0; i < N; i++) {
            SumMatchingF[j].in[i] <== matching[i][j];
        }
        SumMatchingF[j].out === 1;
    }      

    // 2. scoreMF
    // score values between 1 and N (higher is better)
    for (var i = 0; i < N; i++) {
        for (var j = 0; j < N; j++) {
            ScoreMFRange[i][j] = RangeProof(10);    // TODO: assuming N < 2**10 
            ScoreMFRange[i][j].range[0] <== 1;
            ScoreMFRange[i][j].range[1] <== N;
            ScoreMFRange[i][j].in <== scoreMF[i][j];
            ScoreMFRange[i][j].out === 1;  // true
        }
    }
    // each row of score matrix must be a permutation from 1 to N.
    // this is equivalent to the uniquness of the entries in each row.
    for (var i = 0; i < N; i++) {
        ScoreMFUnique[i] = Unique(N);
        for (var j = 0; j < N; j++) {
            ScoreMFUnique[i].in[j] <== scoreMF[i][j];
        }
        ScoreMFUnique[i].out === 1;
    }

    // 3. scoreFM 
    for (var j = 0; j < N; j++) {
        for (var i = 0; i < N; i++) {
            ScoreFMRange[j][i] = RangeProof(10);    // TODO: assuming N < 2**10 
            ScoreFMRange[j][i].range[0] <== 1;
            ScoreFMRange[j][i].range[1] <== N;
            ScoreFMRange[j][i].in <== scoreFM[j][i];
            ScoreFMRange[j][i].out === 1;  // true
        }
    }
    for (var j = 0; j < N; j++) {
        ScoreFMUnique[j] = Unique(N);
        for (var i = 0; i < N; i++) {
            ScoreFMUnique[j].in[i] <== scoreFM[j][i];
        }
        ScoreFMUnique[j].out === 1;
    }

  
    // Hashes
    // =======================
    // matching hash for Males
    for (var i = 0; i < N; i++) {
        MatchingHasherM[i] = Poseidon(N+1);
        MatchingHasherM[i].inputs[0] <== privateKeyM[i];
        for (var j = 0; j < N; j++) {
            MatchingHasherM[i].inputs[1 + j] <== matching[i][j];
        }
        matchingHashM[i] <== MatchingHasherM[i].out;
    } 
    // matching hash for Females
    for (var j = 0; j < N; j++) {
        MatchingHasherF[j] = Poseidon(N+1);
        MatchingHasherF[j].inputs[0] <== privateKeyF[j];
        for (var i = 0; i < N; i++) {
            MatchingHasherF[j].inputs[1 + i] <== matching[i][j];
        }
        matchingHashF[j] <== MatchingHasherF[j].out;
    }     

    // score hash for Males
    for (var i = 0; i < N; i++) {
        ScoreHasherM[i] = Poseidon(N+1);
        ScoreHasherM[i].inputs[0] <== privateKeyM[i];
        for (var j = 0; j < N; j++) {
            ScoreHasherM[i].inputs[1 + j] <== scoreMF[i][j];
        }
        scoreHashM[i] <== ScoreHasherM[i].out;
    } 
    // score hash for Females
    for (var j = 0; j < N; j++) {
        ScoreHasherF[j] = Poseidon(N+1);
        ScoreHasherF[j].inputs[0] <== privateKeyF[j];
        for (var i = 0; i < N; i++) {
            ScoreHasherF[j].inputs[1 + i] <== scoreFM[j][i];
        }
        scoreHashF[j] <== ScoreHasherF[j].out;
    }     


    // Stable Matching Condition
    // ==========================    
    // Compute \sum_j score[i][j] * matching[i][j] = score[i][j_i]
    for (var i = 0; i < N; i++) {
        ScoreMatchingInnerProductM[i] = InnerProduct(N);
        for (var j = 0; j < N; j++) {
            ScoreMatchingInnerProductM[i].left[j] <== scoreMF[i][j];
            ScoreMatchingInnerProductM[i].right[j] <== matching[i][j];
        }
    }
    for (var j = 0; j < N; j++) {
        ScoreMatchingInnerProductF[j] = InnerProduct(N);
        for (var i = 0; i < N; i++) {
            ScoreMatchingInnerProductF[j].left[i] <== scoreFM[j][i];
            ScoreMatchingInnerProductF[j].right[i] <== matching[i][j];
        }
    }    

    signal cij[N][N];
    for (var i = 0; i < N; i++) {
        for (var j = 0; j < N; j++) {
            StableConditionM[i][j] = GreaterEqThan(10);  // TODO: better bit choice                
            StableConditionM[i][j].in[0] <== (ScoreMatchingInnerProductM[i].out - scoreMF[i][j]);  // if >= 0, then return 1 (true).
            StableConditionM[i][j].in[1] <== 0;

            StableConditionF[j][i] = GreaterEqThan(10);  // TODO: better bit choice                
            StableConditionF[j][i].in[0] <== (ScoreMatchingInnerProductF[j].out - scoreFM[j][i]);  // if >= 0, then return 1 (true).
            StableConditionF[j][i].in[1] <== 0;

            // matching[i][i] == 1 OR StableConditionM[i][j].out == 1 OR StableConditionF[j][i].out == 1
            cij[i][j] <== (1 - StableConditionM[i][j].out) * (1 - StableConditionF[j][i].out);
            (1 - matching[i][j]) * cij[i][j] === 0;
        }        
    }
}
