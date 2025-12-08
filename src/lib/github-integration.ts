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

  async createIssue(issueData: GitHubIssueData): Promise<string> {
    if (!this.octokit || !this.repo) {
      throw new Error('GitHub integration not configured. Please set token and repository.');
    }

    const body = this.formatIssueBody(issueData);

    const response = await this.octokit.issues.create({
      owner: this.repo.owner,
      repo: this.repo.repo,
      title: issueData.title,
      body,
      labels: issueData.labels,
      assignees: issueData.assignees,
    });

    return response.data.html_url;
  }

  private formatIssueBody(issueData: GitHubIssueData): string {
    let body = issueData.body;

    if (issueData.screenshot) {
      body += '\n\n## Screenshot\n';
      body += `![Element Screenshot](${issueData.screenshot})`;
    }

    body += '\n\n---\n';
    body += '*Created via MrPlug - AI UI Feedback Assistant*';

    return body;
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
