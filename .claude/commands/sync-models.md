# Sync Models from deAPI

1. Load token from data/config.json (active profile)
2. Execute GET on deAPI /models endpoint
3. Display list of available models grouped by inference_type
4. For each model, show: slug, inference_types, limits, defaults, features
5. Summarize total model count and which endpoint categories they cover
