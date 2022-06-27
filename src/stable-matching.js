// preference list: [0, 2, 1] 
// index=0 is most preffered
// index=2 is the second most preffered
// index=1 is the least preffered

// Sample Input 1.
// preference_list_M = [
//     [0, 2, 1],
//     [1, 0, 2],
//     [2, 1, 0]
// ]
// preference_list_F = [
//     [0, 1, 2],
//     [1, 0, 2],
//     [2, 1, 0]
// ] 
//
// > computeStableMatching(preference_list_M, preference_list_F)
// [ [ 0, 0 ], [ 1, 1 ], [ 2, 2 ] ]

// Sample Input 2.
// preference_list_M = [
//     [0, 2, 1],
//     [1, 0, 2],
//     [0, 1, 2]
// ]
// preference_list_F = [
//     [2, 1, 0],
//     [1, 0, 2],
//     [0, 1, 2]
// ] 
//
// > computeStableMatching(preference_list_M, preference_list_F)
// [ [ 2, 0 ], [ 1, 1 ], [ 0, 2 ] ]


// e.g. scoreToRanking([3, 1, 2]) == [0, 2, 1]
function scoreToRanking(scoreList) {
    const N = scoreList.length;
    const ret = [];
    for (let i=0; i < N; i++) {
        ret.push(scoreList.indexOf(N-i));
    }
    return ret
}

// e.g. rankingToScore([0, 2, 1]) == [3, 1, 2]
function rankingToScore(ranking) {
    const N = ranking.length;
    const ret = Array(N).fill(0);
    for (let i=0; i < N; i++) {
        ret[ranking[i]] = N - i;
    }
    return ret
}

function computeStableMatching(preference_list_M, preference_list_F) {
    const N = preference_list_M.length;
    // assert preference_list_M.length === preference_list_F.length;
    // assert preference_list_M[0] === N
    // assert preference_list_N[0] === N
    // assert no duplication within each preference

    // initialize
    let partner_F = Array(N).fill(null)
    let free_M = Array(N).fill(true)

    while (free_M.filter(b => b === true).length > 0) {
        // pick the first man
        let m = free_M.indexOf(true)
        for (let f of preference_list_M[m]) {
            if (free_M[m]) {
                if (partner_F[f] === null) {
                    partner_F[f] = m
                    free_M[m] = false
                }
                else {
                    let m1 = partner_F[f]
                    let index_m1 = preference_list_F[f].indexOf(m1)
                    let index_m = preference_list_F[f].indexOf(m)
                    if (index_m < index_m1) {   // m is better than m1
                        partner_F[f] = m
                        free_M[m] = false
                        free_M[m1] = true
                    }
                }
            }
        }    
    }
    return partner_F.map((m, f) => [m, f])
}

// e.g. [[0, 2], [1, 1], [2, 0]] -> [[0, 0, 1], [0, 1, 0], [1, 0, 0]]
function matchingToArray(matching) {
    const N = matching.length;
    const ret = Array(N).fill(0).map(i => Array(N).fill(0));
    for (let m of matching) {
        ret[m[0]][m[1]] = 1;
    }
    return ret
}

module.exports = {scoreToRanking, rankingToScore, computeStableMatching, matchingToArray};