import { type Locator, type Page } from '@playwright/test';

export class SchedulePage {
  readonly page: Page;
  readonly sessionCards: Locator;
  readonly sessionDetailsModal: Locator;
  readonly launchKioskBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sessionCards = page.locator('.session-card'); // Fallback class, can be updated based on actual DOM
    this.sessionDetailsModal = page.getByRole('dialog');
    this.launchKioskBtn = page.getByRole('button', { name: 'Launch Kiosk' });
  }

  async navigate() {
    await this.page.goto('/schedule');
  }

  async openSessionDetails(sessionName: string) {
    await this.page.getByText(sessionName, { exact: false }).first().click();
  }

  async launchKiosk() {
    await this.launchKioskBtn.click();
  }
}
