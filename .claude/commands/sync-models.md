# Sync Models from deAPI

1. Load token from data/config.json
2. Execute GET on deAPI /models endpoint
3. Display list of available models grouped by category
4. Compare with models defined in endpoint-registry.ts
5. Suggest updates if there are new models
