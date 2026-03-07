# PR Educator Agent - Usage Guide

## Overview

The PR Educator agent analyzes pull requests and generates comprehensive educational explanations from a senior engineering perspective. It transforms code reviews into teaching moments by extracting architectural insights, design patterns, and engineering principles.

## Quick Start

### Basic Usage

```
User: "Analyze PR #41 with the pr-educator agent"
```

Claude will:
1. Load the `.agents/pr-educator.md` agent prompt
2. Fetch PR #41 from GitHub
3. Analyze the implementation, architecture, and design decisions
4. Generate a comprehensive educational commentary
5. Post the analysis as a PR comment

### Custom Focus

```
User: "Use the pr-educator agent to analyze PR #38, focusing on security and testing"
```

Specify focus areas:
- Security
- Performance
- Testing
- Documentation
- Developer Experience
- Scalability

## What the Agent Produces

### Output Structure

The agent generates a markdown document (typically 800-1200 lines) with:

#### 1. Problem Space Analysis
- What problem the PR solves
- Real-world pain points (before/after scenarios)
- Time savings and efficiency gains

#### 2. Architecture Deep-Dive
- 3-5 major design patterns identified
- Code examples from the actual PR
- Junior vs Senior approach comparisons
- Key principles extracted for reuse

#### 3. Real-World Impact
- Quantified benefits (time, cost, risk reduction)
- Team-level calculations
- ROI analysis

#### 4. Key Takeaways
- 5-7 reusable engineering principles
- Concrete practices to adopt
- Growth path from junior to senior

#### 5. Discussion Questions
- 5 thought-provoking questions
- Application to other systems
- Advanced scenarios

### Example Output Sections

```markdown
## The Architecture: Why This Implementation is Excellent

### 1. **Multi-Layer Security Model** 🔒

[Code from PR]

**Why this is excellent:**
1. **Fail-safe defaults**: ENV || 'production' ensures locked-down by default
2. **Defense in depth**: Multiple independent protection layers
3. **Security logging**: Audit trail for blocked attempts

**Junior approach**: "Add a config flag ENABLE_FEATURE=true"
**Senior approach**: "Make it impossible to accidentally expose in production"
```

## When to Use This Agent

### Best Use Cases

1. **After Major Feature PRs**: Complex implementations with architectural decisions
2. **Team Learning**: Teaching junior engineers professional patterns
3. **Documentation**: Creating lasting educational artifacts
4. **Code Review Enhancement**: Going beyond "LGTM" to explain "why"
5. **Onboarding**: Showing new team members how decisions are made

### Ideal PR Characteristics

The agent works best with PRs that have:

- **Substantial implementation** (50+ lines of meaningful code)
- **Clear architectural decisions** (new abstractions, patterns)
- **Security considerations** (auth, validation, rate limiting)
- **Performance optimizations** (caching, memory management)
- **Testing strategy** (test suites, security controls)
- **Documentation** (README, guides, comments)

## Configuration Options

### Default Behavior

```
User: "Analyze PR #41 with the pr-educator agent"
```

Uses defaults:
- **Audience**: Junior engineers
- **Tone**: Objective, professional, educational
- **Length**: ~800-1200 lines
- **Focus**: All aspects (security, performance, testing, docs)

### Custom Configuration

```
User: "Use pr-educator on PR #52. Target audience: senior engineers. Focus on performance and scalability. Make it concise (500 lines)."
```

Customizable:
- **Audience level**: Junior, mid-level, senior engineers
- **Focus areas**: Security, performance, testing, DX, scalability
- **Length**: Concise (500 lines), standard (800-1200), comprehensive (1500+)
- **Tone**: Educational, architectural review, deep-dive

## Best Practices

### 1. Run After PR is Ready

Wait until the PR has:
- Final implementation (not early draft)
- Tests written
- Documentation added
- Initial reviews complete

The agent analyzes the final state to extract complete patterns.

### 2. Combine with Code Review

Use alongside traditional code review:

1. **Technical review**: Check correctness, performance, security
2. **PR educator agent**: Generate educational analysis
3. **Team discussion**: Use the analysis and discussion questions

### 3. Archive Educational Content

Save the generated analyses:

```bash
# Create a learning repository
mkdir -p docs/engineering-principles/

# Save PR analyses
mv pr-41-analysis.md docs/engineering-principles/
```

Use for:
- Onboarding new engineers
- Architecture decision records (ADRs)
- Team training materials
- Engineering blog posts

### 4. Customize for Your Team

The agent's output can be customized in `.agents/pr-educator.md`:

- Adjust tone for your team culture
- Add company-specific patterns to look for
- Modify the structure template
- Change emphasis (more/less code examples)

## Example Workflows

### Workflow 1: Major Feature Release

```
# PR is ready for merge
User: "Run the pr-educator agent on PR #55"

# Agent generates analysis
# Review and refine

User: "Post this analysis to PR #55"

# Share in team Slack/Discord
User: "Also create a summary of the key principles for our team wiki"
```

### Workflow 2: Learning from Security PR

```
User: "Analyze PR #47 with pr-educator, focusing on the security architecture"

# Agent emphasizes:
# - Defense in depth patterns
# - Threat modeling
# - Security testing

# Use for team training
User: "Extract the security patterns into a checklist for future PRs"
```

### Workflow 3: Onboarding Material

```
# After several major PRs
User: "Use pr-educator on PRs #40, #41, and #43 to create onboarding materials"

# Agent analyzes each PR
# Identifies common patterns across all three

User: "Synthesize these into a 'Senior Engineering Patterns' guide"
```

