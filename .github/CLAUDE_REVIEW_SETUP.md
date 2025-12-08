# Claude Code Review Setup Guide

This repository is configured with automated Claude AI code reviews for all pull requests.

## Features

The Claude Code Review workflow provides:

- **Architectural Analysis**: Reviews overall code structure, design patterns, and architectural decisions
- **Code Quality**: Analyzes TypeScript usage, code clarity, and potential bugs
- **Security Review**: Identifies security vulnerabilities, CSP compliance, and secure API key handling
- **Performance Analysis**: Suggests bundle size optimizations and performance improvements
- **Testing Feedback**: Evaluates test coverage and quality
- **Browser Extension Best Practices**: Reviews Manifest V3 compliance and extension patterns
- **Dependency Review**: Analyzes dependency choices and security

## Setup Instructions

### 1. Configure Anthropic API Key

The workflow requires an Anthropic API key to function. Follow these steps:

1. **Obtain an API key**
   - Go to [Anthropic Console](https://console.anthropic.com/)
   - Sign in or create an account
   - Navigate to API Keys section
   - Create a new API key

2. **Add the secret to GitHub**
   - Go to your repository on GitHub
   - Click **Settings** tab
   - In the left sidebar, click **Secrets and variables** → **Actions**
   - Click **New repository secret**
   - Name: `ANTHROPIC_API_KEY`
   - Value: Paste your Anthropic API key
   - Click **Add secret**

### 2. Verify Workflow Permissions

The workflow requires the following permissions (already configured):

- `contents: read` - To read the repository code
- `pull-requests: write` - To post review comments

These are set in the workflow file and should work with default repository settings.

### 3. Test the Workflow

To test the workflow:

1. Create or update a pull request
2. The workflow will automatically trigger
3. Check the **Actions** tab to see the workflow running
4. Once complete, Claude's review will appear as a comment on the PR

You can also manually trigger the workflow:

1. Go to **Actions** tab
2. Select **Claude Code Review** workflow
3. Click **Run workflow** (if applicable to your branch)

## How It Works

### Trigger Events

The workflow runs automatically on:

- New pull requests (`opened`)
- Updated pull requests (`synchronize`)
- Reopened pull requests (`reopened`)

### Review Process

1. **Checkout Code**: Fetches the PR code and base branch
2. **Get Diff**: Extracts changes between base and PR branch
3. **Claude Review**: Sends code changes to Claude Sonnet 4 for analysis
4. **Post Comment**: Adds Claude's review as a PR comment

### Error Handling

If the workflow fails, it will:

- Post an error comment on the PR explaining the issue
- Provide troubleshooting steps
- Link to the Actions logs for detailed error information

Common failure reasons:

- Missing or invalid `ANTHROPIC_API_KEY`
- API rate limiting
- Network connectivity issues
- Very large diffs (exceeding model context)

## Configuration

### Model Settings

Current configuration:

- **Model**: `claude-sonnet-4-5-20250929` (Claude Sonnet 4.5 - latest)
- **Max Tokens**: 8,192 (comprehensive reviews)
- **API Version**: `2023-06-01`

### Customizing Review Focus

To customize what Claude reviews, edit `.github/workflows/claude-review.yml`:

Find the `content` field in the API request and modify the focus areas or add specific instructions.

### Workflow File Location

The workflow is defined in:
```
.github/workflows/claude-review.yml
```

## Usage Tips

### Best Practices

1. **Review Claude's Feedback**: Claude provides architectural insights that may not be caught by traditional linters
2. **Prioritize Issues**: Claude rates issues by priority (Critical/High/Medium/Low)
3. **Consider Context**: Claude understands the PR description and provides context-aware feedback
4. **Iterate**: Address feedback and push updates; the workflow runs on each update

### Limitations

- **Large PRs**: Very large diffs may exceed the model's context window
- **API Costs**: Each review consumes API credits (monitor your Anthropic usage)
- **Rate Limits**: Anthropic API has rate limits; multiple simultaneous PRs may be queued

### Cost Management

To manage API costs:

- Consider reviewing only on specific PR labels
- Limit reviews to PRs targeting certain branches
- Use GitHub Actions conditions to filter when reviews run

Example (add to `on.pull_request`):
```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches:
      - main  # Only review PRs to main branch
```

## Troubleshooting

### Review Not Appearing

1. Check the **Actions** tab for workflow status
2. Verify `ANTHROPIC_API_KEY` secret is configured
3. Check workflow logs for specific errors
4. Ensure the PR has actual code changes

### API Key Errors

If you see "Error: ANTHROPIC_API_KEY secret is not configured":

1. Verify the secret name is exactly `ANTHROPIC_API_KEY`
2. Confirm the secret is added to **repository** secrets (not environment secrets)
3. Try removing and re-adding the secret

### Rate Limiting

If you hit API rate limits:

- Wait for the rate limit to reset (check Anthropic Console)
- Consider spacing out PR submissions
- Contact Anthropic support for increased limits

## Support

For issues with:

- **Workflow configuration**: Check GitHub Actions documentation
- **Claude API**: Contact Anthropic support or check [API docs](https://docs.anthropic.com/)
- **Repository-specific issues**: Open an issue in this repository

## Additional Resources

- [Anthropic API Documentation](https://docs.anthropic.com/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Claude API Pricing](https://www.anthropic.com/pricing)
