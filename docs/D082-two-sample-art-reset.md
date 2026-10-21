# D082 art-direction reset: two integrated samples

The user rejected the ten-building D082 preview on 2026-10-21 as worse than earlier work. Those designs and their technical evidence are retained on the original draft branch. Technical success was not visual acceptance. This separate branch is a two-sample design review, not a release candidate and not completion of the required eight-or-more building round.

## Reference and concrete correction

The actual D059 cottage, rows and inn and D065 Arts-and-Crafts/Tudorbethan houses have a coherent entrance, roof-edge treatment, chimney stacks, dark openings and a hierarchy of main building and attached lower parts. D080/D081 themselves already use a more simplified shell-and-window-grid vocabulary, so they are not the strongest artistic benchmark. The rejected D082 exaggerated that simplification and made some bodies implausibly tall and narrow.

The two samples replace only exact slots 179v0 and 179v1. Both retain their original parcel size 1, heights .78/.66 and weighted ceiling 182. All other rejected slots fall back to their previous accepted artwork. There are no new IDs, no save/simulation changes and no UI redesign.

- Stone village hall: broad two-level main body, slate roof with modest overhang, pale stone dressings and plinth, unmistakable entrance porch, one masonry stack with two terracotta pots. Regular windows stop below the eaves.
- Arts-and-Crafts community reading room: red brick main body, cream/timber front gable, terracotta roofs, attached lower side range, separate legible entrance and purposeful chimney. The lower range has one window level rather than a uniform two-storey atlas grid.

All architectural detail is in W/O and counted in the original weighted budget, not hidden in the non-shadow arena. Initial emitted totals are 172 and 176 against 182. Typecheck and production build passed locally. These numbers establish neither artistic quality nor complete final-round coverage: actual production screenshots and the user's direction approval are still required. Existing full ten-building acceptance tests are not weakened or represented as passed by this two-sample review.

Do not merge or deploy this branch. After a direction is accepted, expand to the required full round and rerun the complete geometry, exterior-coverage, history, frame, browser and release gates on the final exact head.
