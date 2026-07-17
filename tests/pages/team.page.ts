import { type Locator, type Page } from '@playwright/test';

export class TeamPage {
  readonly page: Page;
  readonly rosterTabToggle: Locator;
  readonly approvalsTabToggle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.rosterTabToggle = page.getByRole('button', { name: 'Roster' });
    this.approvalsTabToggle = page.getByRole('button', { name: 'Approvals' });
  }

  async navigate() {
    await this.page.goto('/team');
  }

  async switchTab(tabName: 'Roster' | 'Approvals') {
    if (tabName === 'Roster') {
      await this.rosterTabToggle.click();
    } else {
      await this.approvalsTabToggle.click();
    }
  }

  async approveVolunteer(email: string) {
    // Finds the pending volunteer item by email and clicks its relative Approve button
    const volunteerItem = this.page.locator('div').filter({ hasText: email }).first();
    await volunteerItem.getByRole('button', { name: 'Approve' }).click();
  }
}
