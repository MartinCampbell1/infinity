# golden/normalized-events

Store expected normalized event streams here.

Every golden file should make identity, order, and payload shape explicit.

Identity rule used by Worker 5R event layer:

`{sessionId}:{source}:{kind}:{timestamp}:{ordinal}`
