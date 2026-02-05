# Commit and Push

Commit all current changes and push to remote. Follow these steps exactly:

1. Run `git status` (never use -uall flag) and `git diff` in parallel to see all changes
2. Run `git log --oneline -5` to see recent commit message style
3. Analyze all changes and draft a concise commit message:
   - Use conventional commit format: `type: description` (fix:, feat:, refactor:, docs:, chore:)
   - Keep the first line under 72 characters
   - Add a blank line and body if the change needs explanation
   - Do NOT commit files that contain secrets (.env, credentials, tokens)
4. Stage the changed files by name (not `git add -A` or `git add .`)
5. Create the commit with the message ending with `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
6. Push to remote: `git push`
7. Report the commit hash and confirm push succeeded

Use HEREDOC format for commit messages:
```
git commit -m "$(cat <<'EOF'
type: short description

Optional body with more context.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```
