import { type Locator, type Page } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly mainNav: Locator;
  readonly onboardingBanner: Locator;
  readonly scanToCheckInBtn: Locator;
  readonly announcementsWidget: Locator;

  constructor(page: Page) {
    this.page = page;
    this.mainNav = page.getByRole('navigation');
    this.onboardingBanner = page.locator('text=Continue Onboarding');
    this.scanToCheckInBtn = page.getByRole('button', { name: 'Scan to Check-In' });
    this.announcementsWidget = page.locator('section').filter({ hasText: 'Announcements' });
  }

  async navigate() {
    await this.page.goto('/');
  }

  async clickCheckIn() {
    await this.scanToCheckInBtn.click();
  }

  getOnboardingBanner(): Locator {
    return this.onboardingBanner;
  }
}
