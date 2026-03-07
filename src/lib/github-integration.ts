import { Octokit } from '@octokit/rest';
import type { GitHubIssueData } from '../types';

export class GitHubIntegration {
  private octokit: Octokit | null = null;
  private repo: { owner: string; repo: string } | null = null;

  constructor(token?: string, repoUrl?: string) {
    if (token) {
      this.octokit = new Octokit({ auth: token });
    }
    if (repoUrl) {
      this.repo = this.parseRepoUrl(repoUrl);
    }
  }

  private parseRepoUrl(url: string): { owner: string; repo: string } | null {
    // Support formats: "owner/repo", "github.com/owner/repo", "https://github.com/owner/repo"
    const match = url.match(/(?:github\.com\/)?([^\/]+)\/([^\/\s]+)/);
    if (!match) return null;

    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, ''),
    };
  }

  /**
   * Upload a screenshot (data URL) to the repo under screenshots/mrplug/ and return the raw URL.
   * Falls back gracefully — if upload fails the issue is still created without the image.
   */
  private async uploadScreenshot(
    dataUrl: string,
    filename: string
  ): Promise<string | null> {
    if (!this.octokit || !this.repo) return null;

    try {
      // data:image/png;base64,<data>
      const base64Match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
      if (!base64Match) return null;

      const content = base64Match[1];
      const path = `screenshots/mrplug/${filename}`;

      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.repo.owner,
        repo: this.repo.repo,
        path,
        message: `chore: add MrPlug screenshot ${filename}`,
        content,
      });

      return `https://raw.githubusercontent.com/${this.repo.owner}/${this.repo.repo}/main/${path}`;
    } catch (err) {
      console.warn('[MrPlug] Screenshot upload failed:', err);
      return null;
    }
  }

  async createIssue(issueData: GitHubIssueData): Promise<{ url: string; number: number }> {
    if (!this.octokit || !this.repo) {
      throw new Error('GitHub integration not configured. Please set token and repository.');
    }

    const timestamp = Date.now();

    // Upload screenshots if provided
    let elementScreenshotUrl: string | null = null;
    let viewportScreenshotUrl: string | null = null;

    if (issueData.elementScreenshot) {
      elementScreenshotUrl = await this.uploadScreenshot(
        issueData.elementScreenshot,
        `element-${timestamp}.png`
      );
    }
    if (issueData.viewportScreenshot) {
      viewportScreenshotUrl = await this.uploadScreenshot(
        issueData.viewportScreenshot,
        `viewport-${timestamp}.png`
      );
    }

    const body = this.formatIssueBody(issueData, elementScreenshotUrl, viewportScreenshotUrl);

    const response = await this.octokit.issues.create({
      owner: this.repo.owner,
      repo: this.repo.repo,
      title: issueData.title,
      body,
      labels: issueData.labels,
      assignees: issueData.assignees,
    });

    return { url: response.data.html_url, number: response.data.number };
  }

  private formatIssueBody(
    issueData: GitHubIssueData,
    elementScreenshotUrl: string | null,
    viewportScreenshotUrl: string | null
  ): string {
    const parts: string[] = [];

    // Description
    if (issueData.body) {
      parts.push(issueData.body);
    }

    // Acceptance Criteria
    if (issueData.acceptanceCriteria && issueData.acceptanceCriteria.length > 0) {
      parts.push('## Acceptance Criteria\n');
      parts.push(issueData.acceptanceCriteria.map((c) => `- [ ] ${c}`).join('\n'));
    }

    // Open Questions
    if (issueData.openQuestions && issueData.openQuestions.length > 0) {
      parts.push('## Open Questions\n');
      parts.push(issueData.openQuestions.map((q) => `- ${q}`).join('\n'));
    }

    // Element context
    if (issueData.elementContext) {
      const ctx = issueData.elementContext;
      const ctxLines = [
        `**Element**: \`<${ctx.tagName.toLowerCase()}${ctx.id ? ` id="${ctx.id}"` : ''}${ctx.classList.length ? ` class="${ctx.classList.join(' ')}"` : ''}>\``,
        `**DOM path**: \`${ctx.domPath}\``,
        `**Dimensions**: ${ctx.boundingRect.width}×${ctx.boundingRect.height}px`,
      ];
      if (issueData.pageUrl) {
        ctxLines.push(`**Page**: ${issueData.pageUrl}`);
      }
      parts.push('## Context\n\n' + ctxLines.join('  \n'));
    }

    // Screenshots
    const screenshotParts: string[] = [];
    if (elementScreenshotUrl) {
      screenshotParts.push(`### Element\n![Element screenshot](${elementScreenshotUrl})`);
    }
    if (viewportScreenshotUrl) {
      screenshotParts.push(`### Viewport\n![Viewport screenshot](${viewportScreenshotUrl})`);
    }
    // Legacy single screenshot (data URL — only included if no uploaded URL available)
    if (!elementScreenshotUrl && !viewportScreenshotUrl && issueData.screenshot) {
      screenshotParts.push(`### Screenshot\n![Screenshot](${issueData.screenshot})`);
    }
    if (screenshotParts.length > 0) {
      parts.push('## Screenshots\n\n' + screenshotParts.join('\n\n'));
    }

    parts.push('---\n*Created via [MrPlug](https://github.com/ojfbot/MrPlug) — Frame OS inspect mode*');

    return parts.join('\n\n');
  }

  async validateConfig(): Promise<boolean> {
    if (!this.octokit || !this.repo) return false;

    try {
      await this.octokit.repos.get({
        owner: this.repo.owner,
        repo: this.repo.repo,
      });
      return true;
    } catch {
      return false;
    }
  }

  async getLabels(): Promise<string[]> {
    if (!this.octokit || !this.repo) return [];

    try {
      const response = await this.octokit.issues.listLabelsForRepo({
        owner: this.repo.owner,
        repo: this.repo.repo,
      });
      return response.data.map((label) => label.name);
    } catch {
      return [];
    }
  }
}
