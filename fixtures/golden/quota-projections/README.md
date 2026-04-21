# golden/quota-projections

Store expected quota snapshots and derived capacity states here.

Use this bucket for ChatGPT-authenticated and API-key capacity models.

Each golden file should include:

- input fixture pointer
- normalized snapshot shape
- expected capacity derivation (`pressure`, `schedulable`, `reasonCodes`)