## Interpreting the Output

### Focus on These Sections

#### 1. **Architecture Deep-Dive**
Look for the "Junior approach vs Senior approach" comparisons. These show *decision-making patterns*.

#### 2. **Key Principles**
Each major section extracts a principle (e.g., "Production-ready code handles edge cases"). Collect these.

#### 3. **Real-World Impact**
The ROI calculations show how to think about engineering investments. Use these for planning.

#### 4. **Discussion Questions**
Use these in team meetings or 1-on-1s to reinforce learning.

### Red Flags

If the analysis includes these, the PR might need improvement:

- "No tests found for security-critical features"
- "Missing edge case handling"
- "Security controls not tested"
- "No documentation for complex features"
- "Unable to quantify impact" (might indicate unclear value)

## Refining the Agent

### Iteration Process

1. **Run on a PR**: `User: "Analyze PR #41 with pr-educator"`
2. **Review output**: Check quality, accuracy, tone
3. **Provide feedback**: `User: "The analysis is too verbose. Make it more concise."`
4. **Agent updates**: The agent can refine its approach
5. **Save refinements**: Update `.agents/pr-educator.md` with learned preferences

### Common Refinements

**Too technical**: "Simplify the language for junior engineers"
**Too verbose**: "Make it more concise, focus on top 3 patterns"
**Missing context**: "Add more real-world impact calculations"
**Wrong tone**: "Make it more objective, less enthusiastic"

## Integration with Other Agents

### With Screenshot Commenter

```
# PR with UI changes
User: "Run screenshot-commenter on PR #50, then use pr-educator to explain the UX architecture decisions"
```

### With Pre-Commit Validator

```
# Before creating PR
User: "Run pre-commit validator"

# After PR created
User: "Use pr-educator to document the quality engineering practices we follow"
```

### With Issue Manager

```
# Create issue for follow-up
User: "PR #41 analysis mentions missing modal focus trap tests. Create an issue for that with issue-manager"
```

## Troubleshooting

### "Agent can't fetch PR"

```
Error: Unable to fetch PR #41
```

**Solution**: Ensure `gh` CLI is authenticated:
```bash
gh auth status
gh auth login
```

### "Analysis is too generic"

**Cause**: PR might be too small or lack substantial architecture

**Solution**:
- Focus on specific aspects: "Focus on security only"
- Combine multiple related PRs
- Skip PRs with <50 lines of changes

### "Analysis is inaccurate"

**Cause**: Agent misunderstood the implementation

**Solution**:
- Provide context: "The circular buffer is for memory management, not performance"
- Point to specific files: "Focus on packages/api/src/middleware/rate-limit.ts"
- Correct and regenerate: "Re-analyze with this context..."

### "Output is too long"

**Solution**:
```
User: "Regenerate the analysis, but limit to 600 lines and focus on top 3 patterns only"
```

## Measuring Success

Track these metrics:

### Engagement
- Are team members reading the analyses?
- Are they discussing the questions?
- Are patterns being applied in new PRs?

### Learning
- Are junior engineers citing the analyses?
- Are code reviews referencing extracted principles?
- Is architectural consistency improving?

### Efficiency
- Is time-to-understanding decreasing for complex PRs?
- Are there fewer follow-up questions about design decisions?
- Are new team members onboarding faster?

## FAQ

### Q: Can I run this on PRs from other repositories?

Yes, if you have access:
```bash
# Set repository context
cd /path/to/other/repo

# Run agent
User: "Analyze PR #10 from this repository with pr-educator"
```

### Q: What if the PR is too large (500+ files)?

The agent will:
1. Focus on documentation first
2. Read core implementation files
3. Skip boilerplate/generated code
4. Note if analysis is partial

You can help by pointing to key files:
```
User: "Focus on these files: [list]"
```

### Q: Can I customize the output format?

Yes, edit `.agents/pr-educator.md`:
- Modify the Content Structure Template
- Adjust writing style guidelines
- Change emphasis priorities

### Q: Does this replace code review?

**No.** This *enhances* code review by:
- Adding educational context
- Explaining architectural decisions
- Creating learning artifacts

Traditional code review still checks:
- Correctness
- Test coverage
- Security vulnerabilities
- Performance issues

## Advanced Usage

### Creating a Learning Repository

```bash
# Set up structure
mkdir -p docs/engineering-principles/{security,performance,testing,architecture}

# Generate analyses
for pr in 40 41 43 47 52; do
  # Run pr-educator on each
  # Save to appropriate category
done

# Create index
User: "Create an index of all the engineering principles we've documented"
```

### Extracting Patterns Across PRs

```
User: "Analyze PRs #40-45 with pr-educator and identify common security patterns across all of them"
```

The agent will:
1. Analyze each PR
2. Extract security patterns
3. Identify commonalities
4. Synthesize into a security playbook

### Building Training Materials

```
User: "Use pr-educator analyses from PRs #40, #41, #43 to create a training module on production-ready code patterns"
```

Output becomes:
- Team training slides
- Engineering blog posts
- Onboarding documentation
- Architecture decision records

---

## Version History

- **1.0.0** (2025-11-17): Initial PR Educator agent
  - Comprehensive PR analysis
  - Senior engineering perspective
  - Educational focus
  - Quantified impact calculations
  - Discussion questions

---

**Need help?** Ask Claude: "How do I use the pr-educator agent?" or "Show me examples of pr-educator output"
